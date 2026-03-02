import { useState, useEffect, Fragment } from 'react'
import {
  CheckCircle2, XCircle, AlertTriangle, ChevronDown, ChevronRight,
  RefreshCw, Search, FileDown, ClipboardList
} from 'lucide-react'
import { getLogs } from '@/lib/mockSap'
import type { UploadLog } from '@/types/document'
import { cn, formatDateTime, formatDate } from '@/lib/utils'
import * as XLSX from 'xlsx'

const STATUS_CONFIG = {
  SUCCESS: { label: 'Success', icon: CheckCircle2, cls: 'bg-green-100 text-green-700', dot: 'bg-green-400' },
  PARTIAL: { label: 'Partial', icon: AlertTriangle, cls: 'bg-amber-100 text-amber-700', dot: 'bg-amber-400' },
  FAILED:  { label: 'Failed',  icon: XCircle,      cls: 'bg-red-100 text-red-700',     dot: 'bg-red-400' },
}

export default function Logs() {
  const [logs, setLogs] = useState<UploadLog[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SUCCESS' | 'PARTIAL' | 'FAILED'>('ALL')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [justRefreshed, setJustRefreshed] = useState(false)

  function refresh() {
    setIsRefreshing(true)
    setJustRefreshed(false)
    setTimeout(() => {
      setLogs(getLogs())
      setIsRefreshing(false)
      setJustRefreshed(true)
      setTimeout(() => setJustRefreshed(false), 2000)
    }, 600)
  }

  useEffect(() => {
    setLogs(getLogs())
  }, [])

  function exportLogs() {
    const data = filtered.map(log => ({
      ID: log.id,
      Filename: log.filename,
      'Uploaded By': log.uploadedBy,
      'Uploaded At': formatDateTime(log.uploadedAt),
      Database: log.databaseName ?? '',
      'Total Rows': log.rowCount,
      'Success': log.successCount,
      'Failed': log.failedCount,
      Status: log.status,
      'SAP Reference': log.sapReference ?? '',
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Upload Logs')
    XLSX.writeFile(wb, `upload_logs_${Date.now()}.xlsx`)
  }

  const filtered = logs.filter(log => {
    const matchSearch =
      log.filename.toLowerCase().includes(search.toLowerCase()) ||
      log.uploadedBy.toLowerCase().includes(search.toLowerCase()) ||
      (log.sapReference ?? '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'ALL' || log.status === statusFilter
    return matchSearch && matchStatus
  })

  const stats = {
    total: logs.length,
    success: logs.filter(l => l.status === 'SUCCESS').length,
    // partial: logs.filter(l => l.status === 'PARTIAL').length,
    failed: logs.filter(l => l.status === 'FAILED').length,
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Upload Logs</h1>
          <p className="text-sm text-gray-500 mt-1">Track all document upload history and SAP submission results</p>
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
          {/* Clear button hidden for now — uncomment to re-enable
          <button
            onClick={clearLogs}
            disabled={logs.length === 0}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-red-200 rounded-xl text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Clear
          </button>
          */}
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
          { label: 'Total Uploads', value: stats.total, cls: 'text-gray-800', bg: 'bg-white' },
          { label: 'Successful', value: stats.success, cls: 'text-green-700', bg: 'bg-green-50' },
          // { label: 'Partial', value: stats.partial, cls: 'text-amber-700', bg: 'bg-amber-50' },
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
            placeholder="Search by filename, user, SAP ref..."
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
            <p className="text-sm font-medium text-gray-500">No upload logs found</p>
            <p className="text-xs text-gray-400 mt-1">{logs.length === 0 ? 'Upload a document to see logs here.' : 'Try adjusting your search or filters.'}</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500">
                <th className="w-8 px-5 py-3" />
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
              const cfg = STATUS_CONFIG[log.status]
              const StatusIcon = cfg.icon
              const isExpanded = expandedId === log.id

              return (
                <Fragment key={log.id}>
                  <tr
                    onClick={() => setExpandedId(isExpanded ? null : log.id)}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <td className="px-5 py-3.5 text-gray-400 w-8">
                      {isExpanded
                        ? <ChevronDown className="w-4 h-4 text-gray-500" />
                        : <ChevronRight className="w-4 h-4" />
                      }
                    </td>
                    <td className="px-3 py-3.5 text-sm font-medium text-gray-900 max-w-[220px]">
                      <span className="block truncate">{log.filename}</span>
                    </td>
                    <td className="px-3 py-3.5 text-sm text-gray-600 whitespace-nowrap">{log.uploadedBy}</td>
                    <td className="px-3 py-3.5 text-xs text-gray-400 whitespace-nowrap">{formatDate(log.uploadedAt)}</td>
                    <td className="px-3 py-3.5 text-sm text-gray-700 text-center">{log.rowCount}</td>
                    <td className="px-3 py-3.5 text-sm text-green-600 font-medium text-center">{log.successCount}</td>
                    <td className={cn('px-3 py-3.5 text-sm font-medium text-center', log.failedCount > 0 ? 'text-red-500' : 'text-gray-400')}>{log.failedCount}</td>
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
                    <td colSpan={8} className="p-0">
                    <div className="px-5 pb-4 pt-2 bg-gray-50/80 border-t border-gray-100 space-y-3">
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        {[
                          { label: 'Log ID', value: log.id },
                          { label: 'Upload Time', value: formatDateTime(log.uploadedAt) },
                          { label: 'Database', value: log.databaseName ?? '—' },
                          { label: 'SAP Reference', value: log.sapReference ?? '—' },
                          { label: 'Status', value: log.status },
                        ].map(item => (
                          <div key={item.label} className="bg-white rounded-lg border border-gray-100 p-3">
                            <p className="text-xs text-gray-400">{item.label}</p>
                            <p className="text-xs font-semibold text-gray-800 mt-0.5 font-mono break-all">{item.value}</p>
                          </div>
                        ))}
                      </div>

                      {log.errors.length > 0 && (
                        <div className="bg-white rounded-lg border border-red-100 p-3">
                          <p className="text-xs font-semibold text-red-700 mb-2">Validation Errors ({log.errors.length})</p>
                          <div className="max-h-36 overflow-y-auto scrollbar-thin space-y-1">
                            {log.errors.map((e, i) => (
                              <div key={i} className="flex items-start gap-2 text-xs text-red-600">
                                <span className="font-mono bg-red-50 px-1.5 py-0.5 rounded flex-shrink-0">Row {e.row}</span>
                                <span className="font-medium">{e.column}:</span>
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
