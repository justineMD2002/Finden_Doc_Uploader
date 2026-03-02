import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { login as authLogin, logout as authLogout, getStoredUser, updateStoredUser, type User } from '@/lib/auth'

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

  useEffect(() => {
    const stored = getStoredUser()
    setUser(stored)
    setIsLoading(false)
  }, [])

  const login = async (email: string, password: string): Promise<boolean> => {
    // Simulate async auth
    await new Promise(res => setTimeout(res, 800))
    const result = authLogin(email, password)
    if (result) {
      setUser(result)
      return true
    }
    return false
  }

  const logout = () => {
    authLogout()
    setUser(null)
  }

  const updateUser = (updates: Partial<Pick<User, 'name' | 'email'>>) => {
    const updated = updateStoredUser(updates)
    if (updated) setUser(updated)
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
