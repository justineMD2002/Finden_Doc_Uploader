import { useState, useRef, useCallback } from 'react'
import {
  CheckCircle2, XCircle, AlertTriangle, UploadCloud, Loader2,
  ChevronDown, RotateCcw, FileSpreadsheet, Database, Layers, Send,
} from 'lucide-react'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import { cn } from '@/lib/utils'
import { COMPANIES } from '@/lib/databases'
import { MODULES, validateModuleFile, getSheetNames } from '@/lib/moduleValidator'
import type { ModuleDef, ModuleValidationResult } from '@/lib/moduleValidator'
import type { Company, UploadLog, ValidationError } from '@/types/document'
import { submitToSAP } from '@/lib/mockSap'
import { useAuth } from '@/context/AuthContext'

type PageState = 'idle' | 'sheet_select' | 'validating' | 'validated' | 'submitting' | 'done'

// ─── Step badge ────────────────────────────────────────────────────────────

function StepBadge({ n, active, done }: { n: number; active: boolean; done: boolean }) {
  return (
    <span className={cn(
      'flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold shrink-0 transition-all',
      done ? 'bg-brand-600 text-white'
        : active ? 'bg-brand-100 text-brand-700 ring-2 ring-brand-500'
        : 'bg-gray-100 text-gray-400',
    )}>
      {done ? <CheckCircle2 className="w-4 h-4" /> : n}
    </span>
  )
}

// ─── Select dropdown ───────────────────────────────────────────────────────

interface SelectProps<T extends string> {
  label: string
  placeholder: string
  options: { value: T; label: string; sub?: string }[]
  value: T | null
  onChange: (v: T) => void
  disabled?: boolean
  icon?: React.ReactNode
}

function Select<T extends string>({ label, placeholder, options, value, onChange, disabled, icon }: SelectProps<T>) {
  const [open, setOpen] = useState(false)
  const selected = options.find(o => o.value === value)

  return (
    <div className="relative">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{label}</p>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(v => !v)}
        className={cn(
          'w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-sm transition-all text-left',
          disabled
            ? 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed'
            : open
            ? 'border-brand-400 bg-white shadow-md ring-2 ring-brand-100'
            : 'border-gray-200 bg-white hover:border-brand-300 hover:shadow-sm',
        )}
      >
        {icon && <span className={cn('shrink-0', disabled ? 'text-gray-300' : 'text-brand-500')}>{icon}</span>}
        <span className={cn('flex-1 min-w-0', !selected && 'text-gray-400')}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className={cn('w-4 h-4 text-gray-400 transition-transform shrink-0', open && 'rotate-180')} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <ul className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-lg z-20 max-h-64 overflow-y-auto py-1">
            {options.map(opt => (
              <li key={String(opt.value)}>
                <button
                  type="button"
                  onClick={() => { onChange(opt.value); setOpen(false) }}
                  className={cn(
                    'w-full text-left px-4 py-2.5 text-sm hover:bg-brand-50 transition-colors flex items-start gap-2',
                    opt.value === value && 'bg-brand-50 text-brand-700 font-medium',
                  )}
                >
                  <span className="flex-1">{opt.label}</span>
                  {opt.sub && <span className="text-xs text-gray-400 font-mono shrink-0 mt-0.5">{opt.sub}</span>}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

// ─── Dropzone ──────────────────────────────────────────────────────────────

function Dropzone({ onFile, disabled }: { onFile: (f: File) => void; disabled?: boolean }) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handle = useCallback((file: File | undefined) => {
    if (!file) return
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['xlsx', 'xls', 'csv'].includes(ext ?? '')) return
    onFile(file)
  }, [onFile])

  return (
    <div
      onDragOver={e => { e.preventDefault(); if (!disabled) setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => {
        e.preventDefault(); setDragging(false)
        if (!disabled) handle(e.dataTransfer.files[0])
      }}
      onClick={() => !disabled && inputRef.current?.click()}
      className={cn(
        'rounded-2xl border-2 border-dashed px-8 py-14 flex flex-col items-center gap-3 cursor-pointer select-none transition-all',
        disabled
          ? 'border-gray-100 bg-gray-50 cursor-not-allowed'
          : dragging
          ? 'border-brand-400 bg-brand-50 scale-[1.01]'
          : 'border-gray-200 bg-white hover:border-brand-300 hover:bg-brand-50/30',
      )}
    >
      <div className={cn(
        'w-14 h-14 rounded-2xl flex items-center justify-center',
        dragging ? 'bg-brand-100' : 'bg-gray-100',
      )}>
        <UploadCloud className={cn('w-7 h-7', dragging ? 'text-brand-600' : 'text-gray-400')} />
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-gray-700">
          {dragging ? 'Drop to upload' : 'Drag & drop your file here'}
        </p>
        <p className="text-xs text-gray-400 mt-1">or <span className="text-brand-600 font-medium">browse</span> — .xlsx, .xls, .csv accepted</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={e => handle(e.target.files?.[0])}
      />
    </div>
  )
}

// ─── Validation summary banner ─────────────────────────────────────────────

function ValidationBanner({ result }: { result: ModuleValidationResult }) {
  if (result.passed) {
    return (
      <div className="flex items-center gap-4 px-5 py-4 bg-green-50 border border-green-200 rounded-2xl">
        <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center shrink-0">
          <CheckCircle2 className="w-5 h-5 text-green-600" />
        </div>
        <div>
          <p className="font-semibold text-green-800">Validation Passed</p>
          <p className="text-sm text-green-700 mt-0.5">
            All <span className="font-semibold">{result.totalRows}</span> rows passed — ready to submit.
          </p>
        </div>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-4 px-5 py-4 bg-red-50 border border-red-200 rounded-2xl">
      <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
        <XCircle className="w-5 h-5 text-red-600" />
      </div>
      <div className="flex-1">
        <p className="font-semibold text-red-800">Validation Failed</p>
        <p className="text-sm text-red-700 mt-0.5">
          <span className="font-semibold">{result.totalRows}</span> rows checked —{' '}
          <span className="font-semibold">{result.totalErrors}</span> error{result.totalErrors !== 1 ? 's' : ''} found.
          You can still submit but rows with errors may be rejected.
        </p>
      </div>
      <div className="text-right text-xs text-red-500 shrink-0 font-mono">
        {result.errors.length} cell error{result.errors.length !== 1 ? 's' : ''}
        {result.missingColumns.length > 0 && (
          <><br />{result.missingColumns.length} missing column{result.missingColumns.length !== 1 ? 's' : ''}</>
        )}
      </div>
    </div>
  )
}

// ─── Missing / extra columns panel ────────────────────────────────────────

function ColumnIssuesPanel({ missing, extra }: { missing: string[]; extra: string[] }) {
  if (missing.length === 0 && extra.length === 0) return null
  return (
    <div className="space-y-3">
      {missing.length > 0 && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <XCircle className="w-3.5 h-3.5" /> Missing Required Columns ({missing.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {missing.map(col => (
              <span key={col} className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-mono">{col}</span>
            ))}
          </div>
        </div>
      )}
      {extra.length > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> Unrecognized Columns ({extra.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {extra.map(col => (
              <span key={col} className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-mono">{col}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Error table ───────────────────────────────────────────────────────────

function ErrorTable({ errors }: { errors: ModuleValidationResult['errors'] }) {
  const PAGE = 50
  const [page, setPage] = useState(0)
  const slice = errors.slice(page * PAGE, (page + 1) * PAGE)
  const totalPages = Math.ceil(errors.length / PAGE)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Cell Errors — {errors.length} total
        </p>
        {totalPages > 1 && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              className="px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40">Prev</button>
            <span>Page {page + 1} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1}
              className="px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40">Next</button>
          </div>
        )}
      </div>
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 w-16">Row</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 w-48">Column</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 w-40">Cell Value</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Reason</th>
            </tr>
          </thead>
          <tbody>
            {slice.map((err, i) => (
              <tr key={i} className={cn('border-b border-gray-100 last:border-0', i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50')}>
                <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{err.row}</td>
                <td className="px-4 py-2.5 font-mono text-xs text-brand-700 font-medium">{err.column}</td>
                <td className="px-4 py-2.5 font-mono text-xs text-red-600 max-w-[160px] truncate" title={err.value}>{err.value}</td>
                <td className="px-4 py-2.5 text-xs text-gray-700">{err.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Submit result card ────────────────────────────────────────────────────

function ResultCard({ log, onUploadAnother }: { log: UploadLog; onUploadAnother: () => void }) {
  const isSuccess = log.status === 'SUCCESS'
  const isPartial = log.status === 'PARTIAL'

  return (
    <div className={cn(
      'rounded-2xl border p-6 space-y-4',
      isSuccess ? 'bg-green-50 border-green-200'
        : isPartial ? 'bg-amber-50 border-amber-200'
        : 'bg-red-50 border-red-200',
    )}>
      <div className="flex items-start gap-4">
        <div className={cn(
          'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
          isSuccess ? 'bg-green-100' : isPartial ? 'bg-amber-100' : 'bg-red-100',
        )}>
          {isSuccess
            ? <CheckCircle2 className="w-5 h-5 text-green-600" />
            : <XCircle className="w-5 h-5 text-red-600" />
          }
        </div>
        <div className="flex-1">
          <p className={cn(
            'font-semibold text-base',
            isSuccess ? 'text-green-800' : isPartial ? 'text-amber-800' : 'text-red-800',
          )}>
            {isSuccess ? 'Upload Successful' : isPartial ? 'Partial Upload' : 'Upload Failed'}
          </p>
          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'File', value: log.filename },
              { label: 'Module', value: log.module ?? '—' },
              { label: 'Succeeded', value: log.successCount },
              { label: 'Failed', value: log.failedCount },
            ].map(item => (
              <div key={item.label} className="bg-white/60 rounded-lg p-2.5">
                <p className="text-xs text-gray-500">{item.label}</p>
                <p className="text-sm font-semibold text-gray-800 mt-0.5 truncate">{item.value}</p>
              </div>
            ))}
          </div>
          {log.sapReference && (
            <p className="mt-3 text-xs text-green-700 font-mono bg-green-100 inline-block px-2 py-1 rounded">
              SAP Ref: {log.sapReference}
            </p>
          )}
        </div>
      </div>
      <button
        onClick={onUploadAnother}
        className="px-4 py-2 text-sm font-medium bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
      >
        Upload Another File
      </button>
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────

export default function Validate() {
  const { user } = useAuth()

  const [pageState, setPageState] = useState<PageState>('idle')
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  const [selectedModule, setSelectedModule] = useState<ModuleDef | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [sheetNames, setSheetNames] = useState<string[]>([])
  const [selectedSheet, setSelectedSheet] = useState<string | null>(null)
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([])
  const [validationResult, setValidationResult] = useState<ModuleValidationResult | null>(null)
  const [submitLog, setSubmitLog] = useState<UploadLog | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)

  const dbOptions = COMPANIES.map(c => ({ value: c.id, label: c.companyName, sub: c.databaseName }))
  const moduleOptions = MODULES.map(m => ({ value: m.id, label: m.label }))

  function handleSelectDb(id: string) {
    const company = COMPANIES.find(c => c.id === id) ?? null
    setSelectedCompany(company)
    setSelectedModule(null)
    resetFile()
  }

  function handleSelectModule(id: string) {
    const mod = MODULES.find(m => m.id === id) ?? null
    setSelectedModule(mod)
    resetFile()
  }

  function resetFile() {
    setFile(null)
    setSheetNames([])
    setSelectedSheet(null)
    setRawRows([])
    setValidationResult(null)
    setSubmitLog(null)
    setParseError(null)
    setPageState('idle')
  }

  function handleFullReset() {
    setSelectedCompany(null)
    setSelectedModule(null)
    resetFile()
  }

  async function handleFile(f: File) {
    if (!selectedModule) return
    setFile(f)
    setParseError(null)
    setValidationResult(null)
    setSubmitLog(null)

    try {
      const names = await getSheetNames(f)
      setSheetNames(names)
      if (names.length > 1) {
        setSelectedSheet(names[0])
        setPageState('sheet_select')
      } else {
        setSelectedSheet(names[0])
        await runValidation(f, names[0])
      }
    } catch (err) {
      setParseError(String(err))
      setFile(null)
      setPageState('idle')
    }
  }

  async function runValidation(f: File, sheet: string) {
    if (!selectedModule) return
    setPageState('validating')
    try {
      const buffer = await f.arrayBuffer()
      const wb = XLSX.read(buffer, { cellDates: true })
      const ws = wb.Sheets[sheet]
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null })
      setRawRows(rows)

      const result = await validateModuleFile(f, selectedModule, sheet)
      setValidationResult(result)
      setPageState('validated')
    } catch (err) {
      setParseError(String(err))
      setFile(null)
      setPageState('idle')
    }
  }

  async function handleSubmit() {
    if (!file || !selectedCompany || !selectedModule || !user) return
    setPageState('submitting')

    // Convert ModuleValidationError[] → ValidationError[] for the log
    const legacyErrors: ValidationError[] = (validationResult?.errors ?? []).map(e => ({
      row: e.row,
      column: e.column,
      message: e.reason,
    }))

    try {
      const log = await submitToSAP(
        rawRows,
        legacyErrors,
        file.name,
        user.name,
        selectedCompany.id,
        selectedCompany.databaseName,
        selectedModule.label,
      )
      setSubmitLog(log)
      setPageState('done')

      if (log.status === 'SUCCESS') {
        toast.success('Document uploaded successfully!', {
          description: `SAP Reference: ${log.sapReference} · ${log.successCount} row${log.successCount !== 1 ? 's' : ''} processed`,
          duration: 6000,
        })
      } else if (log.status === 'PARTIAL') {
        toast.warning('Document partially uploaded', {
          description: `${log.successCount} rows succeeded, ${log.failedCount} rows failed.`,
          duration: 6000,
        })
      } else {
        toast.error('Upload failed', {
          description: `${log.failedCount} row${log.failedCount !== 1 ? 's' : ''} failed. Please fix errors and try again.`,
          duration: 8000,
        })
      }
    } catch (err) {
      toast.error('Unexpected error during upload', { description: String(err) })
      setPageState('validated')
    }
  }

  const isLocked = pageState === 'submitting' || pageState === 'done'
  const showUploadArea = !!selectedCompany && !!selectedModule
  const showValidation = pageState === 'validated' || pageState === 'submitting' || pageState === 'done'
  const showChangeFile = pageState === 'validated' || pageState === 'sheet_select'

  const stepDoneDb = !!selectedCompany
  const stepDoneModule = !!selectedModule
  const stepDoneUpload = pageState === 'done'

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Upload Document</h1>
          <p className="text-sm text-gray-500 mt-1">Select a database and module, upload your file, then submit to SAP</p>
        </div>
        {(selectedCompany || selectedModule || file) && (
          <button
            onClick={handleFullReset}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Start Over
          </button>
        )}
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-2">
        {[
          { n: 1, label: 'Database', done: stepDoneDb, active: !stepDoneDb },
          { n: 2, label: 'Module', done: stepDoneModule, active: stepDoneDb && !stepDoneModule },
          { n: 3, label: 'Upload & Validate', done: stepDoneUpload, active: stepDoneModule && !stepDoneUpload },
        ].map((s, i, arr) => (
          <div key={s.n} className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <StepBadge n={s.n} active={s.active} done={s.done} />
              <span className={cn(
                'text-sm font-medium',
                s.active ? 'text-gray-900' : s.done ? 'text-brand-700' : 'text-gray-400',
              )}>{s.label}</span>
            </div>
            {i < arr.length - 1 && <div className="w-8 h-px bg-gray-200 mx-1" />}
          </div>
        ))}
      </div>

      {/* Selection card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Select
            label="Step 1 — Database"
            placeholder="Select a database"
            options={dbOptions}
            value={selectedCompany?.id ?? null}
            onChange={handleSelectDb}
            disabled={isLocked}
            icon={<Database className="w-4 h-4" />}
          />
          <Select
            label="Step 2 — Module"
            placeholder="Select a module"
            options={moduleOptions}
            value={selectedModule?.id ?? null}
            onChange={handleSelectModule}
            disabled={!selectedCompany || isLocked}
            icon={<Layers className="w-4 h-4" />}
          />
        </div>

        {(selectedCompany || selectedModule) && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {selectedCompany && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-brand-50 text-brand-700 rounded-full text-xs font-medium border border-brand-100">
                <Database className="w-3 h-3" />
                {selectedCompany.companyName}
                <span className="text-brand-400 font-mono">({selectedCompany.databaseName})</span>
              </span>
            )}
            {selectedModule && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium border border-indigo-100">
                <Layers className="w-3 h-3" />
                {selectedModule.label}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Upload area */}
      {showUploadArea && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-800">Step 3 — Upload File</h2>
            {showChangeFile && (
              <button
                onClick={resetFile}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Change File
              </button>
            )}
          </div>

          {file && (
            <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl border border-gray-200">
              <FileSpreadsheet className="w-5 h-5 text-brand-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{file.name}</p>
                <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            </div>
          )}

          {/* Dropzone — only when no file yet */}
          {pageState === 'idle' && (
            <Dropzone onFile={handleFile} />
          )}

          {/* Sheet picker — shown when file has multiple sheets */}
          {pageState === 'sheet_select' && sheetNames.length > 1 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 rounded-xl border border-amber-200">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                <span className="text-sm text-amber-700 font-medium">
                  This file has {sheetNames.length} sheets. Select which one to validate.
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {sheetNames.map(name => (
                  <button
                    key={name}
                    onClick={() => setSelectedSheet(name)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium text-left transition-all',
                      selectedSheet === name
                        ? 'border-brand-400 bg-brand-50 text-brand-700 ring-2 ring-brand-100'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-brand-300 hover:bg-brand-50/40',
                    )}
                  >
                    <FileSpreadsheet className="w-4 h-4 shrink-0 text-gray-400" />
                    <span className="truncate">{name}</span>
                  </button>
                ))}
              </div>
              <div className="flex justify-end pt-1">
                <button
                  onClick={() => selectedSheet && runValidation(file!, selectedSheet)}
                  disabled={!selectedSheet}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-40 transition-all"
                >
                  Validate Sheet
                </button>
              </div>
            </div>
          )}

          {pageState === 'validating' && (
            <div className="flex items-center gap-3 px-4 py-3 bg-brand-50 rounded-xl border border-brand-100">
              <Loader2 className="w-4 h-4 text-brand-600 animate-spin" />
              <span className="text-sm text-brand-700 font-medium">
                Validating against {selectedModule?.label} format...
              </span>
            </div>
          )}

          {parseError && (
            <div className="flex items-center gap-3 px-4 py-3 bg-red-50 rounded-xl border border-red-200">
              <XCircle className="w-4 h-4 text-red-500 shrink-0" />
              <span className="text-sm text-red-700">{parseError}</span>
            </div>
          )}

          {/* Submitting indicator */}
          {pageState === 'submitting' && (
            <div className="flex items-center gap-3 px-4 py-3 bg-brand-50 rounded-xl border border-brand-100">
              <Loader2 className="w-4 h-4 text-brand-600 animate-spin" />
              <span className="text-sm text-brand-700 font-medium">
                Submitting to {selectedCompany?.companyName}... Please wait
              </span>
            </div>
          )}
        </div>
      )}

      {/* Validation results + submit */}
      {showValidation && validationResult && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
          <h2 className="text-base font-semibold text-gray-800">Validation Results</h2>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total Rows', value: validationResult.totalRows, color: 'text-gray-800' },
              { label: 'Total Errors', value: validationResult.totalErrors, color: validationResult.totalErrors > 0 ? 'text-red-600' : 'text-green-600' },
              { label: 'Status', value: validationResult.passed ? 'PASSED' : 'FAILED', color: validationResult.passed ? 'text-green-600' : 'text-red-600' },
            ].map(stat => (
              <div key={stat.label} className="p-4 bg-gray-50 rounded-xl text-center border border-gray-100">
                <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">{stat.label}</p>
                <p className={cn('text-2xl font-bold mt-1', stat.color)}>{stat.value}</p>
              </div>
            ))}
          </div>

          <ValidationBanner result={validationResult} />
          <ColumnIssuesPanel missing={validationResult.missingColumns} extra={validationResult.extraColumns} />

          {validationResult.errors.length > 0 && (
            <ErrorTable errors={validationResult.errors} />
          )}

          {/* Submit action */}
          {pageState === 'validated' && (
            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <p className="text-xs">
                {validationResult.passed
                  ? <span className="text-green-600 font-medium">All rows passed. Ready to submit to SAP.</span>
                  : <span className="text-red-600 font-medium">Fix all errors before submitting.</span>
                }
              </p>
              {validationResult.passed && (
                <button
                  onClick={handleSubmit}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold bg-brand-600 hover:bg-brand-700 text-white transition-all shadow-sm"
                >
                  <Send className="w-4 h-4" />
                  Submit to SAP
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Submit result */}
      {pageState === 'done' && submitLog && (
        <ResultCard log={submitLog} onUploadAnother={resetFile} />
      )}

    </div>
  )
}
