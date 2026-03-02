export interface User {
  id: string
  name: string
  email: string
  role: 'admin' | 'user'
  avatar: string
}

const MOCK_USERS = [
  { id: '1', email: 'admin@pixelcare.com', password: 'admin123', name: 'Admin User', role: 'admin' as const, avatar: 'AU' },
  { id: '2', email: 'user@pixelcare.com', password: 'user123', name: 'John Dela Cruz', role: 'user' as const, avatar: 'JD' },
]

const AUTH_KEY = 'pixelcare_auth_user'

export function login(email: string, password: string): User | null {
  const found = MOCK_USERS.find(u => u.email === email && u.password === password)
  if (!found) return null
  const user: User = { id: found.id, name: found.name, email: found.email, role: found.role, avatar: found.avatar }
  localStorage.setItem(AUTH_KEY, JSON.stringify(user))
  return user
}

export function logout() {
  localStorage.removeItem(AUTH_KEY)
}

export function updateStoredUser(updates: Partial<Pick<User, 'name' | 'email'>>): User | null {
  const current = getStoredUser()
  if (!current) return null
  const newName = updates.name ?? current.name
  const avatar = newName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
  const updated: User = { ...current, ...updates, avatar }
  localStorage.setItem(AUTH_KEY, JSON.stringify(updated))
  return updated
}

export function getStoredUser(): User | null {
  const raw = localStorage.getItem(AUTH_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as User
  } catch {
    return null
  }
}
