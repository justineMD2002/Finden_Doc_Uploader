import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { SapProvider, useSap } from '@/context/SapContext'
import Login from '@/pages/Login'
import Logs from '@/pages/Logs'
import Import from '@/pages/Import'
import Copy from '@/pages/Copy'
import CompanySelect from '@/pages/CompanySelect'
import Layout from '@/components/Layout'

// ─── Guards ────────────────────────────────────────────────────────────────

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useAuth()
  const { status } = useSap()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-[3px] border-brand-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  // Not logged in → login page
  if (!user) return <Navigate to="/login" replace />

  // Logged in but no SAP session → company selection
  if (status !== 'connected') return <Navigate to="/select-company" replace />

  return <Layout>{children}</Layout>
}

// ─── Routes ────────────────────────────────────────────────────────────────

const AppRoutes = () => {
  const { user } = useAuth()
  const { status } = useSap()

  // Helper: where to send an authenticated user
  const defaultPath = status === 'connected' ? '/upload-doc' : '/select-company'

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to={defaultPath} replace /> : <Login />}
      />
      <Route
        path="/select-company"
        element={
          !user
            ? <Navigate to="/login" replace />
            : status === 'connected'
            ? <Navigate to="/upload-doc" replace />
            : <CompanySelect />
        }
      />
      <Route path="/logs"       element={<ProtectedRoute><Logs /></ProtectedRoute>} />
      <Route path="/upload-doc" element={<ProtectedRoute><Import /></ProtectedRoute>} />
      <Route path="/copy"       element={<ProtectedRoute><Copy /></ProtectedRoute>} />
      <Route path="*"           element={<Navigate to={user ? defaultPath : '/login'} replace />} />
    </Routes>
  )
}

// ─── App ───────────────────────────────────────────────────────────────────

const App = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SapProvider>
          <AppRoutes />
          <Toaster
            position="top-right"
            richColors
            expand
            closeButton
            toastOptions={{
              style: { fontFamily: 'Inter, system-ui, sans-serif' },
            }}
          />
        </SapProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
