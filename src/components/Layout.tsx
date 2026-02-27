import { NavLink, useNavigate } from 'react-router-dom'
import { UploadCloud, ClipboardList, LogOut, FileSpreadsheet } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const navItems = [
  { to: '/upload', label: 'Upload Document', icon: UploadCloud },
  { to: '/logs', label: 'Upload Logs', icon: ClipboardList },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    toast.success('Logged out successfully')
    navigate('/login')
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col fixed h-full z-10 shadow-sm">
        {/* Logo */}
        <div className="px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-600 to-brand-800 flex items-center justify-center shadow">
              <FileSpreadsheet className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-700 text-gray-900 font-semibold leading-tight">Pixelcare</p>
              <p className="text-xs text-gray-400">Doc Uploader</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                  isActive
                    ? 'bg-brand-50 text-brand-700 shadow-sm'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
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

        {/* User footer */}
        <div className="px-3 py-4 border-t border-gray-100">
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg">
            <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
              {user?.avatar}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
              <p className="text-xs text-gray-400 truncate">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="mt-2 flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 ml-64 min-h-screen">
        {children}
      </main>
    </div>
  )
}
