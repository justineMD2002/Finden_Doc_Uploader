import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  TrendingUp, ShoppingCart, Package, ChevronRight, ChevronLeft,
  UploadCloud, FileSpreadsheet, X, CheckCircle2, XCircle, Loader2,
  ArrowRight, AlertTriangle, FlaskConical, Send, RotateCcw, Check,
  AlertCircle, Info, Wand2, Download, GitMerge,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  BIZ_CATEGORIES, BIZ_OBJECTS,
  type BizCategory, type BizObject,
  type MappingRow, type ErrorHandlingMode,
  type UploadedFile, type WizardStep, type ImportResult,
  type CopyFromState,
} from '@/types/wizard'
import {
  getBizObjectConfig, applyAutoMap, reAutoMap, validateMappedRows,
  type SapFieldDef, type BizObjectConfig,
} from '@/lib/sapFields'
import type { CellValidationError } from '@/types/wizard'
import {
  saveWizardDraft, loadWizardDraft, clearWizardDraft,
  storedFileToUploaded, uploadedFileToStored,
} from '@/lib/wizardStorage'
import { insertImportLog } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useSap } from '@/context/SapContext'
import { runSapTest, runSapImport, lookupSourceDoc, type ImportProgress } from '@/lib/sapService'
import { getCopyFromSources, getBizObjectLabel } from '@/lib/copyRelations'

// ─── Helpers ───────────────────────────────────────────────────────────────

function categoryIcon(id: BizCategory) {
  if (id === 'sales')      return <TrendingUp className="w-5 h-5" />
  if (id === 'purchasing') return <ShoppingCart className="w-5 h-5" />
  return <Package className="w-5 h-5" />
}

async function readFile(
  file: File,
  sheetName?: string,
): Promise<{ columns: string[]; rowCount: number; rows: Record<string, unknown>[] }> {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { cellDates: true })
  const name = sheetName ?? wb.SheetNames[0]
  const ws = wb.Sheets[name]
  if (!ws) throw new Error(`Sheet "${name}" not found in file`)
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null })
  const columns = rows.length > 0 ? Object.keys(rows[0]) : []
  return { columns, rowCount: rows.length, rows }
}


async function getSheetNames(file: File): Promise<string[]> {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { sheetRows: 1 })
  return wb.SheetNames
}


function buildFallbackMappings(docCols: string[], linesCols: string[]): MappingRow[] {
  return [
    ...docCols.map(c => ({ sourceField: c, targetField: '', tab: 'doc' as const })),
    ...linesCols.map(c => ({ sourceField: c, targetField: '', tab: 'lines' as const })),
  ]
}

// ─── Progress bar ──────────────────────────────────────────────────────────

const STEP_LABELS = ['Business Object', 'Upload Files', 'Field Mapping', 'Error Handling', 'Import']

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
                done   ? 'bg-brand-600 border-brand-600 text-white'
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

// ─── Copy From Panel ───────────────────────────────────────────────────────

function CopyFromPanel({
  targetId,
  copyFrom,
  onChange,
}: {
  targetId: string
  copyFrom: CopyFromState | null
  onChange: (state: CopyFromState | null) => void
}) {
  const sources = getCopyFromSources(targetId)
  const { session } = useSap()
  const [open, setOpen] = useState(false)
  const [sourceId, setSourceId] = useState(sources[0] ?? '')
  const [docNumInput, setDocNumInput] = useState('')
  const [looking, setLooking] = useState(false)
  const [notFound, setNotFound] = useState(false)

  if (sources.length === 0) return null

  async function handleLookup() {
    const n = parseInt(docNumInput, 10)
    if (isNaN(n) || n <= 0) return
    if (!session) return
    setLooking(true)
    setNotFound(false)
    try {
      const result = await lookupSourceDoc(sourceId, n, session.sessionId)
      if (!result) {
        setNotFound(true)
        onChange(null)
      } else {
        const { BASE_TYPE_CODES } = await import('@/lib/copyRelations')
        onChange({
          sourceObjectId: sourceId,
          sourceObjectType: BASE_TYPE_CODES[sourceId] ?? 0,
          sourceDocNum: result.docNum,
          sourceDocEntry: result.docEntry,
        })
      }
    } finally {
      setLooking(false)
    }
  }

  function handleClear() {
    onChange(null)
    setDocNumInput('')
    setNotFound(false)
  }

  return (
    <div className="border border-dashed border-brand-300 rounded-xl bg-brand-50/30 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-brand-700 hover:bg-brand-50/50 transition-colors"
      >
        <span className="flex items-center gap-2">
          <GitMerge className="w-4 h-4" />
          Copy From
          <span className="text-xs font-normal text-brand-500">(optional)</span>
          {copyFrom && (
            <span className="ml-1 text-xs bg-brand-600 text-white rounded-full px-2 py-0.5">
              {getBizObjectLabel(copyFrom.sourceObjectId)} #{copyFrom.sourceDocNum}
            </span>
          )}
        </span>
        <ChevronRight className={cn('w-4 h-4 transition-transform', open && 'rotate-90')} />
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-brand-200/60 pt-3">
          <p className="text-xs text-gray-500">
            Link this document to an existing source document in SAP. Each line in your upload
            file will be automatically linked to the corresponding line in the source document.
          </p>

          {sources.length > 1 && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Copy from</label>
              <select
                value={sourceId}
                onChange={e => { setSourceId(e.target.value); onChange(null); setNotFound(false) }}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {sources.map(s => (
                  <option key={s} value={s}>{getBizObjectLabel(s)}</option>
                ))}
              </select>
            </div>
          )}

          {sources.length === 1 && (
            <p className="text-xs text-gray-600">
              Source: <span className="font-medium text-gray-800">{getBizObjectLabel(sources[0])}</span>
            </p>
          )}

          <div className="flex gap-2">
            <input
              type="number"
              min={1}
              value={docNumInput}
              onChange={e => { setDocNumInput(e.target.value); onChange(null); setNotFound(false) }}
              onKeyDown={e => e.key === 'Enter' && handleLookup()}
              placeholder={`${getBizObjectLabel(sourceId)} #`}
              className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <button
              type="button"
              onClick={handleLookup}
              disabled={looking || !docNumInput || !session}
              title={!session ? 'Connect to SAP first' : undefined}
              className="px-4 py-2 text-sm font-medium bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {looking ? 'Looking up…' : 'Look up'}
            </button>
          </div>

          {copyFrom && (
            <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <span className="text-xs text-green-700 font-medium">
                ✓ {getBizObjectLabel(copyFrom.sourceObjectId)} #{copyFrom.sourceDocNum} — DocEntry {copyFrom.sourceDocEntry}
              </span>
              <button type="button" onClick={handleClear} className="text-xs text-gray-400 hover:text-gray-600 ml-2">
                Clear
              </button>
            </div>
          )}
          {notFound && (
            <p className="text-xs text-red-600">Document not found in SAP. Check the number and try again.</p>
          )}
          {!session && (
            <p className="text-xs text-amber-600">Connect to SAP first to look up documents.</p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Step 1 — Business Object ──────────────────────────────────────────────

function StepBusinessObject({
  selected, onSelect, onNext, copyFrom, onCopyFromChange,
}: {
  selected: BizObject | null
  onSelect: (o: BizObject) => void
  onNext: () => void
  copyFrom: CopyFromState | null
  onCopyFromChange: (state: CopyFromState | null) => void
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
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
                  {categoryIcon(cat.id)}
                </div>
                <h3 className="text-sm font-semibold text-gray-700">{cat.label}</h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pl-2">
                {objects.map(obj => {
                  const isSelected = selected?.id === obj.id
                  const isEnabled = !!getBizObjectConfig(obj.id)
                  return (
                    <button
                      key={obj.id}
                      type="button"
                      disabled={!isEnabled}
                      onClick={() => isEnabled && onSelect(obj)}
                      className={cn(
                        'text-left px-4 py-3.5 rounded-xl border-2 text-sm font-medium transition-all relative',
                        !isEnabled
                          ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed'
                          : isSelected
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
                      {isEnabled && !isSelected && (
                        <span className="mt-1.5 inline-block text-[10px] font-semibold text-green-600 bg-green-50 border border-green-200 rounded px-1.5 py-0.5">
                          Available
                        </span>
                      )}
                      {!isEnabled && (
                        <span className="mt-1.5 inline-block text-[10px] font-semibold text-gray-400 bg-gray-100 border border-gray-200 rounded px-1.5 py-0.5">
                          Coming soon
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {selected && (
        <CopyFromPanel
          targetId={selected.id}
          copyFrom={copyFrom}
          onChange={onCopyFromChange}
        />
      )}

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

// ─── Validation error table ────────────────────────────────────────────────

const ERRORS_PER_PAGE = 50

function ValidationErrorTable({ errors }: { errors: CellValidationError[] }) {
  const [page, setPage] = useState(0)
  const totalPages = Math.ceil(errors.length / ERRORS_PER_PAGE)
  const slice = errors.slice(page * ERRORS_PER_PAGE, (page + 1) * ERRORS_PER_PAGE)

  return (
    <div className="space-y-2">
      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 text-xs text-gray-500">
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
            className="px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40">Prev</button>
          <span>Page {page + 1} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1}
            className="px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40">Next</button>
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border border-red-200">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-red-50 border-b border-red-200">
              <th className="text-left px-3 py-2 font-semibold text-red-700 w-14">Row</th>
              <th className="text-left px-3 py-2 font-semibold text-red-700 w-40">Source Column</th>
              <th className="text-left px-3 py-2 font-semibold text-red-700 w-32">SAP Field</th>
              <th className="text-left px-3 py-2 font-semibold text-red-700 w-36">Value</th>
              <th className="text-left px-3 py-2 font-semibold text-red-700">Reason</th>
            </tr>
          </thead>
          <tbody>
            {slice.map((err, i) => (
              <tr key={i} className={cn('border-b border-red-100 last:border-0', i % 2 === 0 ? 'bg-white' : 'bg-red-50/30')}>
                <td className="px-3 py-2 font-mono text-gray-500">{err.row}</td>
                <td className="px-3 py-2 font-mono text-brand-700 truncate max-w-[160px]" title={err.sourceColumn}>{err.sourceColumn}</td>
                <td className="px-3 py-2 font-mono font-semibold text-gray-700">{err.targetField}</td>
                <td className="px-3 py-2 font-mono text-red-600 truncate max-w-[144px]" title={err.value || '(empty)'}>{err.value || <span className="italic text-gray-400">empty</span>}</td>
                <td className="px-3 py-2 text-gray-700">{err.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Dropzone ──────────────────────────────────────────────────────────────

function UploadDropzone({
  label, uploaded, onFile, onRemove, disabled,
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
          <p className="text-xs text-gray-500 mt-0.5">{uploaded.rowCount} rows · {uploaded.columns.length} columns</p>
        </div>
        {!disabled && (
          <button onClick={onRemove} className="p-1.5 rounded-lg hover:bg-green-100 text-green-700 hover:text-green-900 transition-colors">
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
      onDrop={e => { e.preventDefault(); setDragging(false); if (!disabled) handle(e.dataTransfer.files[0]) }}
      onClick={() => !disabled && inputRef.current?.click()}
      className={cn(
        'rounded-xl border-2 border-dashed px-6 py-8 flex flex-col items-center gap-2 cursor-pointer select-none transition-all',
        disabled ? 'border-gray-100 bg-gray-50 cursor-not-allowed opacity-50'
          : dragging ? 'border-brand-400 bg-brand-50 scale-[1.01]'
          : 'border-gray-200 bg-white hover:border-brand-300 hover:bg-brand-50/30',
      )}
    >
      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', dragging ? 'bg-brand-100' : 'bg-gray-100')}>
        <UploadCloud className={cn('w-5 h-5', dragging ? 'text-brand-600' : 'text-gray-400')} />
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-gray-700">{dragging ? 'Drop to upload' : `Upload ${label}`}</p>
        <p className="text-xs text-gray-400 mt-0.5">Drag & drop or <span className="text-brand-600 font-medium">browse</span></p>
        <p className="text-xs text-gray-300 mt-0.5">.xlsx · .xls · .csv</p>
      </div>
      <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => handle(e.target.files?.[0])} />
    </div>
  )
}

// ─── Step 2 — Upload Files ─────────────────────────────────────────────────

// ─── Columns preview ───────────────────────────────────────────────────────

function ColumnsPreview({ columns }: { columns: string[] }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Detected Columns</p>
      <div className="flex flex-wrap gap-1.5">
        {columns.map(col => (
          <span key={col} className="px-2 py-0.5 bg-white border border-gray-200 rounded text-xs font-mono text-gray-600">{col}</span>
        ))}
      </div>
    </div>
  )
}

// ─── Step 2 — Upload Files ─────────────────────────────────────────────────

function StepUploadFiles({
  bizObject, docFile, linesFile,
  docErrors, linesErrors,
  onBothFiles, onDocRemove, onLinesRemove,
  onNext, onBack,
}: {
  bizObject: BizObject
  docFile: UploadedFile | null
  linesFile: UploadedFile | null
  docErrors: CellValidationError[]
  linesErrors: CellValidationError[]
  onBothFiles: (f: File, docSheet: string, linesSheet: string) => Promise<void>
  onDocRemove: () => void
  onLinesRemove: () => void
  onNext: () => void
  onBack: () => void
}) {
  const [activeTab, setActiveTab] = useState<'doc' | 'lines'>('doc')
  const [loading, setLoading] = useState(false)
  const [singleFile, setSingleFile] = useState<File | null>(null)
  const [detectedSheets, setDetectedSheets] = useState<{ doc: string; lines: string } | null>(null)

  const [docLabel, linesLabel] = bizObject.tabLabels ?? ['Document', 'Document Lines']
  const bothLoaded = !!docFile && !!linesFile
  const totalErrors = docErrors.length + linesErrors.length
  const canProceed = bothLoaded && totalErrors === 0

  function detectSheets(names: string[]): { doc: string; lines: string } | null {
    const linesSheet = names.find(n => /line/i.test(n))
    const docSheet = names.find(n => n !== linesSheet)
    if (!linesSheet || !docSheet) return null
    return { doc: docSheet, lines: linesSheet }
  }

  async function handleSingleFile(f: File) {
    setLoading(true)
    try {
      const names = await getSheetNames(f)
      if (names.length < 2) {
        toast.error('File must contain at least 2 sheets', {
          description: `Found only ${names.length} sheet. Use separate sheets for ${docLabel} and ${linesLabel}.`,
        })
        return
      }
      const sheets = detectSheets(names)
      if (!sheets) {
        toast.error('Could not auto-detect sheets', {
          description: `Name one sheet with "Line" or "Lines" (e.g. "Document Lines") so the system can tell them apart.`,
        })
        return
      }
      setSingleFile(f)
      setDetectedSheets(sheets)
      onDocRemove()
      onLinesRemove()
      await onBothFiles(f, sheets.doc, sheets.lines)
    } finally {
      setLoading(false)
    }
  }

  function handleClearSingle() {
    setSingleFile(null)
    setDetectedSheets(null)
    onDocRemove()
    onLinesRemove()
  }

  const activeErrors = activeTab === 'doc' ? docErrors : linesErrors
  const activeFile   = activeTab === 'doc' ? docFile : linesFile

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Upload Files</h2>
        <p className="text-sm text-gray-500 mt-1">
          Provide the <span className="font-medium text-gray-700">{docLabel}</span> and{' '}
          <span className="font-medium text-gray-700">{linesLabel}</span> data for{' '}
          <span className="font-medium text-brand-700">{bizObject.label}</span>.
        </p>
      </div>

      <div className="space-y-4">
        {!singleFile ? (
          <div className="space-y-3">
            <div className="flex items-start gap-2 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl">
              <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <div className="flex-1 flex items-start justify-between gap-3">
                <p className="text-sm text-blue-700">
                  Upload a single Excel file with <span className="font-semibold">{docLabel}</span> and{' '}
                  <span className="font-semibold">{linesLabel}</span> in separate sheets.
                  Name the lines sheet with the word <span className="font-semibold">"Line"</span> (e.g. "Document Lines") — sheets are detected automatically.
                </p>
                <button
                  type="button"
                  onClick={async () => {
                    const TEMPLATE_MAP: Record<string, string> = {
                      po:             'po_template.xlsx',
                      ar_credit_memo: 'ar_credit_memo_template.xlsx',
                      grpo:           'grpo_template.xlsx',
                      return:         'return_template.xlsx',
                      ap_downpayment: 'ap_downpayment_template.xlsx',
                      ap_invoice:     'ap_invoice_template.xlsx',
                      ar_invoice:     'ar_invoice_template.xlsx',
                      delivery:       'delivery_template.xlsx',
                      goods_issue:    'goods_issue_template.xlsx',
                      goods_receipt:  'goods_receipt_template.xlsx',
                      inv_transfer:   'inventory_transfer_template.xlsx',
                    }
                    const filename = TEMPLATE_MAP[bizObject.id] ?? `${bizObject.id}_template.xlsx`
                    const url = `https://tdthrilomqsntutgfkyp.supabase.co/storage/v1/object/public/templates/${filename}`
                    const res = await fetch(url)
                    const blob = await res.blob()
                    const a = document.createElement('a')
                    a.href = URL.createObjectURL(blob)
                    a.download = filename
                    a.click()
                    URL.revokeObjectURL(a.href)
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-white border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors shrink-0"
                >
                  <Download className="w-3.5 h-3.5" /> Template
                </button>
              </div>
            </div>
            <UploadDropzone
              label="Excel file (.xlsx)"
              uploaded={null}
              onFile={handleSingleFile}
              onRemove={() => {}}
              disabled={loading}
            />
            {loading && (
              <div className="flex items-center gap-2 text-sm text-brand-600">
                <Loader2 className="w-4 h-4 animate-spin" /> Detecting sheets and reading data...
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* File info + detected sheets + clear */}
            <div className="flex items-center gap-3 px-4 py-3 bg-brand-50 border border-brand-200 rounded-xl">
              <FileSpreadsheet className="w-5 h-5 text-brand-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{singleFile.name}</p>
                {detectedSheets && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    <span className="font-medium text-gray-700">{docLabel}:</span>{' '}
                    <span className="font-mono">{detectedSheets.doc}</span>
                    {' · '}
                    <span className="font-medium text-gray-700">{linesLabel}:</span>{' '}
                    <span className="font-mono">{detectedSheets.lines}</span>
                  </p>
                )}
              </div>
              {!loading && (
                <button onClick={handleClearSingle} className="p-1.5 rounded-lg hover:bg-brand-100 text-brand-700 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {loading && (
              <div className="flex items-center gap-2 text-sm text-brand-600">
                <Loader2 className="w-4 h-4 animate-spin" /> Reading data...
              </div>
            )}

            {/* Sheet summaries */}
            {bothLoaded && (
              <div className="grid grid-cols-2 gap-3">
                {([['doc', docLabel, docFile, docErrors], ['lines', linesLabel, linesFile, linesErrors]] as const).map(([role, label, file, errors]) => (
                  <div key={role} className={cn('px-4 py-3 rounded-xl border', errors.length > 0 ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50')}>
                    <p className="text-xs font-semibold text-gray-600 mb-1">{label}</p>
                    {file && errors.length === 0 && (
                      <p className="text-xs text-green-700 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> {file.rowCount} rows · {file.columns.length} columns
                      </p>
                    )}
                    {errors.length > 0 && (
                      <p className="text-xs text-red-600 flex items-center gap-1">
                        <XCircle className="w-3 h-3" /> {errors.length} error{errors.length !== 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Column preview / errors for active tab */}
            {(docFile || linesFile) && (
              <div className="space-y-3 border-t border-gray-100 pt-4">
                <div className="flex gap-0 border-b border-gray-200">
                  {([['doc', docLabel, docFile, docErrors], ['lines', linesLabel, linesFile, linesErrors]] as const).map(([tab, label, file, errs]) => file && (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={cn(
                        'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                        activeTab === tab
                          ? errs.length > 0 ? 'border-red-500 text-red-700' : 'border-brand-500 text-brand-700'
                          : 'border-transparent text-gray-500 hover:text-gray-700',
                      )}
                    >
                      {label}
                      {errs.length > 0 && <span className="ml-1.5 px-1.5 py-0.5 rounded text-xs bg-red-100 text-red-600 font-semibold">{errs.length}</span>}
                    </button>
                  ))}
                </div>
                {activeFile && activeErrors.length === 0 && <ColumnsPreview columns={activeFile.columns} />}
                {activeErrors.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-red-700 flex items-center gap-2">
                      <XCircle className="w-4 h-4" /> {activeErrors.length} validation error{activeErrors.length !== 1 ? 's' : ''} — fix your file and re-upload
                    </p>
                    <ValidationErrorTable errors={activeErrors} />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Errors block */}
      {bothLoaded && totalErrors > 0 && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
          <XCircle className="w-4 h-4 text-red-500 shrink-0" />
          <p className="text-sm text-red-700">
            <span className="font-semibold">{totalErrors} error{totalErrors !== 1 ? 's' : ''}</span> must be resolved before proceeding. Correct the data in your file and re-upload.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <button onClick={onBack} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 border border-gray-200 transition-all">
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <button
          onClick={onNext}
          disabled={!canProceed}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
        >
          Next <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// ─── Field type badge ──────────────────────────────────────────────────────

function FieldTypeBadge({ def }: { def: SapFieldDef }) {
  const colorMap: Record<string, string> = {
    string: 'bg-sky-50 text-sky-700 border-sky-200',
    date:   'bg-violet-50 text-violet-700 border-violet-200',
    double: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    long:   'bg-orange-50 text-orange-700 border-orange-200',
    enum:   'bg-pink-50 text-pink-700 border-pink-200',
  }
  return (
    <span className={cn('px-1.5 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wide', colorMap[def.type] ?? 'bg-gray-100 text-gray-500 border-gray-200')}>
      {def.type}
    </span>
  )
}

// ─── Target field selector ─────────────────────────────────────────────────

function TargetFieldSelect({
  value,
  sapFields,
  onChange,
  isUnknownBizObject,
}: {
  value: string
  sapFields: SapFieldDef[]
  onChange: (v: string) => void
  isUnknownBizObject: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const matched = sapFields.filter(f =>
    f.field.toLowerCase().includes(query.toLowerCase()) ||
    f.description.toLowerCase().includes(query.toLowerCase())
  )

  const selectedDef = sapFields.find(f => f.field === value)

  if (isUnknownBizObject) {
    return (
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="SAP field name..."
        className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white placeholder:text-gray-300 font-mono"
      />
    )
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => { setOpen(v => !v); setTimeout(() => inputRef.current?.focus(), 50) }}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-1.5 text-xs border rounded-lg transition-all text-left',
          open
            ? 'border-brand-400 ring-2 ring-brand-100 bg-white'
            : value
            ? 'border-gray-200 bg-white text-gray-800 hover:border-brand-300'
            : 'border-dashed border-gray-300 bg-gray-50 text-gray-400 hover:border-brand-300 hover:bg-white',
        )}
      >
        {selectedDef ? (
          <>
            <span className="font-mono font-semibold text-gray-800 shrink-0">{selectedDef.field}</span>
            <span className="text-gray-400 truncate">{selectedDef.description}</span>
            {selectedDef.mandatory && <span className="text-red-500 shrink-0">*</span>}
          </>
        ) : (
          <span className="text-gray-400">Select SAP field...</span>
        )}
        <span className="ml-auto shrink-0 text-gray-300">▾</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-20 overflow-hidden">
            {/* Search */}
            <div className="p-2 border-b border-gray-100">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search fields..."
                className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
            </div>
            {/* Clear option */}
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false); setQuery('') }}
              className="w-full text-left px-3 py-2 text-xs text-gray-400 hover:bg-gray-50 italic border-b border-gray-100"
            >
              — Clear mapping
            </button>
            {/* Field list */}
            <ul className="max-h-48 overflow-y-auto py-1">
              {matched.length === 0 && (
                <li className="px-3 py-3 text-xs text-gray-400 text-center">No fields found</li>
              )}
              {matched.map(f => (
                <li key={f.field}>
                  <button
                    type="button"
                    onClick={() => { onChange(f.field); setOpen(false); setQuery('') }}
                    className={cn(
                      'w-full text-left px-3 py-2.5 hover:bg-brand-50 transition-colors flex items-center gap-2',
                      f.field === value && 'bg-brand-50',
                    )}
                  >
                    <span className="font-mono text-xs font-semibold text-gray-800 w-28 shrink-0">{f.field}</span>
                    <span className="text-xs text-gray-500 flex-1 truncate">{f.description}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <FieldTypeBadge def={f} />
                      {f.mandatory && <span className="text-red-500 text-xs font-bold">*</span>}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Field detail tooltip row ──────────────────────────────────────────────

function FieldDetails({ def }: { def: SapFieldDef }) {
  const chips: { label: string; className: string }[] = []
  if (def.fieldLength) chips.push({ label: `len: ${def.fieldLength}`, className: 'bg-gray-100 text-gray-600' })
  if (def.format)      chips.push({ label: def.format, className: 'bg-violet-50 text-violet-700' })
  if (def.relatedTable) chips.push({ label: def.relatedTable, className: 'bg-sky-50 text-sky-700' })
  if (def.isKey)        chips.push({ label: 'KEY', className: 'bg-amber-100 text-amber-700 font-bold' })
  if (def.isParentKey)  chips.push({ label: 'PARENT KEY', className: 'bg-amber-100 text-amber-700 font-bold' })
  if (def.mandatory)    chips.push({ label: 'Required', className: 'bg-red-50 text-red-600 font-semibold' })
  if (def.validValues)  chips.push({ label: def.validValues.join(' | '), className: 'bg-pink-50 text-pink-700 font-mono text-[10px]' })

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {chips.map((c, i) => (
        <span key={i} className={cn('px-1.5 py-0.5 rounded text-[10px] border border-transparent', c.className)}>
          {c.label}
        </span>
      ))}
      {def.notes && (
        <span className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5 w-full">
          <Info className="w-3 h-3 shrink-0" />{def.notes}
        </span>
      )}
    </div>
  )
}

// ─── Step 3 — Field Mapping ────────────────────────────────────────────────

function StepFieldMapping({
  bizObject, mappings, onMappingChange, onNext, onBack,
}: {
  bizObject: BizObject
  mappings: MappingRow[]
  onMappingChange: (updated: MappingRow[]) => void
  onNext: () => void
  onBack: () => void
}) {
  const [activeTab, setActiveTab] = useState<'doc' | 'lines'>('doc')
  const [docLabel, linesLabel] = bizObject.tabLabels ?? ['Document', 'Document Lines']

  const config: BizObjectConfig | null = getBizObjectConfig(bizObject.id)
  const isUnknown = config === null

  function handleAutoMap(overwrite: boolean) {
    if (!config) return
    const updated = reAutoMap(mappings, config, overwrite)
    const newlyMapped = updated.filter((r, i) => r.targetField && !mappings[i].targetField).length
    onMappingChange(updated)
    toast.success(
      overwrite ? 'All fields re-mapped' : `Auto-mapped ${newlyMapped} field${newlyMapped !== 1 ? 's' : ''}`,
      { description: overwrite ? 'Existing mappings were replaced.' : 'Already mapped fields were left unchanged.' },
    )
  }

  const docFields  = config?.fields.doc   ?? []
  const linesFields = config?.fields.lines ?? []

  const visible = mappings.filter(m => m.tab === activeTab)
  const sapFields = activeTab === 'doc' ? docFields : linesFields

  function updateTarget(sourceField: string, tab: 'doc' | 'lines', value: string) {
    onMappingChange(
      mappings.map(m => m.tab === tab && m.sourceField === sourceField ? { ...m, targetField: value } : m)
    )
  }

  // Stats
  const mappedCount = mappings.filter(m => m.targetField.trim() !== '').length
  const totalCount  = mappings.length

  // Unmapped mandatory SAP fields
  const mappedTargets = new Set(mappings.filter(m => m.tab === activeTab).map(m => m.targetField))
  const unmappedMandatory = sapFields.filter(f => f.mandatory && !mappedTargets.has(f.field))

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Field Mapping</h2>
          <p className="text-sm text-gray-500 mt-1">
            Map your source columns to the SAP B1 target fields for{' '}
            <span className="font-medium text-brand-700">{bizObject.label}</span>.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Auto Map controls */}
          {!isUnknown && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleAutoMap(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-brand-50 text-brand-700 border border-brand-200 hover:bg-brand-100 transition-colors"
                title="Auto-map unmapped fields only"
              >
                <Wand2 className="w-3.5 h-3.5" /> Auto Map
              </button>
              <button
                onClick={() => handleAutoMap(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 transition-colors"
                title="Re-map all fields, overwriting existing mappings"
              >
                <RotateCcw className="w-3 h-3" /> Reset & Re-map
              </button>
            </div>
          )}
          <div className="text-right pl-2 border-l border-gray-200">
            <span className={cn('text-sm font-bold', mappedCount === totalCount ? 'text-green-600' : 'text-amber-600')}>
              {mappedCount}/{totalCount}
            </span>
            <p className="text-[11px] text-gray-400">mapped</p>
          </div>
        </div>
      </div>

      {isUnknown && (
        <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-700">
            SAP field definitions for <span className="font-semibold">{bizObject.label}</span> are not yet configured.
            You can still enter target field names manually.
          </p>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-0 border-b border-gray-200">
        {([['doc', docLabel], ['lines', linesLabel]] as const).map(([tab, label]) => {
          const count  = mappings.filter(m => m.tab === tab).length
          const mapped = mappings.filter(m => m.tab === tab && m.targetField.trim()).length
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
                activeTab === tab ? 'border-brand-500 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-700',
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

      {/* Unmapped mandatory warning */}
      {unmappedMandatory.length > 0 && (
        <div className="flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
          <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-700">Unmapped required fields</p>
            <p className="text-xs text-red-600 mt-0.5">
              The following SAP fields are mandatory and have no source mapping:{' '}
              {unmappedMandatory.map(f => (
                <span key={f.field} className="font-mono font-bold">{f.field}{' '}</span>
              ))}
            </p>
          </div>
        </div>
      )}

      {/* Mapping table */}
      <div className="overflow-hidden rounded-xl border border-gray-200">
        {/* Header */}
        <div className="grid grid-cols-[1fr_32px_1fr] bg-gray-50 border-b border-gray-200 px-4 py-2.5 gap-3">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Source Field</span>
          <span />
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">SAP B1 Target Field</span>
        </div>

        {/* Rows */}
        <div className="divide-y divide-gray-100 max-h-[420px] overflow-y-auto">
          {visible.map(row => {
            const selectedDef = sapFields.find(f => f.field === row.targetField)
            const isMapped = row.targetField.trim() !== ''

            return (
              <div
                key={`${row.tab}-${row.sourceField}`}
                className={cn(
                  'grid grid-cols-[1fr_32px_1fr] items-start px-4 py-3 gap-3 transition-colors',
                  isMapped ? 'hover:bg-green-50/30' : 'hover:bg-gray-50/50',
                )}
              >
                {/* Source */}
                <div>
                  <span className={cn(
                    'inline-block px-2.5 py-1 rounded text-xs font-mono truncate max-w-full',
                    isMapped
                      ? 'bg-brand-50 border border-brand-200 text-brand-700'
                      : 'bg-gray-100 border border-gray-200 text-gray-500',
                  )}>
                    {row.sourceField}
                  </span>
                </div>

                {/* Arrow */}
                <div className="flex items-center justify-center pt-1.5">
                  <ArrowRight className={cn('w-4 h-4 shrink-0', isMapped ? 'text-brand-500' : 'text-gray-300')} />
                </div>

                {/* Target */}
                <div>
                  <TargetFieldSelect
                    value={row.targetField}
                    sapFields={sapFields}
                    onChange={v => updateTarget(row.sourceField, row.tab, v)}
                    isUnknownBizObject={isUnknown}
                  />
                  {selectedDef && <FieldDetails def={selectedDef} />}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* SAP fields reference */}
      {!isUnknown && (
        <details className="group">
          <summary className="text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-700 list-none flex items-center gap-1.5">
            <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
            SAP B1 Field Reference — {activeTab === 'doc' ? docLabel : linesLabel}
            <span className="ml-1 text-gray-300 font-normal normal-case">{sapFields.length} fields</span>
          </summary>
          <div className="mt-3 overflow-hidden rounded-xl border border-gray-200">
            <div className="grid grid-cols-[140px_1fr_80px_80px_80px_100px] bg-gray-50 border-b border-gray-200 px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide gap-2">
              <span>Field</span>
              <span>Description</span>
              <span>Type</span>
              <span>Length</span>
              <span>Format</span>
              <span>Related Table</span>
            </div>
            <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
              {sapFields.map(f => (
                <div
                  key={f.field}
                  className={cn(
                    'grid grid-cols-[140px_1fr_80px_80px_80px_100px] px-3 py-2.5 gap-2 items-center text-xs',
                    f.mandatory ? 'bg-red-50/40' : 'hover:bg-gray-50/50',
                  )}
                >
                  <span className="font-mono font-semibold text-gray-800 flex items-center gap-1">
                    {f.field}
                    {f.mandatory && <span className="text-red-500 font-bold">*</span>}
                    {(f.isKey || f.isParentKey) && (
                      <span className="text-[9px] bg-amber-100 text-amber-700 font-bold px-1 rounded">KEY</span>
                    )}
                  </span>
                  <span className="text-gray-600">{f.description}</span>
                  <span><FieldTypeBadge def={f} /></span>
                  <span className="text-gray-400 font-mono">{f.fieldLength ?? '—'}</span>
                  <span className="text-gray-400 font-mono">{f.format ?? '—'}</span>
                  <span className="text-gray-400 font-mono">{f.relatedTable ?? '—'}</span>
                </div>
              ))}
            </div>
          </div>
        </details>
      )}

      <div className="flex items-center justify-between pt-2">
        <button onClick={onBack} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 border border-gray-200 transition-all">
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
    description: 'If one or more errors occur during import, the entire import will be cancelled and all changes will be rolled back. This ensures data integrity.',
    icon: <XCircle className="w-5 h-5" />,
    color: 'red',
  },
  {
    value: 'ignore_all',
    label: 'Ignore All Errors',
    description: 'Skip all records that have errors and continue importing the valid records. The import will complete even if some records fail.',
    icon: <AlertTriangle className="w-5 h-5" />,
    color: 'amber',
  },
  {
    value: 'ignore_up_to_10',
    label: 'Ignore Up to 10 Errors',
    description: 'If there are up to 10 errors, skip those records and continue importing the rest. If errors exceed 10, cancel and roll back.',
    icon: <AlertCircle className="w-5 h-5" />,
    color: 'blue',
  },
]

function StepErrorHandling({
  errorHandling, onChange, onNext, onBack,
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
            red:   isSelected ? 'border-red-400 bg-red-50 ring-2 ring-red-100' : 'border-gray-200 hover:border-red-200 hover:bg-red-50/30',
            amber: isSelected ? 'border-amber-400 bg-amber-50 ring-2 ring-amber-100' : 'border-gray-200 hover:border-amber-200 hover:bg-amber-50/30',
            blue:  isSelected ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-100' : 'border-gray-200 hover:border-blue-200 hover:bg-blue-50/30',
          }
          const iconColorMap: Record<string, string> = { red: 'text-red-500', amber: 'text-amber-500', blue: 'text-blue-500' }

          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={cn('w-full text-left flex items-start gap-4 px-5 py-4 rounded-xl border-2 transition-all', colorMap[opt.color])}
            >
              <div className={cn('shrink-0 mt-0.5', iconColorMap[opt.color])}>{opt.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-gray-900">{opt.label}</p>
                  <div className={cn(
                    'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all',
                    isSelected ? 'border-brand-600 bg-brand-600' : 'border-gray-300 bg-white',
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
        <button onClick={onBack} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 border border-gray-200 transition-all">
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <button onClick={onNext} className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-brand-600 text-white hover:bg-brand-700 transition-all shadow-sm">
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


function ImportResultPanel({
  result, onReset, onRunImport, onRetestImport, onCopyTo,
}: {
  result: ImportResult
  onReset: () => void
  onRunImport?: () => void
  onRetestImport?: () => void
  onCopyTo?: () => void
}) {
  const isTest = result.mode === 'test'
  const ok = result.status === 'success'
  const partial = result.status === 'partial'

  return (
    <div className={cn(
      'rounded-2xl border p-6 space-y-4',
      ok ? 'bg-green-50 border-green-200' : partial ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200',
    )}>
      <div className="flex items-start gap-4">
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', ok ? 'bg-green-100' : partial ? 'bg-amber-100' : 'bg-red-100')}>
          {ok ? <CheckCircle2 className="w-5 h-5 text-green-600" /> : partial ? <AlertTriangle className="w-5 h-5 text-amber-600" /> : <XCircle className="w-5 h-5 text-red-600" />}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            {isTest && <span className="px-2 py-0.5 text-xs font-bold bg-purple-100 text-purple-700 rounded border border-purple-200 uppercase tracking-wide">Test Only</span>}
            <p className={cn('font-bold text-base', ok ? 'text-green-800' : partial ? 'text-amber-800' : 'text-red-800')}>
              {isTest
                ? ok ? 'Test Passed' : partial ? 'Test — Partial Issues' : 'Test Failed'
                : ok ? 'Import Successful' : partial ? 'Partial Import' : 'Import Failed'
              }
            </p>
          </div>
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total Records', value: result.totalRecords },
              { label: 'Succeeded', value: result.successCount },
              { label: 'Failed', value: result.failedCount },
              {
                label: result.sapReference ? 'SAP Reference' : 'Timestamp',
                value: result.sapReference ?? new Date(result.timestamp).toLocaleTimeString(),
              },
            ].map(s => (
              <div key={s.label} className="bg-white/70 rounded-lg p-2.5">
                <p className="text-xs text-gray-500">{s.label}</p>
                <p className="text-sm font-semibold text-gray-800 mt-0.5 truncate">{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {result.errors.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-white/80">
          <div className="bg-white/40 px-4 py-2 border-b border-white/80">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Errors ({result.errors.length})</p>
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

      {/* Actions */}
      <div className={cn('flex flex-wrap items-center gap-2 pt-1', isTest && 'border-t border-white/60')}>
        {/* After test: offer to proceed with actual import */}
        {isTest && onRunImport && (
          <button
            onClick={onRunImport}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-brand-600 text-white rounded-xl hover:bg-brand-700 transition-colors shadow-sm"
          >
            <Send className="w-4 h-4" /> Proceed with Import
          </button>
        )}
        {isTest && onRetestImport && (
          <button
            onClick={onRetestImport}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white border border-purple-200 text-purple-700 rounded-xl hover:bg-purple-50 transition-colors"
          >
            <FlaskConical className="w-4 h-4" /> Run Test Again
          </button>
        )}
        <button
          onClick={onReset}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors"
        >
          <RotateCcw className="w-4 h-4" /> Start New Import
        </button>
        {!isTest && ok && onCopyTo && (
          <button
            onClick={onCopyTo}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-white border border-brand-300 text-brand-700 rounded-xl hover:bg-brand-50 transition-colors"
          >
            <GitMerge className="w-4 h-4" /> Copy To
          </button>
        )}
      </div>
    </div>
  )
}

function StepImport({
  bizObject, docFile, linesFile, mappings, errorHandling,
  copyFrom, result, onResult, onClearResult, onBack, onReset, onCopyTo,
}: {
  bizObject: BizObject
  docFile: UploadedFile
  linesFile: UploadedFile
  mappings: MappingRow[]
  errorHandling: ErrorHandlingMode
  copyFrom: CopyFromState | null
  result: ImportResult | null
  onResult: (r: ImportResult) => void
  onClearResult: () => void
  onBack: () => void
  onReset: () => void
  onCopyTo?: () => void
}) {
  const [running,  setRunning]  = useState<'test' | 'import' | null>(null)
  const [progress, setProgress] = useState<ImportProgress | null>(null)
  const [docLabel, linesLabel]  = bizObject.tabLabels ?? ['Document', 'Document Lines']
  const mappedCount = mappings.filter(m => m.targetField.trim()).length
  const { session } = useSap()

  async function run(mode: 'test' | 'import') {
    if (!session) {
      toast.error('No active SAP session', { description: 'Please reconnect to SAP from the company selector.' })
      return
    }
    setRunning(mode)
    setProgress(null)
    try {
      const r = mode === 'test'
        ? await runSapTest(bizObject.id, docFile, linesFile, mappings, session.sessionId, setProgress, copyFrom)
        : await runSapImport(bizObject.id, docFile, linesFile, mappings, session.sessionId, errorHandling, setProgress, copyFrom)
      onResult(r)
      if (mode === 'import') {
        if (r.status === 'success') toast.success('Import completed successfully!', { description: `SAP Ref: ${r.sapReference}` })
        else if (r.status === 'partial') toast.warning('Import partially completed', { description: `${r.successCount} succeeded, ${r.failedCount} failed.` })
        else toast.error('Import failed', { description: `${r.failedCount} records failed.` })
      } else {
        if (r.status === 'success') toast.success('Test passed — no errors found.')
        else toast.warning('Test found issues', { description: `${r.failedCount} document(s) would fail.` })
      }
    } finally {
      setRunning(null)
      setProgress(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Import</h2>
        <p className="text-sm text-gray-500 mt-1">Review your configuration then run a test or start the actual import.</p>
      </div>

      {/* Config summary */}
      <div className="bg-gray-50 rounded-2xl border border-gray-200 p-5 space-y-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Import Configuration</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          {[
            { label: 'Business Object', value: bizObject.label },
            { label: 'Error Handling', value: errorHandlingLabel(errorHandling) },
            { label: docLabel, value: `${docFile.file.name} (${docFile.rowCount} rows)` },
            { label: linesLabel, value: `${linesFile.file.name} (${linesFile.rowCount} rows)` },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-100 px-4 py-3">
              <p className="text-xs text-gray-400 mb-1">{s.label}</p>
              <p className="font-medium text-gray-800 truncate">{s.value}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 pt-1">
          <span className={cn(
            'text-xs font-medium px-2.5 py-1 rounded-full',
            mappedCount === mappings.length ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700',
          )}>
            {mappedCount}/{mappings.length} fields mapped
          </span>
          {mappedCount < mappings.length && (
            <span className="text-xs text-amber-600">— Unmapped fields will be skipped.</span>
          )}
        </div>
      </div>

      {/* ── Live progress ─────────────────────────────────────────────── */}
      {running !== null && progress && (
        <div className={cn(
          'rounded-2xl border p-5 space-y-3',
          progress.phase === 'rolling_back'
            ? 'bg-red-50 border-red-200'
            : running === 'test'
            ? 'bg-purple-50 border-purple-200'
            : 'bg-brand-50 border-brand-200',
        )}>
          {/* Phase label */}
          <div className="flex items-center justify-between">
            <p className={cn(
              'text-sm font-semibold',
              progress.phase === 'rolling_back' ? 'text-red-700'
                : running === 'test' ? 'text-purple-700' : 'text-brand-700',
            )}>
              {progress.phase === 'validating' ? 'Validating...'
                : progress.phase === 'rolling_back' ? 'Rolling back...'
                : 'Importing...'}
            </p>
            <span className="text-xs font-mono text-gray-500">
              {progress.current} / {progress.total}
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full h-2.5 bg-white/70 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-300',
                progress.phase === 'rolling_back' ? 'bg-red-500'
                  : running === 'test' ? 'bg-purple-500' : 'bg-brand-600',
              )}
              style={{ width: `${Math.round((progress.current / progress.total) * 100)}%` }}
            />
          </div>

          {/* Current action */}
          <p className="text-xs text-gray-600 truncate">{progress.action}</p>

          {/* Live counters */}
          {progress.phase !== 'rolling_back' && (
            <div className="flex items-center gap-4 pt-1">
              <span className="text-xs font-medium text-green-700">
                ✓ {progress.successCount} succeeded
              </span>
              {progress.failedCount > 0 && (
                <span className="text-xs font-medium text-red-600">
                  ✗ {progress.failedCount} failed
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {!result && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={() => run('test')}
            disabled={running !== null}
            className={cn(
              'flex flex-col items-center gap-3 px-6 py-6 rounded-2xl border-2 transition-all',
              running === 'test' ? 'border-purple-400 bg-purple-50'
                : 'border-purple-200 bg-white hover:border-purple-400 hover:bg-purple-50',
              running !== null && running !== 'test' && 'opacity-50 cursor-not-allowed',
            )}
          >
            <div className="w-12 h-12 rounded-2xl bg-purple-100 flex items-center justify-center">
              {running === 'test' ? <Loader2 className="w-6 h-6 text-purple-600 animate-spin" /> : <FlaskConical className="w-6 h-6 text-purple-600" />}
            </div>
            <div className="text-center">
              <p className="font-semibold text-gray-800">{running === 'test' ? 'Running test...' : 'Test Import'}</p>
              <p className="text-xs text-gray-500 mt-1">Validate data without making changes to SAP</p>
            </div>
          </button>

          <button
            onClick={() => run('import')}
            disabled={running !== null}
            className={cn(
              'flex flex-col items-center gap-3 px-6 py-6 rounded-2xl border-2 transition-all',
              running === 'import' ? 'border-brand-500 bg-brand-50'
                : 'border-brand-300 bg-white hover:border-brand-500 hover:bg-brand-50',
              running !== null && running !== 'import' && 'opacity-50 cursor-not-allowed',
            )}
          >
            <div className="w-12 h-12 rounded-2xl bg-brand-100 flex items-center justify-center">
              {running === 'import' ? <Loader2 className="w-6 h-6 text-brand-600 animate-spin" /> : <Send className="w-6 h-6 text-brand-600" />}
            </div>
            <div className="text-center">
              <p className="font-semibold text-gray-800">{running === 'import' ? 'Importing...' : 'Import Now'}</p>
              <p className="text-xs text-gray-500 mt-1">Import data directly into SAP B1</p>
            </div>
          </button>
        </div>
      )}

      {result && (
        <ImportResultPanel
          result={result}
          onReset={onReset}
          onRunImport={result.mode === 'test' ? () => { onClearResult(); run('import') } : undefined}
          onRetestImport={result.mode === 'test' ? () => { onClearResult(); run('test') } : undefined}
          onCopyTo={onCopyTo}
        />
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
  const { user } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState<WizardStep>(1)
  const [bizObject, setBizObject] = useState<BizObject | null>(null)
  const [copyFrom, setCopyFrom] = useState<CopyFromState | null>(null)
  const [docFile, setDocFile] = useState<UploadedFile | null>(null)
  const [linesFile, setLinesFile] = useState<UploadedFile | null>(null)
  const [mappings, setMappings] = useState<MappingRow[]>([])
  const [docErrors, setDocErrors] = useState<CellValidationError[]>([])
  const [linesErrors, setLinesErrors] = useState<CellValidationError[]>([])
  const [errorHandling, setErrorHandling] = useState<ErrorHandlingMode>('cancel_rollback')
  const [result, setResult] = useState<ImportResult | null>(null)

  // ── Restore draft on mount ───────────────────────────────────────────────
  useEffect(() => {
    const draft = loadWizardDraft()
    if (!draft) return

    setStep(draft.step)
    setBizObject(draft.bizObject)
    setCopyFrom(draft.copyFrom ?? null)
    setMappings(draft.mappings)
    setErrorHandling(draft.errorHandling)

    if (draft.docFileData) {
      setDocFile(storedFileToUploaded(draft.docFileData))
    }
    if (draft.linesFileData) {
      setLinesFile(storedFileToUploaded(draft.linesFileData))
    }
    // Don't restore errors — user will re-validate if needed
  }, [])

  // ── Save draft whenever relevant state changes ───────────────────────────
  useEffect(() => {
    // Don't save if we're in the fresh empty state
    if (step === 1 && bizObject === null) return

    saveWizardDraft({
      step,
      bizObject,
      copyFrom,
      docFileData: docFile ? uploadedFileToStored(docFile) : null,
      linesFileData: linesFile ? uploadedFileToStored(linesFile) : null,
      mappings,
      errorHandling,
    })
  }, [step, bizObject, copyFrom, docFile, linesFile, mappings, errorHandling])

  function buildMappings(docCols: string[], linesCols: string[], bizObj: BizObject | null) {
    const config = bizObj ? getBizObjectConfig(bizObj.id) : null
    return config
      ? applyAutoMap(docCols, linesCols, config)
      : buildFallbackMappings(docCols, linesCols)
  }

  function runValidation(
    uploadedDoc: UploadedFile | null,
    uploadedLines: UploadedFile | null,
    currentMappings: MappingRow[],
    bizObj: BizObject | null,
  ) {
    const config = bizObj ? getBizObjectConfig(bizObj.id) : null
    if (!config) { setDocErrors([]); setLinesErrors([]); return }

    if (uploadedDoc) {
      setDocErrors(validateMappedRows(uploadedDoc.rows, currentMappings, config.fields.doc, 'doc'))
    }
    if (uploadedLines) {
      setLinesErrors(validateMappedRows(uploadedLines.rows, currentMappings, config.fields.lines, 'lines'))
    }
  }

  function handleSelectBizObject(o: BizObject) {
    setBizObject(o)
    setCopyFrom(null)
    setDocFile(null)
    setLinesFile(null)
    setMappings([])
    setDocErrors([])
    setLinesErrors([])
    setResult(null)
  }

  async function handleBothFiles(f: File, docSheet: string, linesSheet: string) {
    const [docData, linesData] = await Promise.all([readFile(f, docSheet), readFile(f, linesSheet)])
    const docUploaded: UploadedFile = { file: f, columns: docData.columns, rowCount: docData.rowCount, rows: docData.rows }
    const linesUploaded: UploadedFile = { file: f, columns: linesData.columns, rowCount: linesData.rowCount, rows: linesData.rows }
    const newMappings = buildMappings(docData.columns, linesData.columns, bizObject)
    setDocFile(docUploaded)
    setLinesFile(linesUploaded)
    setMappings(newMappings)
    runValidation(docUploaded, linesUploaded, newMappings, bizObject)
  }

  function handleReset() {
    clearWizardDraft()
    setStep(1)
    setBizObject(null)
    setCopyFrom(null)
    setDocFile(null)
    setLinesFile(null)
    setMappings([])
    setDocErrors([])
    setLinesErrors([])
    setErrorHandling('cancel_rollback')
    setResult(null)
  }

  // ── Handle import completion — set result + insert log if real import ────
  async function handleImportComplete(r: ImportResult) {
    setResult(r)

    if (r.mode === 'import' && bizObject) {
      try {
        await insertImportLog({
          user_id: user?.id ?? 'anonymous',
          user_name: user?.name ?? 'Unknown',
          user_email: user?.email ?? '',
          biz_object_id: bizObject.id,
          biz_object_label: bizObject.label,
          doc_filename: docFile?.file.name ?? null,
          lines_filename: linesFile?.file.name ?? null,
          mode: r.mode,
          status: r.status,
          total_records: r.totalRecords,
          success_count: r.successCount,
          failed_count: r.failedCount,
          sap_reference: r.sapReference ?? null,
          errors: r.errors,
          mappings: mappings,
          error_handling: errorHandling,
        })
      } catch (err) {
        console.error('Failed to insert import log:', err)
        toast.error('Import log could not be saved', { description: 'The import completed but the log entry failed to save.' })
      }

      // Clear draft after a successful real import
      if (r.status === 'success') {
        clearWizardDraft()
      }
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Data Import</h1>
          <p className="text-sm text-gray-500 mt-1">
            SAP B1 Data Transfer Workbench — import structured data into SAP Business One
          </p>
        </div>
        {(step > 1 || bizObject) && !result && (
          <button onClick={handleReset} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors">
            <RotateCcw className="w-3.5 h-3.5" /> Start Over
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-5 overflow-x-auto">
        <WizardProgress step={step} />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8">
        {step === 1 && (
          <StepBusinessObject
            selected={bizObject}
            onSelect={handleSelectBizObject}
            onNext={() => setStep(2)}
            copyFrom={copyFrom}
            onCopyFromChange={setCopyFrom}
          />
        )}
        {step === 2 && bizObject && (
          <StepUploadFiles
            bizObject={bizObject}
            docFile={docFile}
            linesFile={linesFile}
            docErrors={docErrors}
            linesErrors={linesErrors}
            onBothFiles={handleBothFiles}
            onDocRemove={() => {
              const newMappings = buildMappings([], linesFile?.columns ?? [], bizObject)
              setDocFile(null); setDocErrors([]); setMappings(newMappings)
            }}
            onLinesRemove={() => {
              const newMappings = buildMappings(docFile?.columns ?? [], [], bizObject)
              setLinesFile(null); setLinesErrors([]); setMappings(newMappings)
            }}
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
          <StepErrorHandling errorHandling={errorHandling} onChange={setErrorHandling} onNext={() => setStep(5)} onBack={() => setStep(3)} />
        )}
        {step === 5 && bizObject && docFile && linesFile && (
          <StepImport
            bizObject={bizObject}
            docFile={docFile}
            linesFile={linesFile}
            mappings={mappings}
            errorHandling={errorHandling}
            copyFrom={copyFrom}
            result={result}
            onResult={handleImportComplete}
            onClearResult={() => setResult(null)}
            onBack={() => setStep(4)}
            onReset={handleReset}
            onCopyTo={
              result && result.mode === 'import' && result.status === 'success' && result.sapReference
                ? () => navigate('/copy', { state: { sourceObjectId: bizObject.id, docNum: result!.sapReference } })
                : undefined
            }
          />
        )}
      </div>
    </div>
  )
}
