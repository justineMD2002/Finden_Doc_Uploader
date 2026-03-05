import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { sapLogin, sapLogout, type SapSession } from '@/lib/sapService'
import type { Company } from '@/types/document'

// ─── Context value ─────────────────────────────────────────────────────────

type SapStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

interface SapContextValue {
  session: SapSession | null
  company: Company | null
  status: SapStatus
  errorMessage: string
  /** Log into SAP for the given company. Returns true on success. */
  connect: (company: Company) => Promise<boolean>
  /** Log out of SAP and clear session. */
  disconnect: () => Promise<void>
}

const SapContext = createContext<SapContextValue | null>(null)

// ─── Provider ──────────────────────────────────────────────────────────────

export function SapProvider({ children }: { children: ReactNode }) {
  const [session,      setSession]      = useState<SapSession | null>(null)
  const [company,      setCompany]      = useState<Company | null>(null)
  const [status,       setStatus]       = useState<SapStatus>('disconnected')
  const [errorMessage, setErrorMessage] = useState('')

  const connect = useCallback(async (selectedCompany: Company): Promise<boolean> => {
    setStatus('connecting')
    setErrorMessage('')
    try {
      const newSession = await sapLogin(selectedCompany.databaseName)
      setSession(newSession)
      setCompany(selectedCompany)
      setStatus('connected')
      console.log(`[SAP] Successfully connected to "${selectedCompany.companyName}" (${selectedCompany.databaseName})`)
      return true
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'SAP login failed'
      console.error('[SAP] Login failed:', err)
      setErrorMessage(msg)
      setStatus('error')
      return false
    }
  }, [])

  const disconnect = useCallback(async () => {
    if (session) await sapLogout(session.sessionId)
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
