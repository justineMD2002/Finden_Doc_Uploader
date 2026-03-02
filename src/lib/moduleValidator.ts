import * as XLSX from 'xlsx'

// ─── Column type definitions ───────────────────────────────────────────────

type ColType = 'Integer' | 'Decimal' | 'Numeric' | 'Date' | 'Text' | 'Enum'

export interface ColDef {
  name: string
  type: ColType
  nullable?: boolean
  enumValues?: string[]
  allowZero?: boolean
  allowNegative?: boolean
}

export interface ModuleDef {
  id: string
  label: string
  columns: ColDef[]
}

// ─── Module definitions ────────────────────────────────────────────────────

export const MODULES: ModuleDef[] = [
  {
    id: 'purchase_order',
    label: 'Purchase Order',
    columns: [
      { name: 'Purchase Order No', type: 'Integer' },
      { name: 'Posting Date', type: 'Date' },
      { name: 'Delivery Date', type: 'Date' },
      { name: 'Document Date', type: 'Date' },
      { name: 'Vendor Code', type: 'Text' },
      { name: 'Vendor Name', type: 'Text' },
      { name: 'Vendor Ref No', type: 'Text', nullable: true },
      { name: 'Document Series', type: 'Text' },
      { name: 'Trade Type', type: 'Text' },
      { name: 'Line Type', type: 'Text' },
      { name: 'Line No', type: 'Integer' },
      { name: 'Item Code', type: 'Text' },
      { name: 'Item / Service Description', type: 'Text' },
      { name: 'Warehouse', type: 'Text' },
      { name: 'Ordered Quantity', type: 'Numeric' },
      { name: 'Open Quantity', type: 'Numeric' },
      { name: 'Unit Price', type: 'Decimal' },
      { name: 'Line Total (Excl. VAT)', type: 'Decimal' },
      { name: 'Tax Code', type: 'Text' },
      { name: 'VAT Amount', type: 'Decimal', allowNegative: true },
      { name: 'G/L Account Code', type: 'Text', nullable: true },
      { name: 'G/L Account Name', type: 'Text', nullable: true },
      { name: 'Total VAT (Header)', type: 'Decimal' },
      { name: 'Total Amount (Incl. VAT)', type: 'Decimal', allowNegative: true },
      { name: 'Remarks', type: 'Text', nullable: true },
      { name: 'Cancelled', type: 'Enum', enumValues: ['Y', 'N', 'C']},
      { name: 'Status', type: 'Enum', enumValues: ['Open', 'Closed'] },
    ],
  },
  {
    id: 'grpo',
    label: 'GRPO',
    columns: [
      { name: 'GRPO No', type: 'Integer' },
      { name: 'Posting Date', type: 'Date' },
      { name: 'Due Date', type: 'Date' },
      { name: 'Document Date', type: 'Date' },
      { name: 'Vendor Code', type: 'Text' },
      { name: 'Vendor Name', type: 'Text' },
      { name: 'Vendor Ref No', type: 'Text', nullable: true },
      { name: 'Line Type', type: 'Text' },
      { name: 'Item Code', type: 'Text' },
      { name: 'Item / Service Description', type: 'Text' },
      { name: 'Quantity', type: 'Numeric' },
      { name: 'Unit Price', type: 'Decimal' },
      { name: 'Line Total (Excl. VAT)', type: 'Decimal' },
      { name: 'Tax Code', type: 'Text' },
      { name: 'VAT Amount', type: 'Decimal', allowNegative: true },
      { name: 'G/L Account Code', type: 'Text', nullable: true },
      { name: 'G/L Account Name', type: 'Text', nullable: true },
      { name: 'Total VAT (Header)', type: 'Decimal' },
      { name: 'Total Amount (Incl. VAT)', type: 'Decimal', allowNegative: true },
      { name: 'Freight / Expenses', type: 'Decimal' },
      { name: 'Remarks', type: 'Text', nullable: true },
      { name: 'Cancelled', type: 'Enum', enumValues: ['Y', 'N', 'C']},
      { name: 'Status', type: 'Enum', enumValues: ['Open', 'Closed'] },
    ],
  },
  {
    id: 'ar_credit_memo',
    label: 'AR Credit Memo',
    columns: [
      { name: 'Credit Memo No', type: 'Integer' },
      { name: 'Posting Date', type: 'Date' },
      { name: 'Due Date', type: 'Date' },
      { name: 'Document Date', type: 'Date' },
      { name: 'Customer Code', type: 'Text' },
      { name: 'Customer Name', type: 'Text' },
      { name: 'Customer Ref No', type: 'Text', nullable: true },
      { name: 'Line Type', type: 'Text' },
      { name: 'Item Code', type: 'Text', nullable: true },
      { name: 'Item / Service Description', type: 'Text' },
      { name: 'Quantity', type: 'Numeric', allowZero: true },
      { name: 'Unit Price', type: 'Decimal', allowNegative: true, allowZero: true },
      { name: 'Line Total (Excl. VAT)', type: 'Decimal', allowNegative: true, allowZero: true },
      { name: 'Tax Code', type: 'Text' },
      { name: 'VAT Amount', type: 'Decimal', allowNegative: true },
      { name: 'G/L Account Code', type: 'Text' },
      { name: 'G/L Account Name', type: 'Text' },
      { name: 'Total VAT (Header)', type: 'Decimal' },
      { name: 'Discount', type: 'Decimal' },
      { name: 'Total Amount (Incl. VAT)', type: 'Decimal', allowNegative: true },
      { name: 'Freight / Expenses', type: 'Decimal' },
      { name: 'Remarks', type: 'Text', nullable: true },
      { name: 'Cancelled', type: 'Enum', enumValues: ['Y', 'N', 'C'] },
      { name: 'Status', type: 'Enum', enumValues: ['Open', 'Closed'] },
    ],
  },
  {
    id: 'goods_issue',
    label: 'Goods Issue',
    columns: [
      { name: 'Goods Issue No', type: 'Integer' },
      { name: 'Posting Date', type: 'Date' },
      { name: 'Document Date', type: 'Date' },
      { name: 'Remarks', type: 'Text', nullable: true },
      { name: 'Status', type: 'Enum', enumValues: ['Open', 'Closed'] },
      { name: 'Line No', type: 'Integer' },
      { name: 'Item Code', type: 'Text' },
      { name: 'Item Description', type: 'Text' },
      { name: 'Warehouse', type: 'Text' },
      { name: 'Quantity', type: 'Numeric' },
      { name: 'Unit Price', type: 'Decimal' },
      { name: 'Line Total', type: 'Decimal' },
      { name: 'G/L Account Code', type: 'Text' },
      { name: 'G/L Account Name', type: 'Text' },
      { name: 'Cost Center 1', type: 'Text', nullable: true },
      { name: 'Cost Center 2', type: 'Text', nullable: true },
      { name: 'Cost Center 3', type: 'Text', nullable: true },
      { name: 'Cost Center 4', type: 'Text', nullable: true },
      { name: 'Cost Center 5', type: 'Text', nullable: true },
    ],
  },
  {
    id: 'goods_receipt',
    label: 'Goods Receipt',
    columns: [
      { name: 'Goods Receipt No', type: 'Integer' },
      { name: 'Posting Date', type: 'Date' },
      { name: 'Document Date', type: 'Date' },
      { name: 'Remarks', type: 'Text', nullable: true },
      { name: 'Status', type: 'Enum', enumValues: ['Open', 'Closed'] },
      { name: 'Line No', type: 'Integer' },
      { name: 'Item Code', type: 'Text' },
      { name: 'Item Description', type: 'Text' },
      { name: 'Warehouse', type: 'Text' },
      { name: 'Quantity', type: 'Numeric' },
      { name: 'Unit Price', type: 'Decimal', allowZero: true },
      { name: 'Line Total', type: 'Decimal' },
      { name: 'G/L Account Code', type: 'Text' },
      { name: 'G/L Account Name', type: 'Text' },
      { name: 'Cost Center 1', type: 'Text', nullable: true },
      { name: 'Cost Center 2', type: 'Text', nullable: true },
      { name: 'Cost Center 3', type: 'Text', nullable: true },
      { name: 'Cost Center 4', type: 'Text', nullable: true },
      { name: 'Cost Center 5', type: 'Text', nullable: true },
    ],
  },
  {
    id: 'return',
    label: 'Return',
    columns: [
      { name: 'Return No', type: 'Integer' },
      { name: 'Posting Date', type: 'Date' },
      { name: 'Due Date', type: 'Date' },
      { name: 'Document Date', type: 'Date' },
      { name: 'Vendor Code', type: 'Text' },
      { name: 'Vendor Name', type: 'Text' },
      { name: 'Vendor Ref No', type: 'Text', nullable: true },
      { name: 'Document Owner', type: 'Integer' },
      { name: 'Line No', type: 'Integer' },
      { name: 'Item Code', type: 'Text' },
      { name: 'Item Description', type: 'Text' },
      { name: 'Warehouse Code', type: 'Text' },
      { name: 'Warehouse Name', type: 'Text' },
      { name: 'Quantity', type: 'Numeric' },
      { name: 'Unit Price', type: 'Decimal', allowZero: true },
      { name: 'Line Total (Excl. VAT)', type: 'Decimal' },
      { name: 'Tax Code', type: 'Text' },
      { name: 'VAT Amount', type: 'Decimal', allowNegative: true },
      { name: 'G/L Account Code', type: 'Text' },
      { name: 'G/L Account Name', type: 'Text' },
      { name: 'Total VAT', type: 'Decimal' },
      { name: 'Total Amount (Incl. VAT)', type: 'Decimal', allowNegative: true },
      { name: 'Remarks', type: 'Text', nullable: true },
      { name: 'Cancelled', type: 'Enum', enumValues: ['Y', 'N', 'C']},
      { name: 'Status', type: 'Enum', enumValues: ['Open', 'Closed'] },
    ],
  },
  {
    id: 'ap_invoice',
    label: 'AP Invoice',
    columns: [
      { name: 'Document Number', type: 'Integer' },
      { name: 'Canceled', type: 'Enum', enumValues: ['Y', 'N', 'C']},
      { name: 'Posting Date', type: 'Date' },
      { name: 'Customer/Vendor Code', type: 'Text' },
      { name: 'Customer/Vendor Name', type: 'Text' },
      { name: 'Federal Tax ID', type: 'Text', nullable: true },
      { name: 'Customer/Vendor Ref. No.', type: 'Text', nullable: true },
      { name: 'Account Code', type: 'Text' },
      { name: 'Account Name', type: 'Text' },
      { name: 'Row Total', type: 'Decimal', allowNegative: true },
      { name: 'Tax Definition', type: 'Text' },
      { name: 'Total Tax', type: 'Decimal' },
      { name: 'Withholding Tax Liable', type: 'Enum', enumValues: ['Y', 'N', 'C']},
      { name: 'Taxable Amount', type: 'Decimal' },
      { name: 'Wtax Code', type: 'Text', nullable: true },
      { name: 'Wtax Rate', type: 'Decimal' },
      { name: 'Wtax Amount', type: 'Decimal' },
    ],
  },
  {
    id: 'ap_down_payment',
    label: 'AP Down Payment',
    columns: [
      { name: 'Document Number', type: 'Integer' },
      { name: 'Canceled', type: 'Enum', enumValues: ['Y', 'N', 'C']},
      { name: 'Document Status', type: 'Enum', enumValues: ['O', 'C'] },
      { name: 'Customer/Vendor Name', type: 'Text' },
      { name: 'Posting Date', type: 'Date' },
      { name: 'Item/Service Description', type: 'Text' },
      { name: 'Account Code', type: 'Text' },
      { name: 'Account Name', type: 'Text' },
      { name: 'Row Total', type: 'Decimal', allowNegative: true },
      { name: 'Remarks', type: 'Text', nullable: true },
      { name: 'Total Tax', type: 'Decimal' },
      { name: 'WTax Amount', type: 'Decimal' },
      { name: 'Document Total', type: 'Decimal' },
    ],
  },
  {
    id: 'ar_invoice',
    label: 'AR Invoice',
    columns: [
      { name: 'Document Type', type: 'Text' },
      { name: 'Document Number', type: 'Integer' },
      { name: 'Posting Date', type: 'Date' },
      { name: 'Customer Code', type: 'Text' },
      { name: 'Customer Name', type: 'Text' },
      { name: 'Item Code', type: 'Text' },
      { name: 'Item Description', type: 'Text' },
      { name: 'Quantity', type: 'Numeric' },
      { name: 'Net Price Amount', type: 'Decimal' },
      { name: 'VAT Amount', type: 'Decimal', allowNegative: true },
      { name: 'Document Total', type: 'Decimal' },
      { name: 'Remarks', type: 'Text', nullable: true },
      { name: 'Warehouse Code', type: 'Text' },
      { name: 'Warehouse Name', type: 'Text' },
      { name: 'Department Name', type: 'Text' },
      { name: 'OcrName2', type: 'Text' },
      { name: 'OcrName3', type: 'Text' },
      { name: 'COGS Dist Rule 1', type: 'Text' },
      { name: 'COGS Dist Rule 2', type: 'Text' },
      { name: 'COGS Dist Rule 3', type: 'Text' },
      { name: 'Canceled', type: 'Enum', enumValues: ['Yes', 'No'] },
      { name: 'Status', type: 'Enum', enumValues: ['Open', 'Closed'] },
    ],
  },
  {
    id: 'delivery_receipt',
    label: 'Delivery Receipt (DR)',
    columns: [
      { name: 'Date Created', type: 'Date' },
      { name: 'Delivery Date', type: 'Date' },
      { name: 'DR DocDate', type: 'Date' },
      { name: 'DR Delivery Number', type: 'Integer' },
      { name: 'DCS Remarks', type: 'Text' },
      { name: 'Quantity', type: 'Numeric' },
      { name: 'WHSE', type: 'Text' },
      { name: 'COG Branch', type: 'Text' },
      { name: 'ItemCode Model', type: 'Text' },
    ],
  },
  {
    id: 'inventory_transfer',
    label: 'Inventory Transfer',
    columns: [
      { name: 'Date Created', type: 'Date' },
      { name: 'Delivery Date', type: 'Date' },
      { name: 'DCS Remarks', type: 'Text', nullable: true },
      { name: 'To WHSE CODE NAME', type: 'Text' },
      { name: 'Quantity', type: 'Integer' }, // 1 or -1 only — validated separately
      { name: 'WhseCode From', type: 'Text' },
      { name: 'WhseCode To', type: 'Text' },
      { name: 'ItemCode Model', type: 'Text' },
      { name: 'Serial Number', type: 'Text' },
      { name: 'ITR #', type: 'Integer', nullable: true },
      { name: 'IT#', type: 'Integer' },
      { name: 'ISMS SO#', type: 'Integer', nullable: true },
      { name: 'Remarks Manual DR', type: 'Text', nullable: true },
      { name: 'User Name', type: 'Text' },
      { name: 'Date of Update', type: 'Date' },
    ],
  },
]

// ─── Validation result types ───────────────────────────────────────────────

export interface ModuleValidationError {
  row: number       // 1-based (data rows only, header not counted)
  column: string
  value: string
  reason: string
}

export interface ModuleValidationResult {
  totalRows: number
  totalErrors: number
  missingColumns: string[]
  extraColumns: string[]
  errors: ModuleValidationError[]
  passed: boolean
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function isBlank(v: unknown): boolean {
  if (v === null || v === undefined) return true
  return String(v).trim() === ''
}

function isValidDate(v: unknown): boolean {
  if (v instanceof Date) return !isNaN(v.getTime())
  const s = String(v).trim()
  if (!s) return false
  // Try parsing common date string formats
  const d = new Date(s)
  if (!isNaN(d.getTime())) return true
  // Try numeric Excel serial (already converted by XLSX with cellDates:true but handle raw too)
  const n = Number(v)
  if (!isNaN(n) && n > 1) return true
  return false
}

function isInteger(v: unknown): boolean {
  if (isBlank(v)) return false
  const n = Number(v)
  return !isNaN(n) && Number.isFinite(n) && Math.floor(n) === n
}

function isDecimalOrNumeric(v: unknown): boolean {
  if (isBlank(v)) return false
  const n = Number(v)
  return !isNaN(n) && Number.isFinite(n)
}

function validateCell(
  col: ColDef,
  rawValue: unknown,
  rowNum: number,
): ModuleValidationError | null {
  const blank = isBlank(rawValue)
  const displayVal = blank ? '(empty)' : String(rawValue)

  if (blank) {
    if (col.type === 'Text' || col.nullable) return null
    return { row: rowNum, column: col.name, value: displayVal, reason: 'Missing required value' }
  }

  switch (col.type) {
    case 'Integer': {
      if (!isInteger(rawValue)) {
        return { row: rowNum, column: col.name, value: displayVal, reason: `Expected Integer, got '${displayVal}'` }
      }
      // Special rule for Inventory Transfer Quantity: must be 1 or -1
      if (col.name === 'Quantity' && (Number(rawValue) !== 1 && Number(rawValue) !== -1)) {
        // Only applied in context of Inventory Transfer — we tag it via enumValues workaround
        // Actually handled below via a separate pass; skip here
      }
      return null
    }
    case 'Decimal':
    case 'Numeric': {
      if (!isDecimalOrNumeric(rawValue)) {
        return { row: rowNum, column: col.name, value: displayVal, reason: `Expected ${col.type}, got '${displayVal}'` }
      }
      const n = Number(rawValue)
      if (!col.allowNegative && n < 0) {
        return { row: rowNum, column: col.name, value: displayVal, reason: `Value must not be negative` }
      }
      return null
    }
    case 'Date': {
      if (!isValidDate(rawValue)) {
        return { row: rowNum, column: col.name, value: displayVal, reason: `Expected Date, got '${displayVal}'` }
      }
      return null
    }
    case 'Text': {
      return null // any string is valid, empty cells are allowed
    }
    case 'Enum': {
      const allowed = col.enumValues ?? []
      const strVal = String(rawValue).trim()
      if (!allowed.includes(strVal)) {
        return {
          row: rowNum,
          column: col.name,
          value: displayVal,
          reason: `Invalid value '${strVal}' — expected ${allowed.map(v => `'${v}'`).join(' or ')}`,
        }
      }
      return null
    }
  }
}

// ─── Sheet names helper ────────────────────────────────────────────────────

export function getSheetNames(file: File): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const workbook = XLSX.read(e.target?.result, { type: 'binary' })
        resolve(workbook.SheetNames)
      } catch (err) {
        reject(new Error(`Failed to read file: ${String(err)}`))
      }
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsBinaryString(file)
  })
}

// ─── Main validator ────────────────────────────────────────────────────────

export function validateModuleFile(
  file: File,
  module: ModuleDef,
  sheetName?: string,
): Promise<ModuleValidationResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data = e.target?.result
        const workbook = XLSX.read(data, { type: 'binary', cellDates: true })
        const targetSheet = sheetName ?? workbook.SheetNames[0]
        const sheet = workbook.Sheets[targetSheet]

        // Parse as array of arrays to get raw header row
        const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null })

        if (aoa.length === 0) {
          resolve({ totalRows: 0, totalErrors: 1, missingColumns: [], extraColumns: [], errors: [], passed: false })
          return
        }

        const headerRow = (aoa[0] as unknown[]).map(h => (h == null ? '' : String(h).trim()))
        const dataRows = aoa.slice(1).filter(row => (row as unknown[]).some(cell => !isBlank(cell)))

        const requiredNames = module.columns.map(c => c.name)
        const missingColumns = requiredNames.filter(n => !headerRow.includes(n))
        const extraColumns = headerRow.filter(h => h !== '' && !requiredNames.includes(h))

        const errors: ModuleValidationError[] = []

        // Build col index map
        const colIndex: Record<string, number> = {}
        headerRow.forEach((h, i) => { colIndex[h] = i })

        for (let di = 0; di < dataRows.length; di++) {
          const rowArr = dataRows[di] as unknown[]
          const rowNum = di + 1 // 1-based data row

          for (const col of module.columns) {
            const ci = colIndex[col.name]
            if (ci === undefined) continue // missing column already reported above
            const rawValue = rowArr[ci] ?? null

            const err = validateCell(col, rawValue, rowNum)
            if (err) errors.push(err)
          }

          // Inventory Transfer: Quantity must be 1 or -1
          if (module.id === 'inventory_transfer') {
            const qtyIdx = colIndex['Quantity']
            if (qtyIdx !== undefined) {
              const qtyVal = rowArr[qtyIdx]
              const n = Number(qtyVal)
              if (!isBlank(qtyVal) && n !== 1 && n !== -1) {
                // Remove the generic integer error for this cell if it exists
                const dupIdx = errors.findIndex(e => e.row === rowNum && e.column === 'Quantity')
                if (dupIdx !== -1) errors.splice(dupIdx, 1)
                errors.push({
                  row: rowNum,
                  column: 'Quantity',
                  value: String(qtyVal),
                  reason: `Expected 1 or -1, got '${qtyVal}'`,
                })
              }
            }
          }

          // Document Number: if Excel misread a numeric ID as a date serial, recover the serial number
          const dnIdx = colIndex['Document Number']
          if (dnIdx !== undefined) {
            const raw = rowArr[dnIdx]
            if (raw instanceof Date && !isNaN(raw.getTime())) {
              // Convert back to Excel serial number (days since 1899-12-30)
              const serial = Math.round((raw.getTime() - new Date('1899-12-30').getTime()) / 86400000)
              // Remove any error flagged for this cell and treat the serial as the real value
              const dupIdx = errors.findIndex(e => e.row === rowNum && e.column === 'Document Number')
              if (dupIdx !== -1) errors.splice(dupIdx, 1)
              // Validate the recovered serial as an integer
              if (!Number.isFinite(serial) || serial <= 0) {
                errors.push({
                  row: rowNum,
                  column: 'Document Number',
                  value: String(serial),
                  reason: `Could not recover a valid Document Number from Excel date serial`,
                })
              }
            }
          }
        }

        resolve({
          totalRows: dataRows.length,
          totalErrors: errors.length + missingColumns.length,
          missingColumns,
          extraColumns,
          errors,
          passed: missingColumns.length === 0 && errors.length === 0,
        })
      } catch (err) {
        reject(new Error(`Failed to parse file: ${String(err)}`))
      }
    }

    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsBinaryString(file)
  })
}
