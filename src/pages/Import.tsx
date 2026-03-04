import { useState, useRef, useCallback } from 'react'
import {
  TrendingUp, ShoppingCart, Package, ChevronRight, ChevronLeft,
  UploadCloud, FileSpreadsheet, X, CheckCircle2, XCircle, Loader2,
  ArrowRight, AlertTriangle, FlaskConical, Send, RotateCcw, Check,
  AlertCircle,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  BIZ_CATEGORIES, BIZ_OBJECTS,
  type BizCategory, type BizObject,
  type MappingRow, type ErrorHandlingMode,
  type UploadedFile, type WizardStep, type ImportResult,
} from '@/types/wizard'

// ─── Helpers ───────────────────────────────────────────────────────────────

function categoryIcon(id: BizCategory) {
  if (id === 'sales')      return <TrendingUp className="w-5 h-5" />
  if (id === 'purchasing') return <ShoppingCart className="w-5 h-5" />
  return <Package className="w-5 h-5" />
}

async function readFileColumns(file: File): Promise<{ columns: string[]; rowCount: number }> {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null })
  const columns = rows.length > 0 ? Object.keys(rows[0]) : []
  return { columns, rowCount: rows.length }
}

function buildInitialMappings(
  docCols: string[],
  linesCols: string[],
): MappingRow[] {
  return [
    ...docCols.map(c => ({ sourceField: c, targetField: '', tab: 'doc' as const })),
    ...linesCols.map(c => ({ sourceField: c, targetField: '', tab: 'lines' as const })),
  ]
}

// ─── Progress bar ──────────────────────────────────────────────────────────

const STEP_LABELS = [
  'Business Object',
  'Upload Files',
  'Field Mapping',
  'Error Handling',
  'Import',
]

function WizardProgress({ step }: { step: WizardStep }) {
  return (
    <div className="flex items-center gap-0">
      {STEP_LABELS.map((label, i) => {
        const n = (i + 1) as WizardStep
        const done = step > n
        const active = step === n
        return (
          <div key={n} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all border-2',
                done  ? 'bg-brand-600 border-brand-600 text-white'
                      : active ? 'bg-white border-brand-500 text-brand-600 ring-4 ring-brand-100'
                      : 'bg-white border-gray-200 text-gray-400',
              )}>
                {done ? <Check className="w-4 h-4" /> : n}
              </div>
              <span className={cn(
                'text-xs font-medium whitespace-nowrap',
                done ? 'text-brand-600' : active ? 'text-gray-900' : 'text-gray-400',
              )}>{label}</span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div className={cn(
                'h-0.5 w-12 sm:w-20 mx-1 mb-5 transition-colors',
                step > n ? 'bg-brand-500' : 'bg-gray-200',
              )} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Step 1 — Business Object ──────────────────────────────────────────────

function StepBusinessObject({
  selected,
  onSelect,
  onNext,
}: {
  selected: BizObject | null
  onSelect: (o: BizObject) => void
  onNext: () => void
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Select Business Object</h2>
        <p className="text-sm text-gray-500 mt-1">
          Choose the SAP B1 document type you want to import data into.
        </p>
      </div>

      <div className="space-y-5">
        {BIZ_CATEGORIES.map(cat => {
          const objects = BIZ_OBJECTS.filter(o => o.category === cat.id)
          return (
            <div key={cat.id}>
              {/* Category header */}
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
                  {categoryIcon(cat.id)}
                </div>
                <h3 className="text-sm font-semibold text-gray-700">{cat.label}</h3>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pl-2">
                {objects.map(obj => {
                  const isSelected = selected?.id === obj.id
                  return (
                    <button
                      key={obj.id}
                      type="button"
                      onClick={() => onSelect(obj)}
                      className={cn(
                        'text-left px-4 py-3.5 rounded-xl border-2 text-sm font-medium transition-all',
                        isSelected
                          ? 'border-brand-500 bg-brand-50 text-brand-700 shadow-sm ring-2 ring-brand-100'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-brand-300 hover:bg-brand-50/40',
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="leading-snug">{obj.label}</span>
                        {isSelected && (
                          <div className="w-5 h-5 bg-brand-600 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="flex justify-end pt-2">
        <button
          onClick={onNext}
          disabled={!selected}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
        >
          Next <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// ─── Dropzone (compact) ────────────────────────────────────────────────────

function UploadDropzone({
  label,
  uploaded,
  onFile,
  onRemove,
  disabled,
}: {
  label: string
  uploaded: UploadedFile | null
  onFile: (f: File) => void
  onRemove: () => void
  disabled?: boolean
}) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handle = useCallback((f: File | undefined) => {
    if (!f) return
    const ext = f.name.split('.').pop()?.toLowerCase()
    if (!['xlsx', 'xls', 'csv'].includes(ext ?? '')) {
      toast.error('Invalid file type. Use .xlsx, .xls, or .csv')
      return
    }
    onFile(f)
  }, [onFile])

  if (uploaded) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-green-50 border border-green-200 rounded-xl">
        <FileSpreadsheet className="w-5 h-5 text-green-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 truncate">{uploaded.file.name}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {uploaded.rowCount} rows · {uploaded.columns.length} columns
          </p>
        </div>
        {!disabled && (
          <button
            onClick={onRemove}
            className="p-1.5 rounded-lg hover:bg-green-100 text-green-700 hover:text-green-900 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    )
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); if (!disabled) setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => {
        e.preventDefault()
        setDragging(false)
        if (!disabled) handle(e.dataTransfer.files[0])
      }}
      onClick={() => !disabled && inputRef.current?.click()}
      className={cn(
        'rounded-xl border-2 border-dashed px-6 py-8 flex flex-col items-center gap-2 cursor-pointer select-none transition-all',
        disabled
          ? 'border-gray-100 bg-gray-50 cursor-not-allowed opacity-50'
          : dragging
          ? 'border-brand-400 bg-brand-50 scale-[1.01]'
          : 'border-gray-200 bg-white hover:border-brand-300 hover:bg-brand-50/30',
      )}
    >
      <div className={cn(
        'w-10 h-10 rounded-xl flex items-center justify-center',
        dragging ? 'bg-brand-100' : 'bg-gray-100',
      )}>
        <UploadCloud className={cn('w-5 h-5', dragging ? 'text-brand-600' : 'text-gray-400')} />
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-gray-700">
          {dragging ? 'Drop to upload' : `Upload ${label}`}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">
          Drag & drop or <span className="text-brand-600 font-medium">browse</span>
        </p>
        <p className="text-xs text-gray-300 mt-0.5">.xlsx · .xls · .csv</p>
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

// ─── Step 2 — Upload Files ──────────────────────────────────────────────────

function StepUploadFiles({
  bizObject,
  docFile,
  linesFile,
  onDocFile,
  onLinesFile,
  onDocRemove,
  onLinesRemove,
  onNext,
  onBack,
}: {
  bizObject: BizObject
  docFile: UploadedFile | null
  linesFile: UploadedFile | null
  onDocFile: (f: File) => Promise<void>
  onLinesFile: (f: File) => Promise<void>
  onDocRemove: () => void
  onLinesRemove: () => void
  onNext: () => void
  onBack: () => void
}) {
  const [activeTab, setActiveTab] = useState<'doc' | 'lines'>('doc')
  const [loading, setLoading] = useState<'doc' | 'lines' | null>(null)

  const [docLabel, linesLabel] = bizObject.tabLabels ?? ['Document', 'Document Lines']

  async function handleDocFile(f: File) {
    setLoading('doc')
    try { await onDocFile(f) } finally { setLoading(null) }
  }
  async function handleLinesFile(f: File) {
    setLoading('lines')
    try { await onLinesFile(f) } finally { setLoading(null) }
  }

  const bothUploaded = !!docFile && !!linesFile

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Upload Files</h2>
        <p className="text-sm text-gray-500 mt-1">
          Upload the <span className="font-medium text-gray-700">{docLabel}</span> and{' '}
          <span className="font-medium text-gray-700">{linesLabel}</span> files for{' '}
          <span className="font-medium text-brand-700">{bizObject.label}</span>.
          Both files are required.
        </p>
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { tab: 'doc' as const, label: docLabel, file: docFile },
          { tab: 'lines' as const, label: linesLabel, file: linesFile },
        ].map(({ tab, label, file }) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all',
              activeTab === tab
                ? 'border-brand-400 bg-brand-50'
                : 'border-gray-200 bg-white hover:border-gray-300',
            )}
          >
            <div className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
              file ? 'bg-green-100' : 'bg-gray-100',
            )}>
              {file
                ? <CheckCircle2 className="w-4 h-4 text-green-600" />
                : <UploadCloud className="w-4 h-4 text-gray-400" />
              }
            </div>
            <div className="min-w-0">
              <p className={cn(
                'text-sm font-semibold',
                activeTab === tab ? 'text-brand-700' : 'text-gray-700',
              )}>{label}</p>
              <p className="text-xs text-gray-400 truncate mt-0.5">
                {file ? `${file.rowCount} rows · ${file.columns.length} cols` : 'Not uploaded'}
              </p>
            </div>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-gray-50 rounded-2xl border border-gray-200 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">
            {activeTab === 'doc' ? docLabel : linesLabel}
          </h3>
          {loading === activeTab && (
            <div className="flex items-center gap-2 text-xs text-brand-600">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Reading file...
            </div>
          )}
        </div>

        {activeTab === 'doc'
          ? <UploadDropzone
              label={docLabel}
              uploaded={docFile}
              onFile={handleDocFile}
              onRemove={onDocRemove}
              disabled={loading !== null}
            />
          : <UploadDropzone
              label={linesLabel}
              uploaded={linesFile}
              onFile={handleLinesFile}
              onRemove={onLinesRemove}
              disabled={loading !== null}
            />
        }

        {/* Column preview */}
        {(activeTab === 'doc' ? docFile : linesFile) && (
          <div className="mt-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Detected Columns
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(activeTab === 'doc' ? docFile : linesFile)!.columns.map(col => (
                <span
                  key={col}
                  className="px-2 py-0.5 bg-white border border-gray-200 rounded text-xs font-mono text-gray-600"
                >
                  {col}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {!bothUploaded && (
        <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
          <p className="text-sm text-amber-700">
            Both <span className="font-semibold">{docLabel}</span> and{' '}
            <span className="font-semibold">{linesLabel}</span> files are required to proceed.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 border border-gray-200 transition-all"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <button
          onClick={onNext}
          disabled={!bothUploaded}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
        >
          Next <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// ─── Step 3 — Field Mapping ────────────────────────────────────────────────

function StepFieldMapping({
  bizObject,
  mappings,
  onMappingChange,
  onNext,
  onBack,
}: {
  bizObject: BizObject
  mappings: MappingRow[]
  onMappingChange: (updated: MappingRow[]) => void
  onNext: () => void
  onBack: () => void
}) {
  const [activeTab, setActiveTab] = useState<'doc' | 'lines'>('doc')
  const [docLabel, linesLabel] = bizObject.tabLabels ?? ['Document', 'Document Lines']

  const visible = mappings.filter(m => m.tab === activeTab)

  function updateTarget(idx: number, value: string) {
    // idx is index within visible; find in full mappings
    const fullIdx = mappings.findIndex(
      (m, i) => m.tab === activeTab && mappings.filter(x => x.tab === activeTab).indexOf(m) === idx
    )
    // Safer: filter first, then find
    const visibleRows = mappings.filter(m => m.tab === activeTab)
    const sourceField = visibleRows[idx].sourceField
    const updated = mappings.map(m =>
      m.tab === activeTab && m.sourceField === sourceField
        ? { ...m, targetField: value }
        : m
    )
    onMappingChange(updated)
  }

  const mappedCount = mappings.filter(m => m.targetField.trim() !== '').length
  const totalCount = mappings.length

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Field Mapping</h2>
          <p className="text-sm text-gray-500 mt-1">
            Map your source columns (from the uploaded file) to the corresponding SAP B1 target fields.
          </p>
        </div>
        <div className="text-right shrink-0">
          <span className={cn(
            'text-sm font-semibold',
            mappedCount === totalCount ? 'text-green-600' : 'text-amber-600',
          )}>
            {mappedCount} / {totalCount}
          </span>
          <p className="text-xs text-gray-400">fields mapped</p>
        </div>
      </div>

      {/* Info banner about mapping */}
      <div className="flex items-start gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl">
        <AlertCircle className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
        <p className="text-sm text-blue-700">
          SAP B1 target field definitions will be provided in a future update.
          You can pre-configure the mapping and update target fields when they become available.
        </p>
      </div>

      {/* Tab selector */}
      <div className="flex gap-2 border-b border-gray-200">
        {[
          { tab: 'doc' as const, label: docLabel },
          { tab: 'lines' as const, label: linesLabel },
        ].map(({ tab, label }) => {
          const count = mappings.filter(m => m.tab === tab).length
          const mapped = mappings.filter(m => m.tab === tab && m.targetField.trim()).length
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
                activeTab === tab
                  ? 'border-brand-500 text-brand-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700',
              )}
            >
              {label}
              <span className={cn(
                'ml-2 px-1.5 py-0.5 rounded text-xs font-semibold',
                mapped === count ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500',
              )}>
                {mapped}/{count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Mapping table */}
      <div className="overflow-hidden rounded-xl border border-gray-200">
        <div className="grid grid-cols-[1fr_40px_1fr] bg-gray-50 border-b border-gray-200 px-4 py-2.5">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Source Field</span>
          <span />
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">SAP B1 Target Field</span>
        </div>
        <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
          {visible.map((row, idx) => (
            <div
              key={`${row.tab}-${row.sourceField}`}
              className="grid grid-cols-[1fr_40px_1fr] items-center px-4 py-2.5 hover:bg-gray-50/50 transition-colors"
            >
              {/* Source */}
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 bg-brand-50 border border-brand-100 rounded text-xs font-mono text-brand-700 truncate max-w-[200px]">
                  {row.sourceField}
                </span>
              </div>

              {/* Arrow */}
              <div className="flex items-center justify-center">
                <ArrowRight className={cn(
                  'w-4 h-4',
                  row.targetField ? 'text-brand-500' : 'text-gray-300',
                )} />
              </div>

              {/* Target */}
              <input
                type="text"
                value={row.targetField}
                onChange={e => updateTarget(idx, e.target.value)}
                placeholder="SAP field name..."
                className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400 bg-white placeholder:text-gray-300 font-mono"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 border border-gray-200 transition-all"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <button
          onClick={onNext}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-brand-600 text-white hover:bg-brand-700 transition-all shadow-sm"
        >
          Next <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// ─── Step 4 — Error Handling ────────────────────────────────────────────────

const ERROR_HANDLING_OPTIONS: {
  value: ErrorHandlingMode
  label: string
  description: string
  icon: React.ReactNode
  color: string
}[] = [
  {
    value: 'cancel_rollback',
    label: 'Cancel Import & Perform Rollback',
    description:
      'If one or more errors occur during import, the entire import will be cancelled and all changes will be rolled back. This ensures data integrity.',
    icon: <XCircle className="w-5 h-5" />,
    color: 'red',
  },
  {
    value: 'ignore_all',
    label: 'Ignore All Errors',
    description:
      'Skip all records that have errors and continue importing the valid records. The import will complete even if some records fail.',
    icon: <AlertTriangle className="w-5 h-5" />,
    color: 'amber',
  },
  {
    value: 'ignore_up_to_10',
    label: 'Ignore Up to 10 Errors',
    description:
      'If there are up to 10 errors, skip those records and continue importing the rest. If errors exceed 10, cancel and roll back.',
    icon: <AlertCircle className="w-5 h-5" />,
    color: 'blue',
  },
]

function StepErrorHandling({
  errorHandling,
  onChange,
  onNext,
  onBack,
}: {
  errorHandling: ErrorHandlingMode
  onChange: (v: ErrorHandlingMode) => void
  onNext: () => void
  onBack: () => void
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Error Handling</h2>
        <p className="text-sm text-gray-500 mt-1">
          Choose how the import process should behave when errors are encountered.
        </p>
      </div>

      <div className="space-y-3">
        {ERROR_HANDLING_OPTIONS.map(opt => {
          const isSelected = errorHandling === opt.value
          const colorMap: Record<string, string> = {
            red: isSelected
              ? 'border-red-400 bg-red-50 ring-2 ring-red-100'
              : 'border-gray-200 hover:border-red-200 hover:bg-red-50/30',
            amber: isSelected
              ? 'border-amber-400 bg-amber-50 ring-2 ring-amber-100'
              : 'border-gray-200 hover:border-amber-200 hover:bg-amber-50/30',
            blue: isSelected
              ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-100'
              : 'border-gray-200 hover:border-blue-200 hover:bg-blue-50/30',
          }
          const iconColorMap: Record<string, string> = {
            red: 'text-red-500',
            amber: 'text-amber-500',
            blue: 'text-blue-500',
          }

          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={cn(
                'w-full text-left flex items-start gap-4 px-5 py-4 rounded-xl border-2 transition-all',
                colorMap[opt.color],
              )}
            >
              <div className={cn('shrink-0 mt-0.5', iconColorMap[opt.color])}>
                {opt.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-gray-900">{opt.label}</p>
                  <div className={cn(
                    'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all',
                    isSelected
                      ? 'border-brand-600 bg-brand-600'
                      : 'border-gray-300 bg-white',
                  )}>
                    {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                </div>
                <p className="text-sm text-gray-500 mt-1">{opt.description}</p>
              </div>
            </button>
          )
        })}
      </div>

      <div className="flex items-center justify-between pt-2">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 border border-gray-200 transition-all"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <button
          onClick={onNext}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-brand-600 text-white hover:bg-brand-700 transition-all shadow-sm"
        >
          Next <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// ─── Step 5 — Import ────────────────────────────────────────────────────────

function errorHandlingLabel(mode: ErrorHandlingMode) {
  return ERROR_HANDLING_OPTIONS.find(o => o.value === mode)?.label ?? mode
}

async function mockRunImport(
  mode: 'test' | 'import',
  docFile: UploadedFile,
  linesFile: UploadedFile,
  errorHandling: ErrorHandlingMode,
): Promise<ImportResult> {
  await new Promise(r => setTimeout(r, 1800))
  const total = docFile.rowCount
  // Simulate ~5% error rate
  const failedCount = Math.floor(total * 0.05)
  const successCount = total - failedCount

  let status: ImportResult['status'] = 'success'
  if (failedCount > 0 && errorHandling === 'cancel_rollback') status = 'failed'
  else if (failedCount > 0) status = 'partial'

  const errors = Array.from({ length: Math.min(failedCount, 5) }, (_, i) => ({
    row: i * 3 + 2,
    field: docFile.columns[i % docFile.columns.length] ?? 'Unknown',
    message: 'Value does not match SAP field format',
  }))

  return {
    mode,
    status: mode === 'test' ? (failedCount === 0 ? 'success' : 'partial') : status,
    totalRecords: total,
    successCount: mode === 'test' ? successCount : (status === 'failed' ? 0 : successCount),
    failedCount: mode === 'test' ? failedCount : (status === 'failed' ? total : failedCount),
    errors,
    sapReference: mode === 'import' && status !== 'failed'
      ? `SAP-${Date.now().toString(36).toUpperCase()}`
      : undefined,
    timestamp: new Date().toISOString(),
  }
}

function ImportResultPanel({
  result,
  onReset,
}: {
  result: ImportResult
  onReset: () => void
}) {
  const isTest = result.mode === 'test'
  const ok = result.status === 'success'
  const partial = result.status === 'partial'

  const colorClass = ok
    ? 'bg-green-50 border-green-200'
    : partial
    ? 'bg-amber-50 border-amber-200'
    : 'bg-red-50 border-red-200'

  const iconEl = ok
    ? <CheckCircle2 className="w-5 h-5 text-green-600" />
    : partial
    ? <AlertTriangle className="w-5 h-5 text-amber-600" />
    : <XCircle className="w-5 h-5 text-red-600" />

  const titleColor = ok ? 'text-green-800' : partial ? 'text-amber-800' : 'text-red-800'

  const title = isTest
    ? ok ? 'Test Import Passed' : partial ? 'Test Import — Partial Issues' : 'Test Import Failed'
    : ok ? 'Import Successful' : partial ? 'Partial Import' : 'Import Failed'

  return (
    <div className={cn('rounded-2xl border p-6 space-y-4', colorClass)}>
      <div className="flex items-start gap-4">
        <div className={cn(
          'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
          ok ? 'bg-green-100' : partial ? 'bg-amber-100' : 'bg-red-100',
        )}>
          {iconEl}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            {isTest && (
              <span className="px-2 py-0.5 text-xs font-bold bg-purple-100 text-purple-700 rounded border border-purple-200 uppercase tracking-wide">
                Test Only
              </span>
            )}
            <p className={cn('font-bold text-base', titleColor)}>{title}</p>
          </div>

          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total Records', value: result.totalRecords },
              { label: 'Succeeded', value: result.successCount },
              { label: 'Failed', value: result.failedCount },
              {
                label: result.sapReference ? 'SAP Reference' : 'Timestamp',
                value: result.sapReference
                  ? result.sapReference
                  : new Date(result.timestamp).toLocaleTimeString(),
              },
            ].map(stat => (
              <div key={stat.label} className="bg-white/70 rounded-lg p-2.5">
                <p className="text-xs text-gray-500">{stat.label}</p>
                <p className="text-sm font-semibold text-gray-800 mt-0.5 truncate">{stat.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {result.errors.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-white/80">
          <div className="bg-white/40 px-4 py-2 border-b border-white/80">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
              Errors ({result.errors.length})
            </p>
          </div>
          <div className="divide-y divide-white/60">
            {result.errors.map((err, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-2.5 bg-white/30 text-xs">
                <span className="font-mono text-gray-500 w-12 shrink-0">Row {err.row}</span>
                <span className="font-mono text-brand-700 w-36 shrink-0 truncate">{err.field}</span>
                <span className="text-gray-700">{err.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={onReset}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
      >
        <RotateCcw className="w-4 h-4" /> Start New Import
      </button>
    </div>
  )
}

function StepImport({
  bizObject,
  docFile,
  linesFile,
  mappings,
  errorHandling,
  result,
  onResult,
  onBack,
  onReset,
}: {
  bizObject: BizObject
  docFile: UploadedFile
  linesFile: UploadedFile
  mappings: MappingRow[]
  errorHandling: ErrorHandlingMode
  result: ImportResult | null
  onResult: (r: ImportResult) => void
  onBack: () => void
  onReset: () => void
}) {
  const [running, setRunning] = useState<'test' | 'import' | null>(null)
  const [docLabel, linesLabel] = bizObject.tabLabels ?? ['Document', 'Document Lines']

  const mappedCount = mappings.filter(m => m.targetField.trim()).length

  async function run(mode: 'test' | 'import') {
    setRunning(mode)
    try {
      const r = await mockRunImport(mode, docFile, linesFile, errorHandling)
      onResult(r)
      if (mode === 'import') {
        if (r.status === 'success') toast.success('Import completed successfully!', { description: `SAP Ref: ${r.sapReference}` })
        else if (r.status === 'partial') toast.warning('Import partially completed', { description: `${r.successCount} succeeded, ${r.failedCount} failed.` })
        else toast.error('Import failed', { description: `${r.failedCount} records failed.` })
      } else {
        if (r.status === 'success') toast.success('Test import passed — no errors found.')
        else toast.warning('Test import found issues', { description: `${r.failedCount} records would fail.` })
      }
    } finally {
      setRunning(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Import</h2>
        <p className="text-sm text-gray-500 mt-1">
          Review the import configuration and run a test or start the actual import.
        </p>
      </div>

      {/* Configuration summary */}
      <div className="bg-gray-50 rounded-2xl border border-gray-200 p-5 space-y-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Import Configuration</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
            <p className="text-xs text-gray-400 mb-1">Business Object</p>
            <p className="font-semibold text-gray-800">{bizObject.label}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
            <p className="text-xs text-gray-400 mb-1">Error Handling</p>
            <p className="font-semibold text-gray-800">{errorHandlingLabel(errorHandling)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
            <p className="text-xs text-gray-400 mb-1">{docLabel}</p>
            <p className="font-medium text-gray-700 truncate">{docFile.file.name}</p>
            <p className="text-xs text-gray-400 mt-0.5">{docFile.rowCount} rows</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
            <p className="text-xs text-gray-400 mb-1">{linesLabel}</p>
            <p className="font-medium text-gray-700 truncate">{linesFile.file.name}</p>
            <p className="text-xs text-gray-400 mt-0.5">{linesFile.rowCount} rows</p>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <span className={cn(
            'text-xs font-medium px-2.5 py-1 rounded-full',
            mappedCount === mappings.length
              ? 'bg-green-100 text-green-700'
              : 'bg-amber-100 text-amber-700',
          )}>
            {mappedCount}/{mappings.length} fields mapped
          </span>
          {mappedCount < mappings.length && (
            <span className="text-xs text-amber-600">
              — Unmapped fields will be skipped during import.
            </span>
          )}
        </div>
      </div>

      {/* Action buttons */}
      {!result && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Test Import */}
          <button
            onClick={() => run('test')}
            disabled={running !== null}
            className={cn(
              'flex flex-col items-center gap-3 px-6 py-6 rounded-2xl border-2 transition-all font-medium',
              running === 'test'
                ? 'border-purple-400 bg-purple-50'
                : 'border-purple-200 bg-white hover:border-purple-400 hover:bg-purple-50',
              running !== null && running !== 'test' && 'opacity-50 cursor-not-allowed',
            )}
          >
            <div className="w-12 h-12 rounded-2xl bg-purple-100 flex items-center justify-center">
              {running === 'test'
                ? <Loader2 className="w-6 h-6 text-purple-600 animate-spin" />
                : <FlaskConical className="w-6 h-6 text-purple-600" />
              }
            </div>
            <div className="text-center">
              <p className="font-semibold text-gray-800">
                {running === 'test' ? 'Running test...' : 'Test Import'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Validate data without making changes to SAP
              </p>
            </div>
          </button>

          {/* Import Now */}
          <button
            onClick={() => run('import')}
            disabled={running !== null}
            className={cn(
              'flex flex-col items-center gap-3 px-6 py-6 rounded-2xl border-2 transition-all font-medium',
              running === 'import'
                ? 'border-brand-500 bg-brand-50'
                : 'border-brand-300 bg-white hover:border-brand-500 hover:bg-brand-50',
              running !== null && running !== 'import' && 'opacity-50 cursor-not-allowed',
            )}
          >
            <div className="w-12 h-12 rounded-2xl bg-brand-100 flex items-center justify-center">
              {running === 'import'
                ? <Loader2 className="w-6 h-6 text-brand-600 animate-spin" />
                : <Send className="w-6 h-6 text-brand-600" />
              }
            </div>
            <div className="text-center">
              <p className="font-semibold text-gray-800">
                {running === 'import' ? 'Importing...' : 'Import Now'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Import data directly into SAP B1
              </p>
            </div>
          </button>
        </div>
      )}

      {/* Result */}
      {result && (
        <ImportResultPanel result={result} onReset={onReset} />
      )}

      {!result && (
        <div className="flex items-center pt-2">
          <button
            onClick={onBack}
            disabled={running !== null}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 border border-gray-200 transition-all disabled:opacity-40"
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────

export default function Import() {
  const [step, setStep] = useState<WizardStep>(1)
  const [bizObject, setBizObject] = useState<BizObject | null>(null)
  const [docFile, setDocFile] = useState<UploadedFile | null>(null)
  const [linesFile, setLinesFile] = useState<UploadedFile | null>(null)
  const [mappings, setMappings] = useState<MappingRow[]>([])
  const [errorHandling, setErrorHandling] = useState<ErrorHandlingMode>('cancel_rollback')
  const [result, setResult] = useState<ImportResult | null>(null)

  function handleSelectBizObject(o: BizObject) {
    setBizObject(o)
    // Reset downstream state when object changes
    setDocFile(null)
    setLinesFile(null)
    setMappings([])
    setResult(null)
  }

  async function handleDocFile(f: File) {
    const { columns, rowCount } = await readFileColumns(f)
    const uploaded: UploadedFile = { file: f, columns, rowCount }
    setDocFile(uploaded)
    // Rebuild mappings
    const linesCols = linesFile?.columns ?? []
    setMappings(buildInitialMappings(columns, linesCols))
  }

  async function handleLinesFile(f: File) {
    const { columns, rowCount } = await readFileColumns(f)
    const uploaded: UploadedFile = { file: f, columns, rowCount }
    setLinesFile(uploaded)
    // Rebuild mappings
    const docCols = docFile?.columns ?? []
    setMappings(buildInitialMappings(docCols, columns))
  }

  function handleReset() {
    setStep(1)
    setBizObject(null)
    setDocFile(null)
    setLinesFile(null)
    setMappings([])
    setErrorHandling('cancel_rollback')
    setResult(null)
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Data Import</h1>
          <p className="text-sm text-gray-500 mt-1">
            SAP B1 Data Transfer Workbench — import structured data into SAP Business One
          </p>
        </div>
        {(step > 1 || bizObject) && !result && (
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Start Over
          </button>
        )}
      </div>

      {/* Progress */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-5 overflow-x-auto">
        <WizardProgress step={step} />
      </div>

      {/* Step content */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8">
        {step === 1 && (
          <StepBusinessObject
            selected={bizObject}
            onSelect={handleSelectBizObject}
            onNext={() => setStep(2)}
          />
        )}
        {step === 2 && bizObject && (
          <StepUploadFiles
            bizObject={bizObject}
            docFile={docFile}
            linesFile={linesFile}
            onDocFile={handleDocFile}
            onLinesFile={handleLinesFile}
            onDocRemove={() => { setDocFile(null); setMappings(buildInitialMappings([], linesFile?.columns ?? [])) }}
            onLinesRemove={() => { setLinesFile(null); setMappings(buildInitialMappings(docFile?.columns ?? [], [])) }}
            onNext={() => setStep(3)}
            onBack={() => setStep(1)}
          />
        )}
        {step === 3 && bizObject && (
          <StepFieldMapping
            bizObject={bizObject}
            mappings={mappings}
            onMappingChange={setMappings}
            onNext={() => setStep(4)}
            onBack={() => setStep(2)}
          />
        )}
        {step === 4 && (
          <StepErrorHandling
            errorHandling={errorHandling}
            onChange={setErrorHandling}
            onNext={() => setStep(5)}
            onBack={() => setStep(3)}
          />
        )}
        {step === 5 && bizObject && docFile && linesFile && (
          <StepImport
            bizObject={bizObject}
            docFile={docFile}
            linesFile={linesFile}
            mappings={mappings}
            errorHandling={errorHandling}
            result={result}
            onResult={setResult}
            onBack={() => setStep(4)}
            onReset={handleReset}
          />
        )}
      </div>
    </div>
  )
}
