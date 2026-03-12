import { useState, useEffect, Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CheckCircle2, XCircle, AlertTriangle, ChevronDown, ChevronRight,
  RefreshCw, Search, FileDown, ClipboardList, Loader2, GitMerge,
} from 'lucide-react'
import { fetchImportLogs, type ImportLogRow } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { cn, formatDateTime, formatDate } from '@/lib/utils'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import { COPY_FROM_EDGES } from '@/lib/copyRelations'

const VALID_COPY_SOURCES = new Set(Object.values(COPY_FROM_EDGES).flat())

const STATUS_CONFIG = {
  SUCCESS: { label: 'Success', icon: CheckCircle2, cls: 'bg-green-100 text-green-700', dot: 'bg-green-400' },
  PARTIAL: { label: 'Partial', icon: AlertTriangle, cls: 'bg-amber-100 text-amber-700', dot: 'bg-amber-400' },
  FAILED:  { label: 'Failed',  icon: XCircle,      cls: 'bg-red-100 text-red-700',     dot: 'bg-red-400' },
}

type StatusKey = keyof typeof STATUS_CONFIG

const statusKey = (log: ImportLogRow): StatusKey => {
  return log.status.toUpperCase() as StatusKey
}

const Logs = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [logs, setLogs] = useState<ImportLogRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | StatusKey>('ALL')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [justRefreshed, setJustRefreshed] = useState(false)

  const loadLogs = async () => {
    try {
      const data = await fetchImportLogs(user?.email)
      setLogs(data)
    } catch (err) {
      console.error(err)
      toast.error('Failed to load import logs', { description: 'Please check your connection and try again.' })
    }
  }

  const refresh = async () => {
    setIsRefreshing(true)
    setJustRefreshed(false)
    try {
      await loadLogs()
      setJustRefreshed(true)
      setTimeout(() => setJustRefreshed(false), 2000)
    } finally {
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    loadLogs().finally(() => setIsLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const exportLogs = () => {
    const data = filtered.map(log => ({
      ID: log.id ?? '',
      'Business Object': log.biz_object_label,
      'Doc Filename': log.doc_filename ?? '',
      'Lines Filename': log.lines_filename ?? '',
      'Uploaded By': log.user_name,
      'User Email': log.user_email,
      'Date': formatDateTime(log.created_at ?? ''),
      Mode: log.mode,
      'Total Rows': log.total_records,
      'Success': log.success_count,
      'Failed': log.failed_count,
      Status: statusKey(log),
      'SAP Reference': log.sap_reference ?? '',
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Import Logs')
    XLSX.writeFile(wb, `import_logs_${Date.now()}.xlsx`)
  }

  const filtered = logs.filter(log => {
    const filename = log.doc_filename ?? log.lines_filename ?? ''
    const matchSearch =
      filename.toLowerCase().includes(search.toLowerCase()) ||
      log.user_name.toLowerCase().includes(search.toLowerCase()) ||
      (log.sap_reference ?? '').toLowerCase().includes(search.toLowerCase()) ||
      log.biz_object_label.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'ALL' || statusKey(log) === statusFilter
    return matchSearch && matchStatus
  })

  const stats = {
    total: logs.length,
    success: logs.filter(l => l.status === 'success').length,
    failed: logs.filter(l => l.status === 'failed').length,
  }

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-64">
        <div className="flex items-center gap-3 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading import logs...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Import Logs</h1>
          <p className="text-sm text-gray-500 mt-1">Track all SAP B1 import history and submission results</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportLogs}
            disabled={filtered.length === 0}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <FileDown className="w-4 h-4" />
            Export
          </button>
          <button
            onClick={refresh}
            disabled={isRefreshing}
            className={cn(
              'flex items-center gap-2 px-3 py-2 text-sm border rounded-xl transition-all duration-200',
              justRefreshed
                ? 'border-green-300 bg-green-50 text-green-700'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50',
              isRefreshing && 'opacity-70 cursor-not-allowed'
            )}
          >
            <RefreshCw className={cn('w-4 h-4 transition-transform duration-500', isRefreshing && 'animate-spin')} />
            {isRefreshing ? 'Refreshing...' : justRefreshed ? 'Updated!' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Imports', value: stats.total, cls: 'text-gray-800', bg: 'bg-white' },
          { label: 'Successful', value: stats.success, cls: 'text-green-700', bg: 'bg-green-50' },
          { label: 'Failed', value: stats.failed, cls: 'text-red-700', bg: 'bg-red-50' },
        ].map(s => (
          <div key={s.label} className={cn('rounded-xl border border-gray-100 shadow-sm p-4', s.bg)}>
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className={cn('text-xs font-medium mt-1', s.cls)}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by filename, user, business object, SAP ref..."
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-400"
          />
        </div>
        <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl p-1">
          {(['ALL', 'SUCCESS', 'FAILED'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-lg transition-all',
                statusFilter === s
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-gray-500 hover:bg-gray-50'
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
              <ClipboardList className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-sm font-medium text-gray-500">No import logs found</p>
            <p className="text-xs text-gray-400 mt-1">{logs.length === 0 ? 'Run an import to see logs here.' : 'Try adjusting your search or filters.'}</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500">
                <th className="w-8 px-5 py-3" />
                <th className="text-left px-3 py-3">Business Object</th>
                <th className="text-left px-3 py-3">Filename</th>
                <th className="text-left px-3 py-3">Uploaded By</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Date</th>
                <th className="text-center px-3 py-3">Rows</th>
                <th className="text-center px-3 py-3">Success</th>
                <th className="text-center px-3 py-3">Failed</th>
                <th className="text-left px-3 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
            {filtered.map(log => {
              const sk = statusKey(log)
              const cfg = STATUS_CONFIG[sk] ?? STATUS_CONFIG.FAILED
              const StatusIcon = cfg.icon
              const isExpanded = expandedId === log.id
              const filename = log.doc_filename ?? log.lines_filename ?? '—'

              return (
                <Fragment key={log.id}>
                  <tr
                    onClick={() => setExpandedId(isExpanded ? null : (log.id ?? null))}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <td className="px-5 py-3.5 text-gray-400 w-8">
                      {isExpanded
                        ? <ChevronDown className="w-4 h-4 text-gray-500" />
                        : <ChevronRight className="w-4 h-4" />
                      }
                    </td>
                    <td className="px-3 py-3.5 text-sm font-medium text-gray-700 max-w-[160px]">
                      <span className="block truncate">{log.biz_object_label}</span>
                    </td>
                    <td className="px-3 py-3.5 text-sm text-gray-900 max-w-[180px]">
                      <span className="block truncate">{filename}</span>
                    </td>
                    <td className="px-3 py-3.5 text-sm text-gray-600 whitespace-nowrap">{log.user_name}</td>
                    <td className="px-3 py-3.5 text-xs text-gray-400 whitespace-nowrap">{formatDate(log.created_at ?? '')}</td>
                    <td className="px-3 py-3.5 text-sm text-gray-700 text-center">{log.total_records}</td>
                    <td className="px-3 py-3.5 text-sm text-green-600 font-medium text-center">{log.success_count}</td>
                    <td className={cn('px-3 py-3.5 text-sm font-medium text-center', log.failed_count > 0 ? 'text-red-500' : 'text-gray-400')}>{log.failed_count}</td>
                    <td className="px-3 py-3.5">
                      <span className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium w-fit', cfg.cls)}>
                        <StatusIcon className="w-3 h-3" />
                        {cfg.label}
                      </span>
                    </td>
                  </tr>

                  {/* Expanded detail */}
                  {isExpanded && (
                  <tr>
                    <td colSpan={9} className="p-0">
                    <div className="px-5 pb-4 pt-2 bg-gray-50/80 border-t border-gray-100 space-y-3">
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        {[
                          { label: 'Log ID',          value: log.id ?? '—' },
                          { label: 'Import Time',     value: formatDateTime(log.created_at ?? '') },
                          { label: 'Business Object', value: log.biz_object_label },
                          { label: 'SAP Reference',   value: log.sap_reference ?? '—' },
                          { label: 'Status',          value: sk },
                        ].map(item => (
                          <div key={item.label} className="bg-white rounded-lg border border-gray-100 p-3">
                            <p className="text-xs text-gray-400">{item.label}</p>
                            <p className="text-xs font-semibold text-gray-800 mt-0.5 font-mono break-all">{item.value}</p>
                          </div>
                        ))}
                      </div>

                      {VALID_COPY_SOURCES.has(log.biz_object_id) && log.sap_reference && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={e => {
                              e.stopPropagation()
                              navigate('/copy', { state: { sourceObjectId: log.biz_object_id, docNum: log.sap_reference } })
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-brand-50 border border-brand-200 text-brand-700 rounded-lg hover:bg-brand-100 transition-colors"
                          >
                            <GitMerge className="w-3.5 h-3.5" />
                            Copy Document
                          </button>
                        </div>
                      )}

                      {log.errors.length > 0 && (
                        <div className="bg-white rounded-lg border border-red-100 p-3">
                          <p className="text-xs font-semibold text-red-700 mb-2">Errors ({log.errors.length})</p>
                          <div className="max-h-36 overflow-y-auto scrollbar-thin space-y-1">
                            {log.errors.map((e, i) => (
                              <div key={i} className="flex items-start gap-2 text-xs text-red-600">
                                <span className="font-mono bg-red-50 px-1.5 py-0.5 rounded flex-shrink-0">Row {e.row}</span>
                                <span className="font-medium">{e.field}:</span>
                                <span>{e.message}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </td>
                  </tr>
                  )}
                </Fragment>
              )
            })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default Logs
