import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { supabaseUserToUser, type User } from '@/lib/auth'

interface AuthContextValue {
  user: User | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<boolean>
  logout: () => void
  updateUser: (updates: Partial<Pick<User, 'name' | 'email'>>) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // ── Bootstrap: read existing session then subscribe to auth changes ──────
  useEffect(() => {
    // Check for an existing session (e.g. after a page refresh)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ? supabaseUserToUser(session.user) : null)
      setIsLoading(false)
    })

    // Keep state in sync whenever the Supabase session changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? supabaseUserToUser(session.user) : null)
    })

    return () => subscription.unsubscribe()
  }, [])

  // ── Login ────────────────────────────────────────────────────────────────
  const login = async (email: string, password: string): Promise<boolean> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return false
    return true
  }

  // ── Logout ───────────────────────────────────────────────────────────────
  const logout = () => {
    supabase.auth.signOut()
    setUser(null)
  }

  // ── Update display name / email ───────────────────────────────────────────
  const updateUser = async (updates: Partial<Pick<User, 'name' | 'email'>>) => {
    const metaUpdate: Record<string, unknown> = {}
    if (updates.name) metaUpdate.full_name = updates.name

    const { data, error } = await supabase.auth.updateUser({
      ...(updates.email ? { email: updates.email } : {}),
      data: metaUpdate,
    })

    if (!error && data.user) {
      setUser(supabaseUserToUser(data.user))
    }
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
