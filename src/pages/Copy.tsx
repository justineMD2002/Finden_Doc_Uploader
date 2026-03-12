import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import {
  TrendingUp, ShoppingCart, Package, Check, GitMerge,
  CheckCircle2, XCircle, RotateCcw, Loader2, AlertTriangle,
  Plus, Trash2, ChevronDown, ChevronRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { BIZ_CATEGORIES, BIZ_OBJECTS, type BizCategory } from '@/types/wizard'
import { getBizObjectConfig } from '@/lib/sapFields'
import { getBizObjectLabel, COPY_FROM_EDGES, BASE_TYPE_CODES } from '@/lib/copyRelations'
import { useSap } from '@/context/SapContext'
import { fetchDocument, copyDocument, type SourceDocLines } from '@/lib/sapService'

const categoryIcon = (cat: BizCategory) => {
  if (cat === 'sales')      return <TrendingUp className="w-4 h-4" />
  if (cat === 'purchasing') return <ShoppingCart className="w-4 h-4" />
  return <Package className="w-4 h-4" />
}

const getValidSourceIds = (): string[] => {
  const sources = new Set<string>()
  for (const srcs of Object.values(COPY_FROM_EDGES)) {
    for (const s of srcs) sources.add(s)
  }
  return [...sources]
}

const getCopyToTargets = (sourceId: string): string[] => {
  return Object.entries(COPY_FROM_EDGES)
    .filter(([, srcs]) => srcs.includes(sourceId))
    .map(([target]) => target)
}

type DocOpenStatus = 'open' | 'partial' | 'closed'

const getDocOpenStatus = (doc: { header: Record<string, unknown>; lines: Record<string, unknown>[] }): DocOpenStatus => {
  if (doc.header['DocumentStatus'] === 'bost_Close') return 'closed'
  const openLines = doc.lines.filter(l => {
    const oq = l['OpenQuantity'] ?? l['RemainingOpenQuantity']
    return typeof oq === 'number' ? oq > 0 : true // if field absent assume open
  })
  if (openLines.length === 0 && doc.lines.length > 0) return 'closed'
  if (openLines.length < doc.lines.length) return 'partial'
  return 'open'
}

interface FetchedDoc {
  docEntry: number
  docNum: number
  header: Record<string, unknown>
  lines: Record<string, unknown>[]
  expanded: boolean
  openStatus: DocOpenStatus
}

interface CopyResult {
  status: 'success' | 'error'
  docNum?: number
  docEntry?: number
  error?: string
  sourceCount: number
  targetLabel: string
}

const OPEN_STATUS_BADGE: Record<DocOpenStatus, { label: string; cls: string }> = {
  open:    { label: 'Open',     cls: 'bg-green-100 text-green-700' },
  partial: { label: 'Partial',  cls: 'bg-amber-100 text-amber-700' },
  closed:  { label: 'Closed',   cls: 'bg-red-100 text-red-700' },
}

const SourceDocRow = ({
  sourceObjectId, doc, onRemove, onToggle,
}: {
  sourceObjectId: string
  doc: FetchedDoc
  onRemove: () => void
  onToggle: () => void
}) => {
  const config = getBizObjectConfig(sourceObjectId)
  const lineColumns = config
    ? config.fields.lines.map(f => f.field).filter(f => doc.lines.some(l => l[f] !== undefined))
    : doc.lines.length > 0 ? Object.keys(doc.lines[0]).slice(0, 8) : []

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
        <button type="button" onClick={onToggle}
          className="flex items-center gap-2 text-sm font-semibold text-gray-800 hover:text-brand-700 transition-colors">
          {doc.expanded
            ? <ChevronDown className="w-4 h-4 text-gray-400" />
            : <ChevronRight className="w-4 h-4 text-gray-400" />}
          <span className="text-brand-700">{getBizObjectLabel(sourceObjectId)}</span>
          <span className="text-gray-500">#{doc.docNum}</span>
          <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', OPEN_STATUS_BADGE[doc.openStatus].cls)}>
            {OPEN_STATUS_BADGE[doc.openStatus].label}
          </span>
          <span className="text-xs font-normal text-gray-400 ml-1">
            — DocEntry {doc.docEntry} · {doc.lines.length} line{doc.lines.length !== 1 ? 's' : ''}
          </span>
        </button>
        <button type="button" onClick={onRemove} title="Remove"
          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      {doc.expanded && doc.lines.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-white border-b border-gray-100">
                {lineColumns.map(col => (
                  <th key={col} className="text-left px-3 py-2 font-semibold text-gray-500 whitespace-nowrap">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {doc.lines.map((line, i) => (
                <tr key={i} className={cn('border-b border-gray-50 last:border-0', i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40')}>
                  {lineColumns.map(col => (
                    <td key={col} className="px-3 py-1.5 text-gray-700 whitespace-nowrap max-w-[160px] truncate"
                      title={String(line[col] ?? '')}>{String(line[col] ?? '')}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {doc.expanded && doc.lines.length === 0 && (
        <p className="text-xs text-gray-400 px-4 py-3">No lines found in this document.</p>
      )}
    </div>
  )
}

const Copy = () => {
  const { session } = useSap()
  const location = useLocation()
  const locationState = location.state as { sourceObjectId?: string; docNum?: string | number } | null

  const [sourceObjectId, setSourceObjectId] = useState<string | null>(locationState?.sourceObjectId ?? null)
  const [sourceDocs,     setSourceDocs]     = useState<FetchedDoc[]>([])
  const [docNumInput,    setDocNumInput]    = useState<string>(locationState?.docNum ? String(locationState.docNum) : '')
  const [fetching,       setFetching]       = useState(false)
  const [targetObjectId, setTargetObjectId] = useState<string | null>(null)
  const [copying,        setCopying]        = useState(false)
  const [copyResult,     setCopyResult]     = useState<CopyResult | null>(null)

  const validSourceIds = getValidSourceIds()
  const hasSession     = !!session
  const copyTargets    = sourceObjectId ? getCopyToTargets(sourceObjectId) : []
  const hasClosedDocs  = sourceDocs.some(d => d.openStatus === 'closed')

  // Auto-fetch if navigated here from Import result screen
  useEffect(() => {
    if (locationState?.sourceObjectId && locationState?.docNum && session) {
      fetchAndAdd(locationState.sourceObjectId, Number(locationState.docNum))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchAndAdd = async (srcId: string, num: number) => {
    if (!session) return
    if (sourceDocs.some(d => d.docNum === num)) {
      toast.warning(`${getBizObjectLabel(srcId)} #${num} is already added.`)
      return
    }
    setFetching(true)
    try {
      const doc = await fetchDocument(srcId, num, session.sessionId)
      if (!doc) {
        toast.error('Document not found', { description: `No ${getBizObjectLabel(srcId)} with DocNum ${num} in SAP.` })
        return
      }
      const openStatus = getDocOpenStatus(doc)
      if (openStatus === 'closed') {
        toast.warning(`${getBizObjectLabel(srcId)} #${num} is fully closed`, {
          description: 'All lines have been fully received/invoiced. Copying it will duplicate already-processed quantities.',
        })
      } else if (openStatus === 'partial') {
        toast.info(`${getBizObjectLabel(srcId)} #${num} is partially closed`, {
          description: 'Some lines have already been fully received/invoiced and will still be included in the copy.',
        })
      }
      setSourceDocs(prev => [...prev, { ...doc, expanded: true, openStatus }])
      setDocNumInput('')
    } catch (err) {
      toast.error('Fetch failed', { description: err instanceof Error ? err.message : 'Unknown error' })
    } finally {
      setFetching(false)
    }
  }

  const handleAddDoc = () => {
    const n = parseInt(docNumInput, 10)
    if (!sourceObjectId || isNaN(n) || n <= 0 || !session) return
    fetchAndAdd(sourceObjectId, n)
  }

  const handleSelectSource = (id: string) => {
    if (id !== sourceObjectId) {
      setSourceObjectId(id)
      setSourceDocs([])
      setTargetObjectId(null)
      setCopyResult(null)
      setDocNumInput('')
    }
  }

  const handleRemoveDoc = (docNum: number) => {
    setSourceDocs(prev => prev.filter(d => d.docNum !== docNum))
  }

  const toggleExpanded = (docNum: number) => {
    setSourceDocs(prev => prev.map(d => d.docNum === docNum ? { ...d, expanded: !d.expanded } : d))
  }

  const handleCopy = async () => {
    if (!sourceObjectId || sourceDocs.length === 0 || !targetObjectId || !session) return

    // Validate all source docs have matching header fields required by SAP
    if (sourceDocs.length > 1) {
      const MUST_MATCH: { field: string; label: string }[] = [
        { field: 'CardCode',         label: 'Business Partner (CardCode)' },
        { field: 'DocCurrency',      label: 'Currency' },
        { field: 'PaymentGroupCode', label: 'Payment Terms' },
        { field: 'ShipToCode',       label: 'Ship-To Address' },
        { field: 'BillToCode',       label: 'Bill-To Address' },
      ]
      const mismatches: string[] = []
      for (const { field, label } of MUST_MATCH) {
        const values = [...new Set(sourceDocs.map(d => d.header[field]).filter(v => v !== undefined && v !== null && v !== ''))]
        if (values.length > 1) {
          mismatches.push(`${label}: ${values.join(' vs ')}`)
        }
      }
      if (mismatches.length > 0) {
        toast.error('Source documents are incompatible', {
          description: mismatches.join(' · '),
          duration: 8000,
        })
        return
      }
    }

    // Each source doc carries its own BaseEntry — this is what creates the SAP relation chain
    const sources: SourceDocLines[] = sourceDocs.map(doc => ({
      sourceObjectId,
      sourceObjectType: BASE_TYPE_CODES[sourceObjectId] ?? 0,
      sourceDocEntry:   doc.docEntry,
      lines:            doc.lines,
    }))

    // Carry common header fields from the first source document
    const firstHeader = sourceDocs[0].header
    const headerOverrides: Record<string, unknown> = {}
    for (const field of ['CardCode', 'CardName', 'NumAtCard', 'Comments']) {
      if (firstHeader[field] !== undefined && firstHeader[field] !== null && firstHeader[field] !== '') {
        headerOverrides[field] = firstHeader[field]
      }
    }

    setCopying(true)
    try {
      const result = await copyDocument(sources, targetObjectId, headerOverrides, session.sessionId)
      setCopyResult({
        status: 'success',
        docNum: result.docNum,
        docEntry: result.docEntry,
        sourceCount: sourceDocs.length,
        targetLabel: getBizObjectLabel(targetObjectId),
      })
      toast.success('Document copied successfully', {
        description: `${getBizObjectLabel(targetObjectId)} #${result.docNum} created in SAP.`,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setCopyResult({ status: 'error', error: msg, sourceCount: sourceDocs.length, targetLabel: getBizObjectLabel(targetObjectId) })
      toast.error('Copy failed', { description: msg })
    } finally {
      setCopying(false)
    }
  }

  const handleReset = () => {
    setSourceObjectId(null)
    setSourceDocs([])
    setDocNumInput('')
    setTargetObjectId(null)
    setCopyResult(null)
  }

  // ── Result screen ─────────────────────────────────────────────────────────

  if (copyResult) {
    const ok = copyResult.status === 'success'
    return (
      <div className="p-8 max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Copy Document</h1>
          <p className="text-sm text-gray-500 mt-1">Copy existing SAP B1 documents into a new target business object.</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8">
          <div className={cn('rounded-2xl border p-6 space-y-4', ok ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200')}>
            <div className="flex items-start gap-4">
              <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', ok ? 'bg-green-100' : 'bg-red-100')}>
                {ok ? <CheckCircle2 className="w-5 h-5 text-green-600" /> : <XCircle className="w-5 h-5 text-red-600" />}
              </div>
              <div className="flex-1">
                <p className={cn('font-bold text-base', ok ? 'text-green-800' : 'text-red-800')}>
                  {ok ? 'Copy Successful' : 'Copy Failed'}
                </p>
                {ok ? (
                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'Source', value: `${getBizObjectLabel(sourceObjectId ?? '')} (${copyResult.sourceCount} doc${copyResult.sourceCount !== 1 ? 's' : ''})` },
                      { label: 'Target', value: copyResult.targetLabel },
                      { label: 'SAP DocNum', value: String(copyResult.docNum ?? '-') },
                      { label: 'SAP DocEntry', value: String(copyResult.docEntry ?? '-') },
                    ].map(s => (
                      <div key={s.label} className="bg-white/70 rounded-lg p-2.5">
                        <p className="text-xs text-gray-500">{s.label}</p>
                        <p className="text-sm font-semibold text-gray-800 mt-0.5 truncate">{s.value}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-red-700">{copyResult.error}</p>
                )}
                {ok && (
                  <p className="mt-3 text-xs text-green-700 bg-green-100 rounded-lg px-3 py-2">
                    The document relation chain is now visible in SAP B1. Open the new {copyResult.targetLabel} and click the relationship icon to see the linked source document{copyResult.sourceCount !== 1 ? 's' : ''}.
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1 border-t border-white/60">
              <button onClick={handleReset}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors">
                <RotateCcw className="w-4 h-4" /> Copy Another
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Main flow ─────────────────────────────────────────────────────────────

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Copy Document</h1>
          <p className="text-sm text-gray-500 mt-1">
            Copy one or more SAP B1 documents into a new target. Each source line is linked via{' '}
            <span className="font-mono text-xs bg-gray-100 px-1 rounded">BaseType / BaseEntry / BaseLine</span>{' '}
            — the relation chain will be visible in SAP B1.
          </p>
        </div>
        {(sourceObjectId || sourceDocs.length > 0) && (
          <button onClick={handleReset}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors whitespace-nowrap shrink-0">
            <RotateCcw className="w-3.5 h-3.5" /> Start Over
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8 space-y-8">

        {/* ── Step 1: Source module ── */}
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-brand-600 text-white text-xs font-bold flex items-center justify-center shrink-0">1</div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Select Source Module</h2>
              <p className="text-xs text-gray-500 mt-0.5">Choose the document type you are copying from.</p>
            </div>
          </div>
          <div className="space-y-4 pl-10">
            {BIZ_CATEGORIES.map(cat => {
              const objects = BIZ_OBJECTS.filter(o => o.category === cat.id && validSourceIds.includes(o.id))
              if (objects.length === 0) return null
              return (
                <div key={cat.id}>
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="w-7 h-7 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
                      {categoryIcon(cat.id)}
                    </div>
                    <h3 className="text-sm font-semibold text-gray-700">{cat.label}</h3>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pl-2">
                    {objects.map(obj => {
                      const isSelected = sourceObjectId === obj.id
                      return (
                        <button key={obj.id} type="button" onClick={() => handleSelectSource(obj.id)}
                          className={cn('text-left px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all',
                            isSelected
                              ? 'border-brand-500 bg-brand-50 text-brand-700 shadow-sm ring-2 ring-brand-100'
                              : 'border-gray-200 bg-white text-gray-700 hover:border-brand-300 hover:bg-brand-50/40')}>
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
        </div>

        {/* ── Step 2: Add document numbers ── */}
        {sourceObjectId && (
          <div className="space-y-4 border-t border-gray-100 pt-6">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-brand-600 text-white text-xs font-bold flex items-center justify-center shrink-0">2</div>
              <div>
                <h2 className="text-base font-bold text-gray-900">Add Source Documents</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Enter one or more {getBizObjectLabel(sourceObjectId)} document numbers. Each is fetched from SAP and its lines included.
                </p>
              </div>
            </div>
            <div className="pl-10 space-y-4">
              {sourceDocs.length > 0 && (
                <div className="space-y-3">
                  {sourceDocs.map(doc => (
                    <SourceDocRow key={doc.docNum} sourceObjectId={sourceObjectId} doc={doc}
                      onRemove={() => handleRemoveDoc(doc.docNum)}
                      onToggle={() => toggleExpanded(doc.docNum)} />
                  ))}
                  {(() => {
                    if (sourceDocs.length < 2) return null
                    const MUST_MATCH: { field: string; label: string }[] = [
                      { field: 'CardCode',         label: 'Business Partner' },
                      { field: 'DocCurrency',      label: 'Currency' },
                      { field: 'PaymentGroupCode', label: 'Payment Terms' },
                      { field: 'ShipToCode',       label: 'Ship-To' },
                      { field: 'BillToCode',       label: 'Bill-To' },
                    ]
                    const mismatches = MUST_MATCH.flatMap(({ field, label }) => {
                      const values = [...new Set(sourceDocs.map(d => d.header[field]).filter(v => v !== undefined && v !== null && v !== ''))]
                      return values.length > 1 ? [`${label} (${values.join(' vs ')})`] : []
                    })
                    return mismatches.length > 0 ? (
                      <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold mb-1">Incompatible source documents — copy will be blocked:</p>
                          <ul className="space-y-0.5 list-disc list-inside">
                            {mismatches.map(m => <li key={m}>{m}</li>)}
                          </ul>
                        </div>
                      </div>
                    ) : null
                  })()}
                  <div className="flex items-center gap-2 text-xs text-gray-500 px-1">
                    <GitMerge className="w-3.5 h-3.5 text-brand-400" />
                    {sourceDocs.reduce((s, d) => s + d.lines.length, 0)} total lines from {sourceDocs.length} document{sourceDocs.length !== 1 ? 's' : ''}{' '}
                    — each line carries its own <span className="font-mono bg-gray-100 px-1 rounded">BaseEntry</span>
                  </div>
                </div>
              )}
              <div className="flex gap-3">
                <input type="number" min={1} value={docNumInput}
                  onChange={e => setDocNumInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddDoc()}
                  placeholder={`${getBizObjectLabel(sourceObjectId)} DocNum…`}
                  disabled={!hasSession}
                  className="flex-1 px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-400 disabled:opacity-50" />
                <button type="button" onClick={handleAddDoc}
                  disabled={!docNumInput || !hasSession || fetching}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                  {fetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {fetching ? 'Fetching…' : 'Add'}
                </button>
              </div>
              {!hasSession && (
                <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  Connect to SAP first to fetch documents.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Step 3: Select target + copy ── */}
        {sourceDocs.length > 0 && copyTargets.length > 0 && (
          <div className="space-y-4 border-t border-gray-100 pt-6">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-brand-600 text-white text-xs font-bold flex items-center justify-center shrink-0">3</div>
              <div>
                <h2 className="text-base font-bold text-gray-900">Select Target Module</h2>
                <p className="text-xs text-gray-500 mt-0.5">Choose the document type to create from the fetched data.</p>
              </div>
            </div>
            <div className="pl-10 space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {copyTargets.map(targetId => {
                  const obj = BIZ_OBJECTS.find(b => b.id === targetId)
                  if (!obj) return null
                  const isSelected = targetObjectId === targetId
                  return (
                    <button key={targetId} type="button" onClick={() => setTargetObjectId(targetId)}
                      className={cn('text-left px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all',
                        isSelected
                          ? 'border-brand-500 bg-brand-50 text-brand-700 shadow-sm ring-2 ring-brand-100'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-brand-300 hover:bg-brand-50/40')}>
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

              {/* Relation chain preview */}
              {targetObjectId && (
                <div className="flex items-center gap-2 flex-wrap bg-brand-50 border border-brand-100 rounded-xl px-4 py-3">
                  <GitMerge className="w-4 h-4 text-brand-500 shrink-0" />
                  <span className="text-sm font-medium text-brand-700">SAP Relation Chain:</span>
                  {sourceDocs.map((doc, i) => (
                    <span key={doc.docNum} className="flex items-center gap-1 text-sm text-gray-700">
                      {i > 0 && <span className="text-gray-400 mx-0.5">+</span>}
                      <span className="font-medium">{getBizObjectLabel(sourceObjectId ?? '')} #{doc.docNum}</span>
                      <span className="text-[10px] text-gray-400">(Entry {doc.docEntry})</span>
                    </span>
                  ))}
                  <span className="text-gray-400 mx-1">&rarr;</span>
                  <span className="font-semibold text-brand-800">{getBizObjectLabel(targetObjectId)}</span>
                  <span className="text-xs text-gray-400">(new)</span>
                </div>
              )}

              {hasClosedDocs && (
                <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Cannot copy — closed documents included</p>
                    <p className="mt-0.5 text-red-600">One or more source documents are fully closed (all quantities received/invoiced). Remove them to proceed.</p>
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <button onClick={handleCopy} disabled={!targetObjectId || copying || hasClosedDocs}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm">
                  {copying ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitMerge className="w-4 h-4" />}
                  {copying
                    ? 'Copying…'
                    : targetObjectId
                    ? `Copy To ${getBizObjectLabel(targetObjectId)}`
                    : 'Copy To…'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

export default Copy
