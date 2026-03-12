import * as XLSX from 'xlsx'
import type { DocumentRow, ParseResult, ValidationError } from '@/types/document'

const REQUIRED_COLUMNS: (keyof DocumentRow)[] = [
  'vendor_code',
  'document_date',
  'document_type',
  'document_number',
  'po_number',
  'line_item',
  'material_code',
  'description',
  'quantity',
  'unit',
  'unit_price',
  'currency',
  'total_amount',
  'tax_code',
  'cost_center',
]

const VALID_DOCUMENT_TYPES = ['INVOICE', 'CREDIT_NOTE', 'PO', 'GOODS_RECEIPT']
const VALID_UNITS = ['EA', 'KG', 'BOX', 'PC', 'L', 'M']
const VALID_CURRENCIES = ['PHP', 'USD', 'EUR', 'SGD', 'JPY', 'CNY', 'AUD', 'GBP']

const validateRow = (row: Record<string, unknown>, rowIndex: number): ValidationError[] => {
  const errors: ValidationError[] = []
  const r = rowIndex + 2 // 1-based + header row

  // Required fields
  const requiredStrings: (keyof DocumentRow)[] = [
    'vendor_code', 'document_number', 'po_number', 'material_code', 'cost_center',
    'document_type', 'currency', 'unit', 'tax_code', 'description',
  ]
  for (const field of requiredStrings) {
    const val = row[field]
    if (!val || String(val).trim() === '') {
      errors.push({ row: r, column: field, message: `${field} is required` })
    }
  }

  // document_type validation
  const docType = String(row['document_type'] ?? '').toUpperCase()
  if (docType && !VALID_DOCUMENT_TYPES.includes(docType)) {
    errors.push({
      row: r,
      column: 'document_type',
      message: `document_type must be one of: ${VALID_DOCUMENT_TYPES.join(', ')}`,
    })
  }

  // unit validation
  const unit = String(row['unit'] ?? '').toUpperCase()
  if (unit && !VALID_UNITS.includes(unit)) {
    errors.push({
      row: r,
      column: 'unit',
      message: `unit must be one of: ${VALID_UNITS.join(', ')}`,
    })
  }

  // currency validation
  const currency = String(row['currency'] ?? '').toUpperCase()
  if (currency && !VALID_CURRENCIES.includes(currency)) {
    errors.push({
      row: r,
      column: 'currency',
      message: `currency "${currency}" is not a supported ISO code`,
    })
  }

  // numeric fields
  const qty = Number(row['quantity'])
  const price = Number(row['unit_price'])
  const total = Number(row['total_amount'])

  if (isNaN(qty) || qty <= 0) {
    errors.push({ row: r, column: 'quantity', message: 'quantity must be a positive number' })
  }
  if (isNaN(price) || price <= 0) {
    errors.push({ row: r, column: 'unit_price', message: 'unit_price must be a positive number' })
  }
  if (isNaN(total) || total <= 0) {
    errors.push({ row: r, column: 'total_amount', message: 'total_amount must be a positive number' })
  }

  // total_amount cross-check
  if (!isNaN(qty) && !isNaN(price) && !isNaN(total)) {
    const expected = Math.round(qty * price * 100) / 100
    const actual = Math.round(total * 100) / 100
    if (Math.abs(expected - actual) > 0.01) {
      errors.push({
        row: r,
        column: 'total_amount',
        message: `total_amount (${actual}) does not match quantity × unit_price (${expected})`,
      })
    }
  }

  // date validation
  const dateStr = String(row['document_date'] ?? '')
  if (dateStr) {
    const parsed = new Date(dateStr)
    if (isNaN(parsed.getTime())) {
      errors.push({ row: r, column: 'document_date', message: 'document_date must be a valid date (YYYY-MM-DD)' })
    } else if (parsed > new Date()) {
      errors.push({ row: r, column: 'document_date', message: 'document_date cannot be a future date' })
    }
  } else {
    errors.push({ row: r, column: 'document_date', message: 'document_date is required' })
  }

  return errors
}

export const parseFile = (file: File): Promise<ParseResult> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data = e.target?.result
        const workbook = XLSX.read(data, { type: 'binary', cellDates: true })
        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]

        const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
          defval: '',
          raw: false,
        })

        if (rawRows.length === 0) {
          resolve({ rows: [], errors: [{ row: 0, column: '', message: 'File is empty or has no data rows' }], isValid: false })
          return
        }

        // Check for missing required columns
        const headers = Object.keys(rawRows[0])
        const missingCols = REQUIRED_COLUMNS.filter(col => !headers.includes(col))
        if (missingCols.length > 0) {
          resolve({
            rows: [],
            errors: [{ row: 0, column: missingCols.join(', '), message: `Missing required columns: ${missingCols.join(', ')}` }],
            isValid: false,
          })
          return
        }

        const allErrors: ValidationError[] = []
        const rows: DocumentRow[] = rawRows.map((raw, idx) => {
          const rowErrors = validateRow(raw, idx)
          allErrors.push(...rowErrors)
          return {
            vendor_code: String(raw['vendor_code'] ?? '').trim(),
            document_date: String(raw['document_date'] ?? '').trim(),
            document_type: String(raw['document_type'] ?? '').trim().toUpperCase(),
            document_number: String(raw['document_number'] ?? '').trim(),
            po_number: String(raw['po_number'] ?? '').trim(),
            line_item: Number(raw['line_item']) || 0,
            material_code: String(raw['material_code'] ?? '').trim(),
            description: String(raw['description'] ?? '').trim(),
            quantity: Number(raw['quantity']) || 0,
            unit: String(raw['unit'] ?? '').trim().toUpperCase(),
            unit_price: Number(raw['unit_price']) || 0,
            currency: String(raw['currency'] ?? '').trim().toUpperCase(),
            total_amount: Number(raw['total_amount']) || 0,
            tax_code: String(raw['tax_code'] ?? '').trim(),
            cost_center: String(raw['cost_center'] ?? '').trim(),
            remarks: String(raw['remarks'] ?? '').trim(),
          }
        })

        resolve({
          rows,
          errors: allErrors,
          isValid: allErrors.length === 0,
        })
      } catch (err) {
        reject(new Error(`Failed to parse file: ${String(err)}`))
      }
    }

    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsBinaryString(file)
  })
}

export const downloadTemplate = () => {
  const headers: (keyof DocumentRow)[] = [
    'vendor_code', 'document_date', 'document_type', 'document_number', 'po_number',
    'line_item', 'material_code', 'description', 'quantity', 'unit',
    'unit_price', 'currency', 'total_amount', 'tax_code', 'cost_center', 'remarks',
  ]

  const sampleRow = [
    'V-10042', '2025-01-15', 'INVOICE', 'INV-2025-00123', 'PO-4500012345',
    10, 'MAT-00987', 'Office Chair Black', 5, 'EA',
    1250.00, 'PHP', 6250.00, 'V1', 'CC-1001', 'Urgent delivery',
  ]

  const ws = XLSX.utils.aoa_to_sheet([headers, sampleRow])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Documents')

  // Column widths
  ws['!cols'] = headers.map(() => ({ wch: 20 }))

  XLSX.writeFile(wb, 'document_upload_template.xlsx')
}
