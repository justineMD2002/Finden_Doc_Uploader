import { useState } from 'react'
import { ChevronDown, ChevronUp, Info, Download, CheckCircle2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { downloadTemplate } from '@/lib/parser'

const COLUMNS = [
  { name: 'vendor_code', type: 'String', required: true, example: 'V-10042', desc: 'SAP Vendor/Supplier code' },
  { name: 'document_date', type: 'Date', required: true, example: '2025-01-15', desc: 'Date of document (YYYY-MM-DD), no future dates' },
  { name: 'document_type', type: 'String', required: true, example: 'INVOICE', desc: 'INVOICE | CREDIT_NOTE | PO | GOODS_RECEIPT' },
  { name: 'document_number', type: 'String', required: true, example: 'INV-2025-00123', desc: 'Reference document number' },
  { name: 'po_number', type: 'String', required: true, example: 'PO-4500012345', desc: 'Purchase Order number' },
  { name: 'line_item', type: 'Number', required: true, example: '10', desc: 'Line item number (integer)' },
  { name: 'material_code', type: 'String', required: true, example: 'MAT-00987', desc: 'SAP Material/Item code' },
  { name: 'description', type: 'String', required: true, example: 'Office Chair Black', desc: 'Item description' },
  { name: 'quantity', type: 'Number', required: true, example: '5', desc: 'Positive number' },
  { name: 'unit', type: 'String', required: true, example: 'EA', desc: 'EA | KG | BOX | PC | L | M' },
  { name: 'unit_price', type: 'Number', required: true, example: '1250.00', desc: 'Price per unit (2 decimal places)' },
  { name: 'currency', type: 'String', required: true, example: 'PHP', desc: 'ISO currency code (PHP, USD, EUR, etc.)' },
  { name: 'total_amount', type: 'Nu mber', required: true, example: '6250.00', desc: 'Must equal quantity × unit_price' },
  { name: 'tax_code', type: 'String', required: true, example: 'V1', desc: 'SAP Tax code' },
  { name: 'cost_center', type: 'String', required: true, example: 'CC-1001', desc: 'SAP Cost center code' },
  { name: 'remarks', type: 'String', required: false, example: 'Urgent delivery', desc: 'Optional notes' },
]

export default function FormatGuide() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50/50 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-blue-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
            <Info className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-blue-900">Document Format Guide</p>
            <p className="text-xs text-blue-600">Click to view required columns and validation rules</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); downloadTemplate() }}
            className="flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-700 bg-white border border-brand-200 px-3 py-1.5 rounded-lg hover:bg-brand-50 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Download Template
          </button>
          {isOpen
            ? <ChevronUp className="w-4 h-4 text-blue-500" />
            : <ChevronDown className="w-4 h-4 text-blue-500" />
          }
        </div>
      </button>

      {/* Expandable content */}
      {isOpen && (
        <div className="border-t border-blue-100 bg-white">
          {/* Validation rules */}
          <div className="px-5 py-4 bg-amber-50 border-b border-amber-100">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-amber-800 mb-2">Validation Rules</p>
                <ul className="text-xs text-amber-700 space-y-1">
                  <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-amber-500" /> <code className="bg-amber-100 px-1 rounded">total_amount</code> must equal <code className="bg-amber-100 px-1 rounded">quantity × unit_price</code> (±0.01 tolerance)</li>
                  <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-amber-500" /> <code className="bg-amber-100 px-1 rounded">document_date</code> cannot be a future date</li>
                  <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-amber-500" /> <code className="bg-amber-100 px-1 rounded">document_type</code> must be one of: INVOICE, CREDIT_NOTE, PO, GOODS_RECEIPT</li>
                  <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-amber-500" /> All required fields marked with <span className="text-red-500 font-semibold">*</span> cannot be empty</li>
                  <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-amber-500" /> Numeric fields must be positive numbers</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Columns table */}
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Column Name</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Type</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Required</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Example</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {COLUMNS.map((col) => (
                  <tr key={col.name} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2.5">
                      <code className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-800">{col.name}</code>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={cn(
                        'px-2 py-0.5 rounded-full text-xs font-medium',
                        col.type === 'Number' ? 'bg-purple-100 text-purple-700' : col.type === 'Date' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                      )}>
                        {col.type}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {col.required
                        ? <span className="text-red-500 font-semibold">Yes *</span>
                        : <span className="text-gray-400">No</span>
                      }
                    </td>
                    <td className="px-4 py-2.5">
                      <code className="text-gray-600">{col.example}</code>
                    </td>
                    <td className="px-4 py-2.5 text-gray-500">{col.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
