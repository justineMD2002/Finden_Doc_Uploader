import { useState } from 'react'
import { Loader2, Send, RotateCcw, CheckCircle2, XCircle, Server } from 'lucide-react'
import { toast } from 'sonner'
import { parseFile } from '@/lib/parser'
import { submitToSAP } from '@/lib/mockSap'
import { useAuth } from '@/context/AuthContext'
import type { DocumentRow, ValidationError, UploadLog, Company } from '@/types/document'
import FormatGuide from '@/components/FormatGuide'
import FileDropzone from '@/components/FileDropzone'
import PreviewTable from '@/components/PreviewTable'
import { cn } from '@/lib/utils'
import { SAP_SERVER, COMPANIES } from '@/lib/databases'

type UploadState = 'idle' | 'parsing' | 'preview' | 'uploading' | 'done'

interface UploadResult {
  log: UploadLog
}

export default function Upload() {
  const { user } = useAuth()

  const [state, setState] = useState<UploadState>('idle')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [rows, setRows] = useState<DocumentRow[]>([])
  const [errors, setErrors] = useState<ValidationError[]>([])
  const [result, setResult] = useState<UploadResult | null>(null)
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)

  async function handleFileSelect(file: File) {
    setSelectedFile(file)
    setState('parsing')
    setRows([])
    setErrors([])
    setResult(null)

    try {
      const parsed = await parseFile(file)
      setRows(parsed.rows)
      setErrors(parsed.errors)
      setState('preview')
    } catch (err) {
      toast.error('Failed to parse file', { description: String(err) })
      setState('idle')
      setSelectedFile(null)
    }
  }

  function handleClear() {
    setState('idle')
    setSelectedFile(null)
    setRows([])
    setErrors([])
    setResult(null)
  }

  async function handleUpload() {
    if (!selectedFile || !user) return
    setState('uploading')

    try {
      const log = await submitToSAP(rows, errors, selectedFile.name, user.name, selectedCompany?.id, selectedCompany?.companyName)
      setResult({ log })
      setState('done')

      if (log.status === 'SUCCESS') {
        toast.success('Document uploaded to SAP successfully!', {
          description: `SAP Reference: ${log.sapReference} · ${log.successCount} row${log.successCount !== 1 ? 's' : ''} processed`,
          duration: 6000,
        })
      } else if (log.status === 'PARTIAL') {
        toast.warning('Document partially uploaded', {
          description: `${log.successCount} rows succeeded, ${log.failedCount} rows failed validation.`,
          duration: 6000,
        })
      } else {
        toast.error('Upload failed — document not sent to SAP', {
          description: `${log.failedCount} row${log.failedCount !== 1 ? 's' : ''} failed. Please fix the errors and try again.`,
          duration: 8000,
        })
      }
    } catch (err) {
      toast.error('Unexpected error during upload', { description: String(err) })
      setState('preview')
    }
  }

  const isParsing = state === 'parsing'
  const isUploading = state === 'uploading'
  const showPreview = state === 'preview' || state === 'uploading' || state === 'done'

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Upload Document</h1>
        <p className="text-sm text-gray-500 mt-1">Upload CSV or Excel files to send document data to SAP</p>
      </div>

      {/* Company Selector — SAP B1 style */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Server banner */}
        <div className="flex items-center gap-3 px-6 py-3 bg-gray-50 border-b border-gray-100">
          <Server className="w-4 h-4 text-brand-600 flex-shrink-0" />
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Current Server</span>
          <span className="text-xs font-mono font-semibold text-gray-800 bg-white border border-gray-200 rounded px-2 py-0.5">
            {SAP_SERVER.dbType}
          </span>
          <span className="text-gray-300">—</span>
          <span className="text-xs font-semibold text-brand-700">{SAP_SERVER.serverName}</span>
          {!selectedCompany && (
            <span className="ml-auto text-xs text-amber-600 font-medium bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full">
              Select a company
            </span>
          )}
        </div>

        {/* Company table */}
        <div className={cn('overflow-x-auto', (isUploading || state === 'done') && 'pointer-events-none opacity-60')}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-6 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide w-8"></th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Company Name</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Database Name</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Localization</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Version</th>
              </tr>
            </thead>
            <tbody>
              {COMPANIES.map((company, idx) => {
                const isSelected = selectedCompany?.id === company.id
                return (
                  <tr
                    key={company.id}
                    onClick={() => setSelectedCompany(company)}
                    className={cn(
                      'cursor-pointer transition-colors',
                      idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50',
                      isSelected
                        ? 'bg-brand-50 hover:bg-brand-50'
                        : 'hover:bg-brand-50/60'
                    )}
                  >
                    <td className="px-6 py-3 w-8">
                      <span className={cn(
                        'flex items-center justify-center w-4 h-4 rounded-full border-2 transition-all',
                        isSelected
                          ? 'border-brand-600 bg-brand-600'
                          : 'border-gray-300'
                      )}>
                        {isSelected && (
                          <span className="w-1.5 h-1.5 rounded-full bg-white block" />
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('font-medium', isSelected ? 'text-brand-800' : 'text-gray-800')}>
                        {company.companyName}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{company.databaseName}</td>
                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{company.localization}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500 hidden sm:table-cell">{company.version}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Selected company summary */}
        {selectedCompany && (
          <div className="px-6 py-3 border-t border-brand-100 bg-brand-50 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-brand-600 flex-shrink-0" />
            <span className="text-xs text-brand-700">
              Selected: <span className="font-semibold">{selectedCompany.companyName}</span>
              <span className="text-brand-500 ml-1">({selectedCompany.databaseName})</span>
            </span>
          </div>
        )}
      </div>

      {/* Format Guide */}
      <FormatGuide />

      {/* Upload area */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-800">Select File</h2>
          {state === 'preview' && (
            <button
              onClick={handleClear}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
          )}
        </div>

        <FileDropzone
          onFileSelect={handleFileSelect}
          selectedFile={selectedFile}
          onClear={handleClear}
          disabled={isUploading || state === 'done'}
        />

        {isParsing && (
          <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 rounded-xl border border-blue-100">
            <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
            <span className="text-sm text-blue-700 font-medium">Parsing and validating file...</span>
          </div>
        )}
      </div>

      {/* Preview */}
      {showPreview && rows.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-800">Data Preview</h2>
            <span className="text-xs text-gray-400">Showing all {rows.length} rows</span>
          </div>

          <PreviewTable rows={rows} errors={errors} />

          {/* Action buttons */}
          {state === 'preview' && (
            <div className="flex items-center justify-between pt-2 border-t border-gray-50">
              <div className="text-xs text-gray-500">
                {errors.length > 0
                  ? <span className="text-amber-600 font-medium">Document has validation errors. You can still submit but rows with errors may be rejected by SAP.</span>
                  : <span className="text-green-600 font-medium">All rows passed validation. Ready to submit.</span>
                }
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleClear}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpload}
                  disabled={rows.length === 0 || !selectedCompany}
                  title={!selectedCompany ? 'Please select a company first' : undefined}
                  className={cn(
                    'flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm',
                    !selectedCompany
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : errors.length > 0
                      ? 'bg-amber-500 hover:bg-amber-600 text-white'
                      : 'bg-brand-600 hover:bg-brand-700 text-white'
                  )}
                >
                  <Send className="w-4 h-4" />
                  {errors.length > 0 ? 'Submit Anyway' : 'Submit to SAP'}
                </button>
              </div>
            </div>
          )}

          {isUploading && (
            <div className="flex items-center gap-3 px-4 py-3 bg-brand-50 rounded-xl border border-brand-100">
              <Loader2 className="w-4 h-4 text-brand-600 animate-spin" />
              <span className="text-sm text-brand-700 font-medium">
                Submitting to {selectedCompany?.companyName ?? 'SAP'}... Please wait
              </span>
            </div>
          )}
        </div>
      )}

      {/* Result card */}
      {state === 'done' && result && (
        <div className={cn(
          'rounded-2xl border p-6 space-y-4',
          result.log.status === 'SUCCESS'
            ? 'bg-green-50 border-green-200'
            : result.log.status === 'PARTIAL'
            ? 'bg-amber-50 border-amber-200'
            : 'bg-red-50 border-red-200'
        )}>
          <div className="flex items-start gap-4">
            <div className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
              result.log.status === 'SUCCESS' ? 'bg-green-100' : result.log.status === 'PARTIAL' ? 'bg-amber-100' : 'bg-red-100'
            )}>
              {result.log.status === 'SUCCESS'
                ? <CheckCircle2 className="w-5 h-5 text-green-600" />
                : <XCircle className="w-5 h-5 text-red-600" />
              }
            </div>
            <div className="flex-1">
              <p className={cn(
                'font-semibold text-base',
                result.log.status === 'SUCCESS' ? 'text-green-800' : result.log.status === 'PARTIAL' ? 'text-amber-800' : 'text-red-800'
              )}>
                {result.log.status === 'SUCCESS' ? 'Upload Successful' : result.log.status === 'PARTIAL' ? 'Partial Upload' : 'Upload Failed'}
              </p>
              <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'File', value: result.log.filename },
                  { label: 'Company', value: result.log.databaseName ?? '—' },
                  { label: 'Succeeded', value: result.log.successCount },
                  { label: 'Failed', value: result.log.failedCount },
                ].map(item => (
                  <div key={item.label} className="bg-white/60 rounded-lg p-2.5">
                    <p className="text-xs text-gray-500">{item.label}</p>
                    <p className="text-sm font-semibold text-gray-800 mt-0.5 truncate">{item.value}</p>
                  </div>
                ))}
              </div>
              {result.log.sapReference && (
                <p className="mt-3 text-xs text-green-700 font-mono bg-green-100 inline-block px-2 py-1 rounded">
                  SAP Ref: {result.log.sapReference}
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button
              onClick={handleClear}
              className="px-4 py-2 text-sm font-medium bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Upload Another File
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
