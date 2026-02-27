export interface DocumentRow {
  vendor_code: string
  document_date: string
  document_type: string
  document_number: string
  po_number: string
  line_item: number
  material_code: string
  description: string
  quantity: number
  unit: string
  unit_price: number
  currency: string
  total_amount: number
  tax_code: string
  cost_center: string
  remarks?: string
}

export type DocumentType = 'INVOICE' | 'CREDIT_NOTE' | 'PO' | 'GOODS_RECEIPT'
export type UnitType = 'EA' | 'KG' | 'BOX' | 'PC' | 'L' | 'M'

export interface ValidationError {
  row: number
  column: string
  message: string
}

export interface ParseResult {
  rows: DocumentRow[]
  errors: ValidationError[]
  isValid: boolean
}

export type UploadStatus = 'SUCCESS' | 'FAILED' | 'PARTIAL'

export interface UploadLog {
  id: string
  filename: string
  uploadedBy: string
  uploadedAt: string
  rowCount: number
  successCount: number
  failedCount: number
  status: UploadStatus
  sapReference?: string
  errors: ValidationError[]
}
