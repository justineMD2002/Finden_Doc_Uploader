// ─── Business Object hierarchy ────────────────────────────────────────────

export type BizCategory = 'sales' | 'purchasing' | 'inventory'

export interface BizObject {
  id: string
  label: string
  category: BizCategory
  /** Override tab labels (default: "Document" / "Document Lines") */
  tabLabels?: [string, string]
}

export const BIZ_CATEGORIES: { id: BizCategory; label: string; icon: string }[] = [
  { id: 'sales',      label: 'Sales',                  icon: 'TrendingUp' },
  { id: 'purchasing', label: 'Purchasing',              icon: 'ShoppingCart' },
  { id: 'inventory',  label: 'Inventory Transactions',  icon: 'Package' },
]

export const BIZ_OBJECTS: BizObject[] = [
  // Sales
  { id: 'ar_credit_memo', label: 'AR Credit Memo', category: 'sales' },
  { id: 'ar_invoice',     label: 'AR Invoice',     category: 'sales' },
  { id: 'delivery',       label: 'Delivery',       category: 'sales' },
  { id: 'return',         label: 'Return',         category: 'sales' },
  // Purchasing
  { id: 'ap_downpayment', label: 'AP Downpayment', category: 'purchasing' },
  { id: 'ap_invoice',     label: 'AP Invoice',     category: 'purchasing' },
  { id: 'grpo',           label: 'GRPO',           category: 'purchasing' },
  { id: 'po',             label: 'PO',             category: 'purchasing' },
  // Inventory
  { id: 'goods_issue',    label: 'Goods Issue',     category: 'inventory' },
  { id: 'goods_receipt',  label: 'Goods Receipt',   category: 'inventory' },
  { id: 'inv_transfer',   label: 'Inventory Transfer', category: 'inventory',
    tabLabels: ['Stock Transfer', 'Stock Transfer Lines'] },
]

// ─── Field mapping ────────────────────────────────────────────────────────

export interface MappingRow {
  sourceField: string       // column header from uploaded file
  targetField: string       // SAP B1 field name (empty = unmapped)
  tab: 'doc' | 'lines'      // which upload file it came from
}

// ─── Error handling ───────────────────────────────────────────────────────

export type ErrorHandlingMode =
  | 'cancel_rollback'   // Cancel import and perform rollback when one or more errors occur
  | 'ignore_all'        // Ignore all errors and process valid records
  | 'ignore_up_to_10'  // Ignore up to 10 errors and process valid records

// ─── Import result ────────────────────────────────────────────────────────

export interface ImportResult {
  mode: 'test' | 'import'
  status: 'success' | 'failed' | 'partial'
  totalRecords: number
  successCount: number
  failedCount: number
  errors: { row: number; field: string; message: string }[]
  sapReference?: string
  timestamp: string
}

// ─── Wizard state ─────────────────────────────────────────────────────────

export type WizardStep = 1 | 2 | 3 | 4 | 5

export interface UploadedFile {
  file: File
  columns: string[]   // header row
  rowCount: number
}

export interface WizardState {
  step: WizardStep
  bizObject: BizObject | null
  docFile: UploadedFile | null      // "Document" tab
  linesFile: UploadedFile | null    // "Document Lines" tab
  mappings: MappingRow[]
  errorHandling: ErrorHandlingMode
  result: ImportResult | null
}
