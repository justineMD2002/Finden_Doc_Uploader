import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import type { DocumentRow, ValidationError } from '@/types/document'
import { cn, formatCurrency } from '@/lib/utils'

interface PreviewTableProps {
  rows: DocumentRow[]
  errors: ValidationError[]
}

const COLUMNS: { key: keyof DocumentRow; label: string }[] = [
  { key: 'vendor_code', label: 'Vendor' },
  { key: 'document_date', label: 'Doc Date' },
  { key: 'document_type', label: 'Type' },
  { key: 'document_number', label: 'Doc No.' },
  { key: 'po_number', label: 'PO No.' },
  { key: 'line_item', label: 'Line' },
  { key: 'material_code', label: 'Material' },
  { key: 'description', label: 'Description' },
  { key: 'quantity', label: 'Qty' },
  { key: 'unit', label: 'Unit' },
  { key: 'unit_price', label: 'Unit Price' },
  { key: 'currency', label: 'Currency' },
  { key: 'total_amount', label: 'Total' },
  { key: 'tax_code', label: 'Tax' },
  { key: 'cost_center', label: 'Cost Center' },
  { key: 'remarks', label: 'Remarks' },
]

const PreviewTable = ({ rows, errors }: PreviewTableProps) => {
  const errorRowNumbers = new Set(errors.map(e => e.row))
  const errorMap = new Map<string, string>()
  errors.forEach(e => errorMap.set(`${e.row}-${e.column}`, e.message))

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="flex items-center gap-3">
        {errors.length === 0 ? (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            <span className="text-xs font-medium text-green-700">{rows.length} rows ready to upload</span>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <span className="text-xs font-medium text-red-700">{errors.length} validation error{errors.length !== 1 ? 's' : ''} found</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg">
              <span className="text-xs font-medium text-gray-600">{rows.length} total rows</span>
            </div>
          </>
        )}
      </div>

      {/* Error list */}
      {errors.length > 0 && (
        <div className="rounded-lg border border-red-100 bg-red-50 p-3 max-h-36 overflow-y-auto scrollbar-thin">
          <p className="text-xs font-semibold text-red-700 mb-2">Validation Errors:</p>
          <ul className="space-y-1">
            {errors.map((e, i) => (
              <li key={i} className="text-xs text-red-600 flex items-start gap-1.5">
                <span className="font-mono bg-red-100 px-1 rounded text-red-700 flex-shrink-0">Row {e.row}</span>
                <span className="font-medium text-red-800">{e.column}:</span>
                <span>{e.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Table */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin max-h-72 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-3 py-2.5 text-left font-semibold text-gray-500 w-10">#</th>
                {COLUMNS.map(col => (
                  <th key={col.key} className="px-3 py-2.5 text-left font-semibold text-gray-500 whitespace-nowrap">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-50">
              {rows.map((row, idx) => {
                const rowNum = idx + 2
                const hasRowError = errorRowNumbers.has(rowNum)
                return (
                  <tr
                    key={idx}
                    className={cn(
                      'hover:bg-gray-50 transition-colors',
                      hasRowError && 'bg-red-50/50'
                    )}
                  >
                    <td className={cn('px-3 py-2 font-mono', hasRowError ? 'text-red-500' : 'text-gray-400')}>
                      {rowNum}
                    </td>
                    {COLUMNS.map(col => {
                      const errKey = `${rowNum}-${col.key}`
                      const hasError = errorMap.has(errKey)
                      const value = row[col.key]
                      const displayValue =
                        col.key === 'total_amount' || col.key === 'unit_price'
                          ? formatCurrency(Number(value), row.currency)
                          : String(value ?? '')

                      return (
                        <td
                          key={col.key}
                          title={hasError ? errorMap.get(errKey) : undefined}
                          className={cn(
                            'px-3 py-2 whitespace-nowrap',
                            hasError ? 'bg-red-100 text-red-700 font-medium cursor-help' : 'text-gray-700',
                            col.key === 'description' ? 'max-w-[150px] truncate' : ''
                          )}
                        >
                          {col.key === 'document_type' ? (
                            <span className={cn(
                              'px-2 py-0.5 rounded-full text-xs font-medium',
                              value === 'INVOICE' ? 'bg-blue-100 text-blue-700' :
                              value === 'PO' ? 'bg-purple-100 text-purple-700' :
                              value === 'CREDIT_NOTE' ? 'bg-orange-100 text-orange-700' :
                              'bg-green-100 text-green-700'
                            )}>
                              {String(value)}
                            </span>
                          ) : displayValue}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default PreviewTable
