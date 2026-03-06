import { useNavigate } from 'react-router-dom'
import { Building2, ChevronRight, Database } from 'lucide-react'
import findenLogo from '@/assets/finden_logo.png'
import { COMPANIES } from '@/lib/databases'
import { useCompany } from '@/context/CompanyContext'
import { cn } from '@/lib/utils'

export default function CompanySelect() {
  const { company: selected, selectCompany } = useCompany()
  const navigate = useNavigate()

  function handleSelect(c: typeof COMPANIES[0]) {
    selectCompany(c)
  }

  function handleContinue() {
    if (selected) navigate('/upload-doc', { replace: true })
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <img src={findenLogo} alt="Finden" className="h-14 w-auto" />
          <div className="text-center">
            <h1 className="text-xl font-bold text-gray-900">Select Company Database</h1>
            <p className="text-sm text-gray-500 mt-1">Choose the SAP B1 company you want to work with</p>
          </div>
        </div>

        {/* Company grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          {COMPANIES.map(c => {
            const isSelected = selected?.id === c.id
            return (
              <button
                key={c.id}
                onClick={() => handleSelect(c)}
                className={cn(
                  'flex items-start gap-3 p-4 rounded-2xl border-2 text-left transition-all',
                  isSelected
                    ? 'border-brand-500 bg-brand-50 shadow-sm ring-2 ring-brand-100'
                    : 'border-gray-200 bg-white hover:border-brand-300 hover:bg-brand-50/30',
                )}
              >
                <div className={cn(
                  'w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5',
                  isSelected ? 'bg-brand-600' : 'bg-gray-100',
                )}>
                  <Building2 className={cn('w-4 h-4', isSelected ? 'text-white' : 'text-gray-400')} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm font-semibold truncate', isSelected ? 'text-brand-700' : 'text-gray-800')}>
                    {c.companyName}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Database className="w-3 h-3 text-gray-400 shrink-0" />
                    <p className="text-xs text-gray-500 font-mono truncate">{c.databaseName}</p>
                  </div>
                </div>
                {isSelected && (
                  <div className="w-5 h-5 bg-brand-600 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                    <ChevronRight className="w-3 h-3 text-white" />
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {/* Continue */}
        <button
          onClick={handleContinue}
          disabled={!selected}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
        >
          Continue with {selected ? selected.companyName : '—'}
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
