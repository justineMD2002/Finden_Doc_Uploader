import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Database, Loader2, CheckCircle2, AlertCircle, LogOut } from 'lucide-react'
import { COMPANIES } from '@/lib/databases'
import { useSap } from '@/context/SapContext'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import findenLogo from '@/assets/finden_logo.png'
import type { Company } from '@/types/document'

const CompanySelect = () => {
  const { connect, status, errorMessage } = useSap()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [selected, setSelected] = useState<Company | null>(null)

  const handleConnect = async (company: Company) => {
    setSelected(company)
    const ok = await connect(company)
    if (ok) {
      toast.success(`Connected to ${company.companyName}`)
      navigate('/upload-doc')
    } else {
      toast.error('SAP connection failed', { description: errorMessage })
    }
  }

  const handleSignOut = () => {
    logout()
    navigate('/login')
  }

  const connecting = status === 'connecting'

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src={findenLogo} alt="Finden" className="h-10 w-auto" />
            <span className="text-gray-300 text-xs">|</span>
            <span className="text-xs font-semibold text-gray-700">SAP B1 Data Transfer Workbench</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">{user?.email}</span>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg border border-transparent hover:border-red-100 transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-3xl space-y-8">
          {/* Heading */}
          <div className="text-center space-y-2">
            <div className="w-14 h-14 bg-brand-50 border border-brand-200 rounded-2xl flex items-center justify-center mx-auto">
              <Database className="w-7 h-7 text-brand-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Select Company Database</h1>
            <p className="text-sm text-gray-500">
              Choose the SAP B1 company you want to connect to. This session will be used for all data imports.
            </p>
          </div>

          {/* Error banner */}
          {status === 'error' && errorMessage && (
            <div className="flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-700">Connection failed</p>
                <p className="text-xs text-red-600 mt-0.5">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Company grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {COMPANIES.map(company => {
              const isConnecting = connecting && selected?.id === company.id
              const isDisabled   = connecting && selected?.id !== company.id

              return (
                <button
                  key={company.id}
                  onClick={() => !connecting && handleConnect(company)}
                  disabled={isDisabled}
                  className={cn(
                    'flex items-center gap-4 px-5 py-4 rounded-2xl border-2 text-left transition-all',
                    isConnecting
                      ? 'border-brand-500 bg-brand-50'
                      : isDisabled
                      ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                      : 'border-gray-200 bg-white hover:border-brand-300 hover:bg-brand-50/30 hover:shadow-sm',
                  )}
                >
                  {/* Icon */}
                  <div className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                    isConnecting ? 'bg-brand-100' : 'bg-gray-100',
                  )}>
                    {isConnecting
                      ? <Loader2 className="w-5 h-5 text-brand-600 animate-spin" />
                      : <Database className="w-5 h-5 text-gray-500" />
                    }
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      'text-sm font-semibold truncate',
                      isConnecting ? 'text-brand-700' : 'text-gray-900',
                    )}>
                      {company.companyName}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5 font-mono truncate">
                      {company.databaseName}
                    </p>
                  </div>

                  {/* Status */}
                  {isConnecting && (
                    <span className="text-xs font-medium text-brand-600 shrink-0">Connecting...</span>
                  )}
                  {!isConnecting && !isDisabled && (
                    <CheckCircle2 className="w-4 h-4 text-gray-200 shrink-0" />
                  )}
                </button>
              )
            })}
          </div>

          <p className="text-center text-xs text-gray-400">
            Connecting to SAP B1 Service Layer at{' '}
            <span className="font-mono">{import.meta.env.VITE_SAP_BASE_URL}</span>
          </p>
        </div>
      </main>
    </div>
  )
}

export default CompanySelect
