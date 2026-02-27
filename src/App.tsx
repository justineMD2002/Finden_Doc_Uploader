import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import Login from '@/pages/Login'
import Upload from '@/pages/Upload'
import Logs from '@/pages/Logs'
import Layout from '@/components/Layout'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-brand-600 border-t-transparent rounded-full animate-spin border-[3px]" />
          <p className="text-sm text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  return <Layout>{children}</Layout>
}

function AppRoutes() {
  const { user } = useAuth()

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/upload" replace /> : <Login />} />
      <Route path="/upload" element={<ProtectedRoute><Upload /></ProtectedRoute>} />
      <Route path="/logs" element={<ProtectedRoute><Logs /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to={user ? '/upload' : '/login'} replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
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
      </AuthProvider>
    </BrowserRouter>
  )
}
