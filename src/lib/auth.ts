// ─── User type ───────────────────────────────────────────────────────────────
// This is the application-level user shape used throughout the UI.
// It is derived from the Supabase Auth user inside AuthContext.

export interface User {
  id: string
  name: string
  email: string
  role: 'admin' | 'user'
  avatar: string  // two-letter initials
}

// ─── Supabase → User mapper ──────────────────────────────────────────────────

import type { User as SupabaseAuthUser } from '@supabase/supabase-js'

export const supabaseUserToUser = (supabaseUser: SupabaseAuthUser): User => {
  const name: string =
    supabaseUser.user_metadata?.full_name ??
    supabaseUser.email ??
    'Unknown'

  const role: 'admin' | 'user' =
    supabaseUser.user_metadata?.role === 'admin' ? 'admin' : 'user'

  const avatar = name
    .split(' ')
    .map((w: string) => w[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return {
    id: supabaseUser.id,
    name,
    email: supabaseUser.email ?? '',
    role,
    avatar,
  }
}

// ─── Deprecated stubs (kept so existing imports don't break) ─────────────────
// These functions were part of the old mock-auth system.
// They are no-ops now; authentication is handled by Supabase in AuthContext.

/** @deprecated Use Supabase auth via AuthContext instead */
export const login = (_email: string, _password: string): User | null => {
  return null
}

/** @deprecated Use Supabase auth via AuthContext instead */
export const logout = (): void => {
  // no-op
}

/** @deprecated Session is now managed by Supabase */
export const getStoredUser = (): User | null => {
  return null
}

/** @deprecated User updates go through supabase.auth.updateUser() */
export const updateStoredUser = (
  _updates: Partial<Pick<User, 'name' | 'email'>>,
): User | null => {
  return null
}
