import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { COMPANIES } from '@/lib/databases'
import type { Company } from '@/types/document'

const STORAGE_KEY = 'finden_selected_company'

interface CompanyContextValue {
  company: Company | null
  selectCompany: (c: Company) => void
  clearCompany: () => void
}

const CompanyContext = createContext<CompanyContextValue | null>(null)

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [company, setCompany] = useState<Company | null>(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY)
      if (!raw) return null
      const { id } = JSON.parse(raw) as { id: string }
      return COMPANIES.find(c => c.id === id) ?? null
    } catch {
      return null
    }
  })

  useEffect(() => {
    if (company) sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ id: company.id }))
    else sessionStorage.removeItem(STORAGE_KEY)
  }, [company])

  function selectCompany(c: Company) { setCompany(c) }
  function clearCompany() { setCompany(null) }

  return (
    <CompanyContext.Provider value={{ company, selectCompany, clearCompany }}>
      {children}
    </CompanyContext.Provider>
  )
}

export function useCompany() {
  const ctx = useContext(CompanyContext)
  if (!ctx) throw new Error('useCompany must be used within CompanyProvider')
  return ctx
}
