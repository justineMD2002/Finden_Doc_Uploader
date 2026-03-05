import { useState, useRef, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  ClipboardList, LogOut, UploadCloud,
  User, ChevronDown, X, Save, Loader2, Database, RefreshCw,
} from 'lucide-react'
import findenLogo from '@/assets/finden_logo.png'
import { useAuth } from '@/context/AuthContext'
import { useSap } from '@/context/SapContext'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const navItems = [
  { to: '/upload-doc', label: 'Data Import', icon: UploadCloud },
  { to: '/logs', label: 'Import Logs', icon: ClipboardList },
]

// ─── Profile drawer ────────────────────────────────────────────────────────

function ProfileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, updateUser, logout } = useAuth()
  const navigate = useNavigate()

  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [saving, setSaving] = useState(false)

  // Sync fields when user changes or drawer opens
  useEffect(() => {
    if (open) {
      setName(user?.name ?? '')
      setEmail(user?.email ?? '')
    }
  }, [open, user])

  async function handleSave() {
    if (!name.trim() || !email.trim()) return
    setSaving(true)
    await new Promise(res => setTimeout(res, 500)) // simulate async
    updateUser({ name: name.trim(), email: email.trim() })
    setSaving(false)
    toast.success('Profile updated')
  }

  function handleSignOut() {
    logout()
    toast.success('Logged out successfully')
    navigate('/login')
    onClose()
  }

  const initials = user?.avatar ?? '?'
  const dirty = name.trim() !== (user?.name ?? '') || email.trim() !== (user?.email ?? '')

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-30 bg-black/30 transition-opacity duration-300',
          open ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
        onClick={onClose}
      />

      {/* Drawer */}
      <div className={cn(
        'fixed top-0 right-0 h-full w-80 bg-white shadow-2xl z-40 flex flex-col transition-transform duration-300 ease-in-out',
        open ? 'translate-x-0' : 'translate-x-full',
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">My Profile</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Avatar */}
        <div className="flex flex-col items-center gap-3 px-5 py-8 border-b border-gray-100">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white text-2xl font-bold shadow-md select-none">
            {initials}
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-gray-900">{user?.name}</p>
            <p className="text-xs text-gray-400 mt-0.5">{user?.email}</p>
            <span className="mt-2 inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-brand-50 text-brand-700 border border-brand-100 capitalize">
              {user?.role}
            </span>
          </div>
        </div>

        {/* Edit form */}
        <div className="flex-1 overflow-y-auto px-5 py-6 space-y-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Edit Profile</p>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-600">Full Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-400"
              placeholder="Your full name"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-600">Email Address</label>
            <input
              value={email}
              onChange={e => setEmail(e.target.value)}
              type="email"
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-400"
              placeholder="your@email.com"
            />
          </div>

          {/* <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-600">Role</label>
            <div className="px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl text-gray-500 capitalize select-none">
              {user?.role}
            </div>
          </div> */}
        </div>

        {/* Footer actions */}
        <div className="px-5 py-4 border-t border-gray-100 space-y-2">
          <button
            onClick={handleSave}
            disabled={!dirty || saving || !name.trim() || !email.trim()}
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl text-sm font-semibold bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <button
            onClick={handleSignOut}
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 transition-all"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>
    </>
  )
}

// ─── User dropdown ─────────────────────────────────────────────────────────

function UserMenu() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleSignOut() {
    setOpen(false)
    logout()
    toast.success('Logged out successfully')
    navigate('/login')
  }

  return (
    <>
      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen(v => !v)}
          className={cn(
            'flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-colors',
            open ? 'bg-gray-100' : 'hover:bg-gray-50',
          )}
        >
          <div className="w-7 h-7 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-semibold shrink-0">
            {user?.avatar}
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-xs font-medium text-gray-900 leading-tight">{user?.name}</p>
            <p className="text-xs text-gray-400 leading-tight capitalize">{user?.role}</p>
          </div>
          <ChevronDown className={cn('w-3.5 h-3.5 text-gray-400 transition-transform', open && 'rotate-180')} />
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-1.5 w-44 bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-20">
            <button
              onClick={() => { setDrawerOpen(true); setOpen(false) }}
              className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <User className="w-4 h-4 text-gray-400" />
              View Profile
            </button>
            <div className="my-1 border-t border-gray-100" />
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        )}
      </div>

      <ProfileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  )
}

// ─── SAP company badge ─────────────────────────────────────────────────────

function SapBadge() {
  const { company, disconnect } = useSap()
  const navigate = useNavigate()

  async function handleSwitch() {
    await disconnect()
    navigate('/select-company')
  }

  if (!company) return null

  return (
    <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-xl shrink-0">
      <Database className="w-3.5 h-3.5 text-green-600 shrink-0" />
      <div className="leading-tight">
        <p className="text-[10px] text-green-600 font-medium">Connected</p>
        <p className="text-xs font-semibold text-green-800 max-w-[140px] truncate">{company.companyName}</p>
      </div>
      <button
        onClick={handleSwitch}
        title="Switch company"
        className="ml-1 p-1 rounded-md hover:bg-green-100 text-green-600 hover:text-green-800 transition-colors"
      >
        <RefreshCw className="w-3 h-3" />
      </button>
    </div>
  )
}

// ─── Layout ────────────────────────────────────────────────────────────────

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-8 h-20 flex items-center gap-8">
          {/* Logo */}
          <div className="flex items-center gap-2.5 shrink-0">
            <img src={findenLogo} alt="Finden" className="h-16 w-auto" />
            <span className="text-gray-300 text-xs">|</span>
            <div className="flex flex-col leading-tight">
              <span className="text-xs font-semibold text-gray-700">SAP B1 Data Transfer Workbench</span>
              <span className="text-[10px] text-gray-400">Web</span>
            </div>
          </div>

          {/* Nav links */}
          <nav className="flex items-center gap-1 flex-1">
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150',
                    isActive
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className={cn('w-4 h-4', isActive ? 'text-brand-600' : 'text-gray-400')} />
                    {label}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          {/* SAP company badge */}
          <SapBadge />

          {/* User menu */}
          <UserMenu />
        </div>
      </header>

      <main className="flex-1">
        {children}
      </main>
    </div>
  )
}
