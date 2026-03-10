// SAP B1 field definitions and auto-mapping rules per business object
// Each business object defines its Document and Document Lines fields.

export type SapFieldType = 'string' | 'date' | 'double' | 'long' | 'enum'

export interface SapFieldDef {
  field: string           // SAP column name, e.g. "DocNum"
  description: string     // Human-readable label
  type: SapFieldType
  format?: string         // e.g. "YYYYMMDD" for dates
  fieldLength?: number
  mandatory?: boolean
  relatedTable?: string   // e.g. "OCRD", "NNM1"
  validValues?: string[]  // for enum type
  isKey?: boolean         // primary key of the document (DocNum)
  isParentKey?: boolean   // ParentKey in lines
  notes?: string
}

export interface BizObjectFieldSet {
  doc: SapFieldDef[]
  lines: SapFieldDef[]
}

// ─── Source-to-target auto-mapping rules ──────────────────────────────────
// Key = column header as it appears in the exported SQL report
// Value = SAP field name

export type AutoMapTable = Record<string, string>  // sourceHeader → sapField

export interface BizObjectConfig {
  fields: BizObjectFieldSet
  /** doc-level: sourceColHeader → sapField */
  docAutoMap: AutoMapTable
  /** lines-level: sourceColHeader → sapField */
  linesAutoMap: AutoMapTable
}

// ─── Purchase Order ────────────────────────────────────────────────────────

const PO_DOC_FIELDS: SapFieldDef[] = [
  {
    field: 'DocNum',
    description: 'Document Number',
    type: 'long',
    fieldLength: 11,
    mandatory: true,
    isKey: true,
    notes:
      'Key field. In manual mode (Handwritten = Yes) use the real SAP doc number; in serial mode use a user-defined sequence (1, 2, 3…). Also used as ParentKey reference in the Lines file.',
  },
  {
    field: 'DocType',
    description: 'Document Type',
    type: 'enum',
    validValues: ['dDocument_Items', 'dDocument_Service'],
  },
  {
    field: 'DocDate',
    description: 'Posting Date',
    type: 'date',
    format: 'YYYYMMDD',
    fieldLength: 8,
  },
  {
    field: 'DocDueDate',
    description: 'Due Date',
    type: 'date',
    format: 'YYYYMMDD',
    fieldLength: 8,
  },
  {
    field: 'CardCode',
    description: 'Vendor Code',
    type: 'string',
    fieldLength: 15,
    mandatory: true,
    relatedTable: 'OCRD',
  },
  {
    field: 'CardName',
    description: 'Vendor Name',
    type: 'string',
    fieldLength: 100,
  },
  {
    field: 'NumAtCard',
    description: 'Vendor Reference No.',
    type: 'string',
    fieldLength: 100,
  },
  {
    field: 'DocTotal',
    description: 'Document Total',
    type: 'double',
    fieldLength: 40,
  },
  {
    field: 'Comments',
    description: 'Remarks',
    type: 'string',
    fieldLength: 254,
  },
  {
    field: 'Series',
    description: 'Document Series',
    type: 'long',
    fieldLength: 11,
    relatedTable: 'NNM1',
  },
  {
    field: 'TaxDate',
    description: 'Document Date',
    type: 'date',
    format: 'YYYYMMDD',
    fieldLength: 8,
  },
]

const PO_LINES_FIELDS: SapFieldDef[] = [
  {
    field: 'ParentKey',
    description: 'Parent Document Key',
    type: 'long',
    mandatory: true,
    isParentKey: true,
    notes: 'Must match the DocNum value from the Documents file.',
  },
  {
    field: 'LineNum',
    description: 'Line Number',
    type: 'long',
    notes: '0-based integer. First line = 0, second = 1, etc.',
  },
  {
    field: 'ItemCode',
    description: 'Item No.',
    type: 'string',
    fieldLength: 50,
    mandatory: true,
    relatedTable: 'OITM',
  },
  {
    field: 'ItemDescription',
    description: 'Item / Service Description',
    type: 'string',
    fieldLength: 100,
  },
  {
    field: 'Quantity',
    description: 'Quantity',
    type: 'double',
    fieldLength: 40,
  },
  {
    field: 'Price',
    description: 'Unit Price',
    type: 'double',
    fieldLength: 40,
  },
  {
    field: 'WarehouseCode',
    description: 'Warehouse Code',
    type: 'string',
    fieldLength: 8,
    relatedTable: 'OWHS',
  },
  {
    field: 'TaxCode',
    description: 'Tax Code',
    type: 'string',
    fieldLength: 8,
    relatedTable: 'OSTC',
  },
]

// Source column headers (as exported by the SQL report) → SAP target field
const PO_DOC_AUTO_MAP: AutoMapTable = {
  'Purchase Order No':        'DocNum',
  'Posting Date':             'DocDate',
  'Delivery Date':            'DocDueDate',
  'Document Date':            'TaxDate',
  'Vendor Code':              'CardCode',
  'Vendor Name':              'CardName',
  'Vendor Ref No':            'NumAtCard',
  'Document Series':          'Series',
  'Total Amount (Incl. VAT)': 'DocTotal',
  'Remarks':                  'Comments',
}

const PO_LINES_AUTO_MAP: AutoMapTable = {
  'Purchase Order No':             'ParentKey',
  'Line No':                       'LineNum',
  'Item Code':                     'ItemCode',
  'Item / Service Description':    'ItemDescription',
  'Ordered Quantity':              'Quantity',
  'Unit Price':                    'Price',
  'Warehouse':                     'WarehouseCode',
  'Tax Code':                      'TaxCode',
}

// ─── AR Credit Memo ────────────────────────────────────────────────────────

const AR_CREDIT_MEMO_DOC_FIELDS: SapFieldDef[] = [
  {
    field: 'DocNum',
    description: 'Credit Memo Number',
    type: 'long',
    fieldLength: 11,
    mandatory: true,
    isKey: true,
    notes: 'Key field. Also used as ParentKey reference in the Lines file.',
  },
  {
    field: 'DocType',
    description: 'Document Type',
    type: 'enum',
    validValues: ['dDocument_Items', 'dDocument_Service'],
  },
  { field: 'DocDate',    description: 'Posting Date',       type: 'date',   format: 'YYYYMMDD', fieldLength: 8 },
  { field: 'DocDueDate', description: 'Due Date',           type: 'date',   format: 'YYYYMMDD', fieldLength: 8 },
  { field: 'TaxDate',    description: 'Document Date',      type: 'date',   format: 'YYYYMMDD', fieldLength: 8 },
  { field: 'CardCode',   description: 'Customer Code',      type: 'string', fieldLength: 15,  mandatory: true, relatedTable: 'OCRD' },
  { field: 'CardName',   description: 'Customer Name',      type: 'string', fieldLength: 100 },
  { field: 'NumAtCard',  description: 'Customer Ref No.',   type: 'string', fieldLength: 100 },
  { field: 'Series',     description: 'Document Series',    type: 'long',   fieldLength: 11,  relatedTable: 'NNM1' },
  { field: 'DocTotal',   description: 'Document Total',     type: 'double', fieldLength: 40 },
  { field: 'Comments',   description: 'Remarks',            type: 'string', fieldLength: 254 },
]

const AR_CREDIT_MEMO_LINES_FIELDS: SapFieldDef[] = [
  {
    field: 'ParentKey',
    description: 'Parent Document Key',
    type: 'long',
    mandatory: true,
    isParentKey: true,
    notes: 'Must match the DocNum value from the Documents file.',
  },
  { field: 'LineNum',         description: 'Line Number',                  type: 'long',   notes: '0-based integer.' },
  { field: 'ItemCode',        description: 'Item No.',                     type: 'string', fieldLength: 50, mandatory: true, relatedTable: 'OITM' },
  { field: 'ItemDescription', description: 'Item / Service Description',   type: 'string', fieldLength: 100 },
  { field: 'Quantity',        description: 'Quantity',                     type: 'double', fieldLength: 40 },
  { field: 'Price',           description: 'Unit Price',                   type: 'double', fieldLength: 40 },
  { field: 'TaxCode',         description: 'Tax Code',                     type: 'string', fieldLength: 8,  relatedTable: 'OSTC' },
]

const AR_CREDIT_MEMO_DOC_AUTO_MAP: AutoMapTable = {
  'Credit Memo No':           'DocNum',
  'Customer Code':            'CardCode',
  'Posting Date':             'DocDate',
  'Due Date':                 'DocDueDate',
  'Document Date':            'TaxDate',
  'Customer Name':            'CardName',
  'Customer Ref No':          'NumAtCard',
  'Document Series':          'Series',
  'Total Amount (Incl. VAT)': 'DocTotal',
  'Remarks':                  'Comments',
}

const AR_CREDIT_MEMO_LINES_AUTO_MAP: AutoMapTable = {
  'Credit Memo No':            'ParentKey',
  'Item Code':                 'ItemCode',
  'Item / Service Description':'ItemDescription',
  'Quantity':                  'Quantity',
  'Unit Price':                'Price',
  'Tax Code':                  'TaxCode',
}

// ─── GRPO ──────────────────────────────────────────────────────────────────

const GRPO_DOC_FIELDS: SapFieldDef[] = [
  {
    field: 'DocNum',
    description: 'GRPO Number',
    type: 'long',
    fieldLength: 11,
    mandatory: true,
    isKey: true,
    notes: 'Key field. Also used as ParentKey reference in the Lines file.',
  },
  {
    field: 'DocType',
    description: 'Document Type',
    type: 'enum',
    validValues: ['dDocument_Items', 'dDocument_Service'],
  },
  { field: 'DocDate',    description: 'Posting Date',     type: 'date',   format: 'YYYYMMDD', fieldLength: 8 },
  { field: 'DocDueDate', description: 'Due Date',         type: 'date',   format: 'YYYYMMDD', fieldLength: 8 },
  { field: 'TaxDate',    description: 'Document Date',    type: 'date',   format: 'YYYYMMDD', fieldLength: 8 },
  { field: 'CardCode',   description: 'Vendor Code',      type: 'string', fieldLength: 15,  mandatory: true, relatedTable: 'OCRD' },
  { field: 'CardName',   description: 'Vendor Name',      type: 'string', fieldLength: 100 },
  { field: 'NumAtCard',  description: 'Vendor Ref No.',   type: 'string', fieldLength: 100 },
  { field: 'Series',     description: 'Document Series',  type: 'long',   fieldLength: 11,  relatedTable: 'NNM1' },
  { field: 'DocTotal',   description: 'Document Total',   type: 'double', fieldLength: 40 },
  { field: 'Comments',   description: 'Remarks',          type: 'string', fieldLength: 254 },
]

const GRPO_LINES_FIELDS: SapFieldDef[] = [
  {
    field: 'ParentKey',
    description: 'Parent Document Key',
    type: 'long',
    mandatory: true,
    isParentKey: true,
    notes: 'Must match the DocNum value from the Documents file.',
  },
  { field: 'LineNum',         description: 'Line Number',                  type: 'long',   notes: '0-based integer.' },
  { field: 'ItemCode',        description: 'Item No.',                     type: 'string', fieldLength: 50, mandatory: true, relatedTable: 'OITM' },
  { field: 'ItemDescription', description: 'Item / Service Description',   type: 'string', fieldLength: 100 },
  { field: 'Quantity',        description: 'Quantity',                     type: 'double', fieldLength: 40 },
  { field: 'Price',           description: 'Unit Price',                   type: 'double', fieldLength: 40 },
  { field: 'TaxCode',         description: 'Tax Code',                     type: 'string', fieldLength: 8,  relatedTable: 'OSTC' },
]

const GRPO_DOC_AUTO_MAP: AutoMapTable = {
  'GRPO No':                  'DocNum',
  'Vendor Code':              'CardCode',
  'Posting Date':             'DocDate',
  'Due Date':                 'DocDueDate',
  'Document Date':            'TaxDate',
  'Vendor Name':              'CardName',
  'Vendor Ref No':            'NumAtCard',
  'Document Series':          'Series',
  'Total Amount (Incl. VAT)': 'DocTotal',
  'Remarks':                  'Comments',
}

const GRPO_LINES_AUTO_MAP: AutoMapTable = {
  'GRPO No':                   'ParentKey',
  'Item Code':                 'ItemCode',
  'Item / Service Description':'ItemDescription',
  'Quantity':                  'Quantity',
  'Unit Price':                'Price',
  'Tax Code':                  'TaxCode',
}

// ─── Return ────────────────────────────────────────────────────────────────

const RETURN_DOC_FIELDS: SapFieldDef[] = [
  {
    field: 'DocNum',
    description: 'Return Number',
    type: 'long',
    fieldLength: 11,
    mandatory: true,
    isKey: true,
    notes: 'Key field. Also used as ParentKey reference in the Lines file.',
  },
  {
    field: 'DocType',
    description: 'Document Type',
    type: 'enum',
    validValues: ['dDocument_Items', 'dDocument_Service'],
  },
  { field: 'DocDate',    description: 'Posting Date',     type: 'date',   format: 'YYYYMMDD', fieldLength: 8 },
  { field: 'DocDueDate', description: 'Due Date',         type: 'date',   format: 'YYYYMMDD', fieldLength: 8 },
  { field: 'TaxDate',    description: 'Document Date',    type: 'date',   format: 'YYYYMMDD', fieldLength: 8 },
  { field: 'CardCode',   description: 'Vendor Code',      type: 'string', fieldLength: 15,  mandatory: true, relatedTable: 'OCRD' },
  { field: 'CardName',   description: 'Vendor Name',      type: 'string', fieldLength: 100 },
  { field: 'NumAtCard',  description: 'Vendor Ref No.',   type: 'string', fieldLength: 100 },
  { field: 'Series',     description: 'Document Series',  type: 'long',   fieldLength: 11,  relatedTable: 'NNM1' },
  { field: 'DocTotal',   description: 'Document Total',   type: 'double', fieldLength: 40 },
  { field: 'Comments',   description: 'Remarks',          type: 'string', fieldLength: 254 },
]

const RETURN_LINES_FIELDS: SapFieldDef[] = [
  {
    field: 'ParentKey',
    description: 'Parent Document Key',
    type: 'long',
    mandatory: true,
    isParentKey: true,
    notes: 'Must match the DocNum value from the Documents file.',
  },
  { field: 'LineNum',         description: 'Line Number',                  type: 'long',   notes: '0-based integer.' },
  { field: 'ItemCode',        description: 'Item No.',                     type: 'string', fieldLength: 50, mandatory: true, relatedTable: 'OITM' },
  { field: 'ItemDescription', description: 'Item / Service Description',   type: 'string', fieldLength: 100 },
  { field: 'Quantity',        description: 'Quantity',                     type: 'double', fieldLength: 40 },
  { field: 'Price',           description: 'Unit Price',                   type: 'double', fieldLength: 40 },
  { field: 'WarehouseCode',   description: 'Warehouse Code',               type: 'string', fieldLength: 8,  relatedTable: 'OWHS' },
  { field: 'TaxCode',         description: 'Tax Code',                     type: 'string', fieldLength: 8,  relatedTable: 'OSTC' },
]

const RETURN_DOC_AUTO_MAP: AutoMapTable = {
  'Return No':                'DocNum',
  'Vendor Code':              'CardCode',
  'Posting Date':             'DocDate',
  'Due Date':                 'DocDueDate',
  'Document Date':            'TaxDate',
  'Vendor Name':              'CardName',
  'Vendor Ref No':            'NumAtCard',
  'Document Series':          'Series',
  'Total Amount (Incl. VAT)': 'DocTotal',
  'Remarks':                  'Comments',
}

const RETURN_LINES_AUTO_MAP: AutoMapTable = {
  'Return No':                 'ParentKey',
  'Item Code':                 'ItemCode',
  'Line No':                   'LineNum',
  'Item / Service Description':'ItemDescription',
  'Quantity':                  'Quantity',
  'Unit Price':                'Price',
  'Warehouse':                 'WarehouseCode',
  'Tax Code':                  'TaxCode',
}

// ─── AP Downpayment ────────────────────────────────────────────────────────

const AP_DOWNPAYMENT_DOC_FIELDS: SapFieldDef[] = [
  { field: 'DocNum',    description: 'Document Number',   type: 'long',   fieldLength: 11,  mandatory: true, isKey: true, notes: 'Key field. Also used as ParentKey in Lines.' },
  { field: 'CardCode',  description: 'Vendor Code',       type: 'string', fieldLength: 15,  mandatory: true, relatedTable: 'OCRD' },
  { field: 'DocDate',   description: 'Posting Date',      type: 'date',   format: 'YYYYMMDD', fieldLength: 8 },
  { field: 'CardName',  description: 'Vendor Name',       type: 'string', fieldLength: 100 },
  { field: 'NumAtCard', description: 'Vendor Ref No.',    type: 'string', fieldLength: 100 },
  { field: 'DocTotal',  description: 'Document Total',    type: 'double', fieldLength: 40 },
  { field: 'Comments',  description: 'Remarks',           type: 'string', fieldLength: 254 },
]

const AP_DOWNPAYMENT_LINES_FIELDS: SapFieldDef[] = [
  { field: 'ParentKey',      description: 'Parent Document Key',           type: 'long',   mandatory: true, isParentKey: true },
  { field: 'ItemCode',       description: 'Item No.',                      type: 'string', fieldLength: 50, mandatory: true, relatedTable: 'OITM' },
  { field: 'LineNum',        description: 'Line Number',                   type: 'long',   notes: '0-based integer.' },
  { field: 'ItemDescription',description: 'Item / Service Description',    type: 'string', fieldLength: 100 },
  { field: 'Quantity',       description: 'Quantity',                      type: 'double', fieldLength: 40 },
  { field: 'Price',          description: 'Unit Price',                    type: 'double', fieldLength: 40 },
  { field: 'WarehouseCode',  description: 'Warehouse Code',                type: 'string', fieldLength: 8,  relatedTable: 'OWHS' },
  { field: 'WTaxAmount',     description: 'Withholding Tax Amount',        type: 'double', fieldLength: 40 },
]

const AP_DOWNPAYMENT_DOC_AUTO_MAP: AutoMapTable = {
  'Document No':    'DocNum',
  'Vendor Code':    'CardCode',
  'Posting Date':   'DocDate',
  'Vendor Name':    'CardName',
  'Vendor Ref No':  'NumAtCard',
  'Document Total': 'DocTotal',
  'Remarks':        'Comments',
}

const AP_DOWNPAYMENT_LINES_AUTO_MAP: AutoMapTable = {
  'Document No':               'ParentKey',
  'Item Code':                 'ItemCode',
  'Line No':                   'LineNum',
  'Item / Service Description':'ItemDescription',
  'Ordered Quantity':          'Quantity',
  'Unit Price':                'Price',
  'Warehouse':                 'WarehouseCode',
  'Wtax Amount':               'WTaxAmount',
}

// ─── AP Invoice ────────────────────────────────────────────────────────────

const AP_INVOICE_DOC_FIELDS: SapFieldDef[] = [
  { field: 'DocNum',      description: 'Document Number',   type: 'long',   fieldLength: 11,  mandatory: true, isKey: true, notes: 'Key field. Also used as ParentKey in Lines.' },
  { field: 'CardCode',    description: 'Vendor Code',       type: 'string', fieldLength: 15,  mandatory: true, relatedTable: 'OCRD' },
  { field: 'DocDate',     description: 'Posting Date',      type: 'date',   format: 'YYYYMMDD', fieldLength: 8 },
  { field: 'CardName',    description: 'Vendor Name',       type: 'string', fieldLength: 100 },
  { field: 'NumAtCard',   description: 'Vendor Ref No.',    type: 'string', fieldLength: 100 },
  { field: 'DocTotal',    description: 'Document Total',    type: 'double', fieldLength: 40 },
  { field: 'Comments',    description: 'Remarks',           type: 'string', fieldLength: 254 },
  { field: 'LicTradNum',  description: 'Federal Tax ID',    type: 'string', fieldLength: 32 },
]

const AP_INVOICE_LINES_FIELDS: SapFieldDef[] = [
  { field: 'ParentKey',      description: 'Parent Document Key',           type: 'long',   mandatory: true, isParentKey: true },
  { field: 'ItemCode',       description: 'Item No.',                      type: 'string', fieldLength: 50, mandatory: true, relatedTable: 'OITM' },
  { field: 'LineNum',        description: 'Line Number',                   type: 'long',   notes: '0-based integer.' },
  { field: 'ItemDescription',description: 'Item / Service Description',    type: 'string', fieldLength: 100 },
  { field: 'Quantity',       description: 'Quantity',                      type: 'double', fieldLength: 40 },
  { field: 'Price',          description: 'Unit Price',                    type: 'double', fieldLength: 40 },
  { field: 'WarehouseCode',  description: 'Warehouse Code',                type: 'string', fieldLength: 8,  relatedTable: 'OWHS' },
  { field: 'WTCode',         description: 'Withholding Tax Code',          type: 'string', fieldLength: 8 },
]

const AP_INVOICE_DOC_AUTO_MAP: AutoMapTable = {
  'Document No':    'DocNum',
  'Vendor Code':    'CardCode',
  'Posting Date':   'DocDate',
  'Vendor Name':    'CardName',
  'Vendor Ref No':  'NumAtCard',
  'Document Total': 'DocTotal',
  'Remarks':        'Comments',
  'Federal Tax ID': 'LicTradNum',
}

const AP_INVOICE_LINES_AUTO_MAP: AutoMapTable = {
  'Document No':               'ParentKey',
  'Item Code':                 'ItemCode',
  'Line No':                   'LineNum',
  'Item / Service Description':'ItemDescription',
  'Ordered Quantity':          'Quantity',
  'Unit Price':                'Price',
  'Warehouse':                 'WarehouseCode',
  'Wtax Code':                 'WTCode',
}

// ─── AR Invoice ────────────────────────────────────────────────────────────

const AR_INVOICE_DOC_FIELDS: SapFieldDef[] = [
  { field: 'DocNum',    description: 'Document Number',    type: 'long',   fieldLength: 11, mandatory: true, isKey: true, notes: 'Key field. Also used as ParentKey in Lines.' },
  { field: 'DocDate',   description: 'Posting Date',       type: 'date',   format: 'YYYYMMDD', fieldLength: 8 },
  { field: 'DocTotal',  description: 'Net Price Amount',   type: 'double', fieldLength: 40 },
  { field: 'Comments',  description: 'Remarks',            type: 'string', fieldLength: 254 },
]

const AR_INVOICE_LINES_FIELDS: SapFieldDef[] = [
  { field: 'ParentKey',        description: 'Parent Document Key',           type: 'long',   mandatory: true, isParentKey: true },
  { field: 'ItemCode',         description: 'Item No.',                      type: 'string', fieldLength: 50, mandatory: true, relatedTable: 'OITM' },
  { field: 'LineNum',          description: 'Line Number',                   type: 'long',   notes: '0-based integer.' },
  { field: 'ItemDescription',  description: 'Item / Service Description',    type: 'string', fieldLength: 100 },
  { field: 'Quantity',         description: 'Quantity',                      type: 'double', fieldLength: 40 },
  { field: 'Price',            description: 'Unit Price',                    type: 'double', fieldLength: 40 },
  { field: 'WarehouseCode',    description: 'Warehouse Code',                type: 'string', fieldLength: 8,  relatedTable: 'OWHS' },
  { field: 'TaxCode',          description: 'Tax Code',                      type: 'string', fieldLength: 8,  relatedTable: 'OSTC' },
  { field: 'OcrCode',          description: 'Distribution Rule 1 (Dept)',    type: 'string', fieldLength: 8 },
  { field: 'OcrCode2',         description: 'Distribution Rule 2',           type: 'string', fieldLength: 8 },
  { field: 'OcrCode3',         description: 'Distribution Rule 3',           type: 'string', fieldLength: 8 },
  { field: 'COGSDistribRule',  description: 'COGS Distribution Rule 1',      type: 'string', fieldLength: 8 },
  { field: 'COGSDistribRule2', description: 'COGS Distribution Rule 2',      type: 'string', fieldLength: 8 },
  { field: 'COGSDistribRule3', description: 'COGS Distribution Rule 3',      type: 'string', fieldLength: 8 },
]

const AR_INVOICE_DOC_AUTO_MAP: AutoMapTable = {
  'Document No':      'DocNum',
  'Posting Date':     'DocDate',
  'Net Price Amount': 'DocTotal',
  'Remarks':          'Comments',
}

const AR_INVOICE_LINES_AUTO_MAP: AutoMapTable = {
  'Purchase Order No':         'ParentKey',
  'Item Code':                 'ItemCode',
  'Line No':                   'LineNum',
  'Item / Service Description':'ItemDescription',
  'Ordered Quantity':          'Quantity',
  'Unit Price':                'Price',
  'Warehouse':                 'WarehouseCode',
  'Tax Code':                  'TaxCode',
  'Department Name':           'OcrCode',
  'Ocr Name 2':                'OcrCode2',
  'Ocr Name 3':                'OcrCode3',
  'COGS Dist Rule 1':          'COGSDistribRule',
  'COGS Dist Rule 2':          'COGSDistribRule2',
  'COGS Dist Rule 3':          'COGSDistribRule3',
}

// ─── Delivery ──────────────────────────────────────────────────────────────

const DELIVERY_DOC_FIELDS: SapFieldDef[] = [
  { field: 'DocNum',   description: 'Delivery Number',  type: 'long',   fieldLength: 11, mandatory: true, isKey: true, notes: 'Key field. Also used as ParentKey in Lines.' },
  { field: 'DocDate',  description: 'Date Created',     type: 'date',   format: 'YYYYMMDD', fieldLength: 8 },
  { field: 'TaxDate',  description: 'Document Date',    type: 'date',   format: 'YYYYMMDD', fieldLength: 8 },
  { field: 'Comments', description: 'Remarks',          type: 'string', fieldLength: 254 },
]

const DELIVERY_LINES_FIELDS: SapFieldDef[] = [
  { field: 'ParentKey',    description: 'Parent Document Key',  type: 'long',   mandatory: true, isParentKey: true },
  { field: 'ItemCode',     description: 'Item No.',             type: 'string', fieldLength: 50, mandatory: true, relatedTable: 'OITM' },
  { field: 'Quantity',     description: 'Quantity',             type: 'double', fieldLength: 40 },
  { field: 'WarehouseCode',description: 'Warehouse Code',       type: 'string', fieldLength: 8,  relatedTable: 'OWHS' },
  { field: 'OcrCode',      description: 'COG Branch / Dist Rule 1', type: 'string', fieldLength: 8 },
]

const DELIVERY_DOC_AUTO_MAP: AutoMapTable = {
  'DR Delivery Number': 'DocNum',
  'Date Created':       'DocDate',
  'DR DocDate':         'TaxDate',
  'DCS Remarks':        'Comments',
}

const DELIVERY_LINES_AUTO_MAP: AutoMapTable = {
  'DR Delivery Number': 'ParentKey',
  'Item Code':          'ItemCode',
  'Quantity':           'Quantity',
  'WHSE':               'WarehouseCode',
  'COG Branch':         'OcrCode',
}

// ─── Goods Issue ───────────────────────────────────────────────────────────

const GOODS_ISSUE_DOC_FIELDS: SapFieldDef[] = [
  { field: 'DocNum',   description: 'Goods Issue Number', type: 'long',   fieldLength: 11, mandatory: true, isKey: true, notes: 'Key field. Also used as ParentKey in Lines.' },
  { field: 'DocDate',  description: 'Posting Date',       type: 'date',   format: 'YYYYMMDD', fieldLength: 8 },
  { field: 'TaxDate',  description: 'Document Date',      type: 'date',   format: 'YYYYMMDD', fieldLength: 8 },
  { field: 'Comments', description: 'Remarks',            type: 'string', fieldLength: 254 },
]

const GOODS_ISSUE_LINES_FIELDS: SapFieldDef[] = [
  { field: 'ParentKey',    description: 'Parent Document Key',        type: 'long',   mandatory: true, isParentKey: true },
  { field: 'ItemCode',     description: 'Item No.',                   type: 'string', fieldLength: 50, mandatory: true, relatedTable: 'OITM' },
  { field: 'LineNum',      description: 'Line Number',                type: 'long',   notes: '0-based integer.' },
  { field: 'ItemDescription', description: 'Item Description',        type: 'string', fieldLength: 100 },
  { field: 'Quantity',     description: 'Quantity',                   type: 'double', fieldLength: 40 },
  { field: 'Price',        description: 'Unit Price',                 type: 'double', fieldLength: 40 },
  { field: 'WarehouseCode',description: 'Warehouse Code',             type: 'string', fieldLength: 8,  relatedTable: 'OWHS' },
  { field: 'OcrCode',      description: 'Cost Center / Dist Rule 1',  type: 'string', fieldLength: 8 },
  { field: 'OcrCode2',     description: 'Distribution Rule 2',        type: 'string', fieldLength: 8 },
  { field: 'OcrCode3',     description: 'Distribution Rule 3',        type: 'string', fieldLength: 8 },
  { field: 'OcrCode4',     description: 'Distribution Rule 4',        type: 'string', fieldLength: 8 },
  { field: 'OcrCode5',     description: 'Distribution Rule 5',        type: 'string', fieldLength: 8 },
]

const GOODS_ISSUE_DOC_AUTO_MAP: AutoMapTable = {
  'Goods Issue No': 'DocNum',
  'Posting Date':   'DocDate',
  'Document Date':  'TaxDate',
  'Remarks':        'Comments',
}

const GOODS_ISSUE_LINES_AUTO_MAP: AutoMapTable = {
  'Goods Issue No':  'ParentKey',
  'Item Code':       'ItemCode',
  'Line No':         'LineNum',
  'Item Description':'ItemDescription',
  'Quantity':        'Quantity',
  'Unit Price':      'Price',
  'Warehouse':       'WarehouseCode',
  'Cost Center 1':   'OcrCode',
  'Cost Center 2':   'OcrCode2',
  'Cost Center 3':   'OcrCode3',
  'Cost Center 4':   'OcrCode4',
  'Cost Center 5':   'OcrCode5',
}

// ─── Goods Receipt ─────────────────────────────────────────────────────────

const GOODS_RECEIPT_DOC_FIELDS: SapFieldDef[] = [
  { field: 'DocNum',   description: 'Goods Receipt Number', type: 'long',   fieldLength: 11, mandatory: true, isKey: true, notes: 'Key field. Also used as ParentKey in Lines.' },
  { field: 'DocDate',  description: 'Posting Date',         type: 'date',   format: 'YYYYMMDD', fieldLength: 8 },
  { field: 'TaxDate',  description: 'Document Date',        type: 'date',   format: 'YYYYMMDD', fieldLength: 8 },
  { field: 'Comments', description: 'Remarks',              type: 'string', fieldLength: 254 },
]

const GOODS_RECEIPT_LINES_FIELDS: SapFieldDef[] = [
  { field: 'ParentKey',    description: 'Parent Document Key',        type: 'long',   mandatory: true, isParentKey: true },
  { field: 'ItemCode',     description: 'Item No.',                   type: 'string', fieldLength: 50, mandatory: true, relatedTable: 'OITM' },
  { field: 'LineNum',      description: 'Line Number',                type: 'long',   notes: '0-based integer.' },
  { field: 'ItemDescription', description: 'Item Description',        type: 'string', fieldLength: 100 },
  { field: 'Quantity',     description: 'Quantity',                   type: 'double', fieldLength: 40 },
  { field: 'Price',        description: 'Unit Price',                 type: 'double', fieldLength: 40 },
  { field: 'WarehouseCode',description: 'Warehouse Code',             type: 'string', fieldLength: 8,  relatedTable: 'OWHS' },
  { field: 'OcrCode',      description: 'Cost Center / Dist Rule 1',  type: 'string', fieldLength: 8 },
  { field: 'OcrCode2',     description: 'Distribution Rule 2',        type: 'string', fieldLength: 8 },
  { field: 'OcrCode3',     description: 'Distribution Rule 3',        type: 'string', fieldLength: 8 },
  { field: 'OcrCode4',     description: 'Distribution Rule 4',        type: 'string', fieldLength: 8 },
  { field: 'OcrCode5',     description: 'Distribution Rule 5',        type: 'string', fieldLength: 8 },
]

const GOODS_RECEIPT_DOC_AUTO_MAP: AutoMapTable = {
  'Goods Receipt No': 'DocNum',
  'Posting Date':     'DocDate',
  'Document Date':    'TaxDate',
  'Remarks':          'Comments',
}

const GOODS_RECEIPT_LINES_AUTO_MAP: AutoMapTable = {
  'Goods Receipt No': 'ParentKey',
  'Item Code':        'ItemCode',
  'Line No':          'LineNum',
  'Item Description': 'ItemDescription',
  'Quantity':         'Quantity',
  'Unit Price':       'Price',
  'Warehouse':        'WarehouseCode',
  'Cost Center 1':    'OcrCode',
  'Cost Center 2':    'OcrCode2',
  'Cost Center 3':    'OcrCode3',
  'Cost Center 4':    'OcrCode4',
  'Cost Center 5':    'OcrCode5',
}

// ─── Registry ──────────────────────────────────────────────────────────────

const REGISTRY: Record<string, BizObjectConfig> = {
  po: {
    fields: { doc: PO_DOC_FIELDS, lines: PO_LINES_FIELDS },
    docAutoMap: PO_DOC_AUTO_MAP,
    linesAutoMap: PO_LINES_AUTO_MAP,
  },
  ar_credit_memo: {
    fields: { doc: AR_CREDIT_MEMO_DOC_FIELDS, lines: AR_CREDIT_MEMO_LINES_FIELDS },
    docAutoMap: AR_CREDIT_MEMO_DOC_AUTO_MAP,
    linesAutoMap: AR_CREDIT_MEMO_LINES_AUTO_MAP,
  },
  grpo: {
    fields: { doc: GRPO_DOC_FIELDS, lines: GRPO_LINES_FIELDS },
    docAutoMap: GRPO_DOC_AUTO_MAP,
    linesAutoMap: GRPO_LINES_AUTO_MAP,
  },
  return: {
    fields: { doc: RETURN_DOC_FIELDS, lines: RETURN_LINES_FIELDS },
    docAutoMap: RETURN_DOC_AUTO_MAP,
    linesAutoMap: RETURN_LINES_AUTO_MAP,
  },
  ap_downpayment: {
    fields: { doc: AP_DOWNPAYMENT_DOC_FIELDS, lines: AP_DOWNPAYMENT_LINES_FIELDS },
    docAutoMap: AP_DOWNPAYMENT_DOC_AUTO_MAP,
    linesAutoMap: AP_DOWNPAYMENT_LINES_AUTO_MAP,
  },
  ap_invoice: {
    fields: { doc: AP_INVOICE_DOC_FIELDS, lines: AP_INVOICE_LINES_FIELDS },
    docAutoMap: AP_INVOICE_DOC_AUTO_MAP,
    linesAutoMap: AP_INVOICE_LINES_AUTO_MAP,
  },
  ar_invoice: {
    fields: { doc: AR_INVOICE_DOC_FIELDS, lines: AR_INVOICE_LINES_FIELDS },
    docAutoMap: AR_INVOICE_DOC_AUTO_MAP,
    linesAutoMap: AR_INVOICE_LINES_AUTO_MAP,
  },
  delivery: {
    fields: { doc: DELIVERY_DOC_FIELDS, lines: DELIVERY_LINES_FIELDS },
    docAutoMap: DELIVERY_DOC_AUTO_MAP,
    linesAutoMap: DELIVERY_LINES_AUTO_MAP,
  },
  goods_issue: {
    fields: { doc: GOODS_ISSUE_DOC_FIELDS, lines: GOODS_ISSUE_LINES_FIELDS },
    docAutoMap: GOODS_ISSUE_DOC_AUTO_MAP,
    linesAutoMap: GOODS_ISSUE_LINES_AUTO_MAP,
  },
  goods_receipt: {
    fields: { doc: GOODS_RECEIPT_DOC_FIELDS, lines: GOODS_RECEIPT_LINES_FIELDS },
    docAutoMap: GOODS_RECEIPT_DOC_AUTO_MAP,
    linesAutoMap: GOODS_RECEIPT_LINES_AUTO_MAP,
  },
}

export function getBizObjectConfig(bizObjectId: string): BizObjectConfig | null {
  return REGISTRY[bizObjectId] ?? null
}

export interface MappingRowOutput {
  sourceField: string
  targetField: string
  tab: 'doc' | 'lines'
}

/** Given uploaded column headers, return pre-filled MappingRows using auto-map rules */
export function applyAutoMap(
  docCols: string[],
  linesCols: string[],
  config: BizObjectConfig,
): MappingRowOutput[] {
  return [
    ...docCols.map(src => ({
      sourceField: src,
      targetField: fuzzyMatchField(src, config.fields.doc, config.docAutoMap),
      tab: 'doc' as const,
    })),
    ...linesCols.map(src => ({
      sourceField: src,
      targetField: fuzzyMatchField(src, config.fields.lines, config.linesAutoMap),
      tab: 'lines' as const,
    })),
  ]
}

/**
 * Attempt to find a SAP field match for a single source column header.
 * Resolution order:
 *   1. Exact match in auto-map table
 *   2. Case-insensitive exact match against SAP field name or description
 *   3. SAP field name or description contains the source word (and vice-versa)
 * Returns the SAP field name string, or '' if no match found.
 */
export function fuzzyMatchField(
  source: string,
  sapFields: SapFieldDef[],
  autoMap: AutoMapTable,
): string {
  // 1. Exact auto-map lookup
  if (autoMap[source]) return autoMap[source]

  const s = source.toLowerCase().trim()

  // 2. Case-insensitive exact match against SAP field or description
  for (const f of sapFields) {
    if (f.field.toLowerCase() === s || f.description.toLowerCase() === s) return f.field
  }

  // 3. Partial / contains match — source words inside SAP field/desc or vice versa
  const sourceWords = s.split(/[\s_/\-]+/).filter(w => w.length > 2)
  let bestField = ''
  let bestScore = 0
  for (const f of sapFields) {
    const target = (f.field + ' ' + f.description).toLowerCase()
    const targetWords = target.split(/[\s_/\-]+/).filter(w => w.length > 2)
    const hits = sourceWords.filter(w => targetWords.some(t => t.includes(w) || w.includes(t))).length
    const score = hits / Math.max(sourceWords.length, 1)
    if (score > bestScore && score >= 0.5) {
      bestScore = score
      bestField = f.field
    }
  }
  return bestField
}

/**
 * Re-runs auto-mapping over existing rows, preserving any manually-set
 * mappings that are not overwritten by a higher-confidence match.
 * Pass `overwrite = true` to replace all existing mappings.
 */
export function reAutoMap(
  rows: MappingRowOutput[],
  config: BizObjectConfig,
  overwrite = false,
): MappingRowOutput[] {
  return rows.map(row => {
    if (!overwrite && row.targetField.trim() !== '') return row
    const sapFields = row.tab === 'doc' ? config.fields.doc : config.fields.lines
    const autoMap   = row.tab === 'doc' ? config.docAutoMap : config.linesAutoMap
    const matched   = fuzzyMatchField(row.sourceField, sapFields, autoMap)
    return { ...row, targetField: matched }
  })
}

// ─── Cell-level validation ─────────────────────────────────────────────────

import type { CellValidationError } from '@/types/wizard'

/** Format a cell value to string, handling Date objects from XLSX. */
function cellToString(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) {
    // Format as YYYYMMDD — the expected SAP date format
    const y = value.getFullYear()
    const m = String(value.getMonth() + 1).padStart(2, '0')
    const d = String(value.getDate()).padStart(2, '0')
    return `${y}${m}${d}`
  }
  return String(value).trim()
}

function isValidYYYYMMDD(s: string): boolean {
  if (!/^\d{8}$/.test(s)) return false
  const y = parseInt(s.slice(0, 4))
  const m = parseInt(s.slice(4, 6))
  const d = parseInt(s.slice(6, 8))
  if (m < 1 || m > 12 || d < 1 || d > 31) return false
  const date = new Date(y, m - 1, d)
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d
}

/**
 * Validate all data rows against the SAP field rules for their mapped target fields.
 * Only validates columns that have a target field mapping.
 */
export function validateMappedRows(
  rows: Record<string, unknown>[],
  mappings: MappingRowOutput[],
  sapFieldDefs: SapFieldDef[],
  tab: 'doc' | 'lines',
): CellValidationError[] {
  const errors: CellValidationError[] = []
  // Only consider mappings for this tab that have a SAP target
  const activeMappings = mappings.filter(m => m.tab === tab && m.targetField.trim() !== '')

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNum = i + 1  // 1-indexed data row (header is row 0)

    for (const mapping of activeMappings) {
      const def = sapFieldDefs.find(f => f.field === mapping.targetField)
      if (!def) continue

      const raw = row[mapping.sourceField]
      const strVal = cellToString(raw)
      const isEmpty = strVal === ''

      // Mandatory
      if (def.mandatory && isEmpty) {
        errors.push({
          row: rowNum,
          sourceColumn: mapping.sourceField,
          targetField: def.field,
          value: '',
          reason: `Required field — cannot be empty`,
        })
        continue // skip further checks for this cell
      }

      if (isEmpty) continue // optional empty = fine

      // Type-specific rules
      switch (def.type) {
        case 'date': {
          // Accept Date objects (already converted to YYYYMMDD above); validate the string
          if (!isValidYYYYMMDD(strVal)) {
            errors.push({
              row: rowNum,
              sourceColumn: mapping.sourceField,
              targetField: def.field,
              value: strVal,
              reason: `Invalid date — expected YYYYMMDD format (e.g. 20240115), got "${strVal}"`,
            })
          }
          break
        }
        case 'double': {
          if (isNaN(Number(strVal))) {
            errors.push({
              row: rowNum,
              sourceColumn: mapping.sourceField,
              targetField: def.field,
              value: strVal,
              reason: `Expected a numeric value`,
            })
          }
          break
        }
        case 'long': {
          if (!/^-?\d+$/.test(strVal)) {
            errors.push({
              row: rowNum,
              sourceColumn: mapping.sourceField,
              targetField: def.field,
              value: strVal,
              reason: `Expected an integer value`,
            })
          }
          break
        }
        case 'enum': {
          if (def.validValues && !def.validValues.includes(strVal)) {
            errors.push({
              row: rowNum,
              sourceColumn: mapping.sourceField,
              targetField: def.field,
              value: strVal,
              reason: `Invalid value — must be one of: ${def.validValues.join(', ')}`,
            })
          }
          break
        }
        case 'string': {
          if (def.fieldLength && strVal.length > def.fieldLength) {
            errors.push({
              row: rowNum,
              sourceColumn: mapping.sourceField,
              targetField: def.field,
              value: strVal,
              reason: `Exceeds max length of ${def.fieldLength} characters (got ${strVal.length})`,
            })
          }
          break
        }
      }
    }
  }

  return errors
}
