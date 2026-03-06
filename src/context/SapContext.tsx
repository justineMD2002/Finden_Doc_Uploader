import {
  createContext, useContext, useState, useCallback,
  useEffect, useRef, type ReactNode,
} from 'react'
import { sapLogin, sapLogout, type SapSession } from '@/lib/sapService'
import { COMPANIES } from '@/lib/databases'
import type { Company } from '@/types/document'

// ─── sessionStorage persistence ────────────────────────────────────────────
// Uses sessionStorage so the session survives page refreshes but is cleared
// automatically when the browser tab/window is closed.

const SESSION_KEY = 'finden_sap_session'

interface PersistedSapData {
  session: SapSession
  companyId: string  // used to look up the Company object from COMPANIES
}

function saveToStorage(session: SapSession, company: Company) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ session, companyId: company.id } satisfies PersistedSapData))
}

function loadFromStorage(): { session: SapSession; company: Company } | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const { session, companyId } = JSON.parse(raw) as PersistedSapData
    const company = COMPANIES.find(c => c.id === companyId)
    if (!company) return null
    return { session, company }
  } catch {
    return null
  }
}

function clearStorage() {
  sessionStorage.removeItem(SESSION_KEY)
}

// ─── Auto-renew timing ─────────────────────────────────────────────────────
// Renew 5 minutes before the SAP session timeout to avoid mid-request expiry.

function renewIntervalMs(sessionTimeoutMinutes: number) {
  return Math.max((sessionTimeoutMinutes - 5) * 60 * 1000, 60_000)
}

// ─── Context types ─────────────────────────────────────────────────────────

type SapStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

interface SapContextValue {
  session: SapSession | null
  company: Company | null
  status: SapStatus
  errorMessage: string
  connect: (company: Company) => Promise<boolean>
  disconnect: () => Promise<void>
}

const SapContext = createContext<SapContextValue | null>(null)

// ─── Provider ──────────────────────────────────────────────────────────────

export function SapProvider({ children }: { children: ReactNode }) {
  const [session,      setSession]      = useState<SapSession | null>(null)
  const [company,      setCompany]      = useState<Company | null>(null)
  const [status,       setStatus]       = useState<SapStatus>('disconnected')
  const [errorMessage, setErrorMessage] = useState('')
  const renewTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Timer helpers ─────────────────────────────────────────────────────────

  function stopRenewTimer() {
    if (renewTimer.current) {
      clearInterval(renewTimer.current)
      renewTimer.current = null
    }
  }

  function startRenewTimer(co: Company, sess: SapSession) {
    stopRenewTimer()
    const ms = renewIntervalMs(sess.sessionTimeout)
    console.log(`[SAP] Auto-renew in ${ms / 60000} min`)

    renewTimer.current = setInterval(async () => {
      console.log('[SAP] Auto-renewing session...')
      try {
        const renewed = await sapLogin(co.databaseName)
        setSession(renewed)
        saveToStorage(renewed, co)
        console.log('[SAP] Session renewed:', renewed.sessionId)
      } catch (err) {
        console.error('[SAP] Auto-renew failed:', err)
        stopRenewTimer()
        clearStorage()
        setStatus('error')
        setErrorMessage('SAP session expired and could not be renewed. Please reconnect.')
      }
    }, ms)
  }

  // ── Restore session on page load/refresh ─────────────────────────────────

  useEffect(() => {
    const stored = loadFromStorage()
    if (stored) {
      console.log('[SAP] Restored session from storage:', stored.session.sessionId)
      setSession(stored.session)
      setCompany(stored.company)
      setStatus('connected')
      startRenewTimer(stored.company, stored.session)
    }
    return () => stopRenewTimer()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Connect ───────────────────────────────────────────────────────────────

  const connect = useCallback(async (selectedCompany: Company): Promise<boolean> => {
    setStatus('connecting')
    setErrorMessage('')
    try {
      const newSession = await sapLogin(selectedCompany.databaseName)
      setSession(newSession)
      setCompany(selectedCompany)
      setStatus('connected')
      saveToStorage(newSession, selectedCompany)
      startRenewTimer(selectedCompany, newSession)
      console.log(`[SAP] Connected to "${selectedCompany.companyName}" (${selectedCompany.databaseName})`)
      return true
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'SAP login failed'
      console.error('[SAP] Login failed:', err)
      setErrorMessage(msg)
      setStatus('error')
      return false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Disconnect ────────────────────────────────────────────────────────────

  const disconnect = useCallback(async () => {
    stopRenewTimer()
    if (session) await sapLogout(session.sessionId)
    clearStorage()
    setSession(null)
    setCompany(null)
    setStatus('disconnected')
    setErrorMessage('')
  }, [session])

  return (
    <SapContext.Provider value={{ session, company, status, errorMessage, connect, disconnect }}>
      {children}
    </SapContext.Provider>
  )
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useSap() {
  const ctx = useContext(SapContext)
  if (!ctx) throw new Error('useSap must be used within SapProvider')
  return ctx
}
