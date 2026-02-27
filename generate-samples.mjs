import * as XLSX from 'xlsx'

const headers = [
  'vendor_code', 'document_date', 'document_type', 'document_number', 'po_number',
  'line_item', 'material_code', 'description', 'quantity', 'unit',
  'unit_price', 'currency', 'total_amount', 'tax_code', 'cost_center', 'remarks'
]

function makeSheet(rows) {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
  ws['!cols'] = headers.map(() => ({ wch: 22 }))
  return ws
}

// ─── SUCCESS FILE ────────────────────────────────────────────────────────────
const successRows = [
  ['V-10042', '2025-01-15', 'INVOICE',       'INV-2025-00123', 'PO-4500012345', 10, 'MAT-00987', 'Office Chair Black',        5,  'EA',  1250.00, 'PHP',  6250.00, 'V1', 'CC-1001', 'Urgent delivery'],
  ['V-10042', '2025-01-15', 'INVOICE',       'INV-2025-00123', 'PO-4500012345', 20, 'MAT-00988', 'Standing Desk White',       2,  'EA',  8500.00, 'PHP', 17000.00, 'V1', 'CC-1001', ''],
  ['V-10055', '2025-02-01', 'INVOICE',       'INV-2025-00124', 'PO-4500012346', 10, 'MAT-01100', 'Printer Ink Cartridge',    10,  'BOX',   350.00, 'PHP',  3500.00, 'V2', 'CC-1002', 'Monthly supply'],
  ['V-10055', '2025-02-01', 'INVOICE',       'INV-2025-00124', 'PO-4500012346', 20, 'MAT-01101', 'A4 Bond Paper 500s',       20,  'BOX',   280.00, 'PHP',  5600.00, 'V2', 'CC-1002', ''],
  ['V-20010', '2025-02-14', 'PO',            'PO-2025-00045',  'PO-4500012347', 10, 'MAT-02200', 'Laptop Stand Aluminum',     8,  'EA',  1800.00, 'PHP', 14400.00, 'V1', 'CC-2001', ''],
  ['V-20010', '2025-02-14', 'PO',            'PO-2025-00045',  'PO-4500012347', 20, 'MAT-02201', 'USB-C Hub 7-port',         15,  'EA',   950.00, 'PHP', 14250.00, 'V1', 'CC-2001', 'Priority order'],
  ['V-30001', '2025-03-03', 'GOODS_RECEIPT', 'GR-2025-00010',  'PO-4500012348', 10, 'MAT-03300', 'Office Cleaning Supply',    3,   'KG',   420.00, 'PHP',  1260.00, 'V3', 'CC-3001', ''],
  ['V-30001', '2025-03-03', 'GOODS_RECEIPT', 'GR-2025-00010',  'PO-4500012348', 20, 'MAT-03301', 'Disinfectant Spray 500ml', 24,  'PC',    85.00, 'PHP',  2040.00, 'V3', 'CC-3001', 'Bulk order'],
  ['V-40099', '2025-03-10', 'CREDIT_NOTE',   'CN-2025-00005',  'PO-4500012349', 10, 'MAT-04400', 'Return: Broken Monitor',    1,  'EA', 12000.00, 'PHP', 12000.00, 'V1', 'CC-4001', 'Defective unit'],
  ['V-50012', '2025-03-20', 'INVOICE',       'INV-2025-00200', 'PO-4500012350', 10, 'MAT-05500', 'Wireless Mouse Ergonomic',  6,  'EA',   750.00, 'PHP',  4500.00, 'V1', 'CC-1001', ''],
]

const successWb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(successWb, makeSheet(successRows), 'Documents')
XLSX.writeFile(successWb, 'sample_upload_SUCCESS.xlsx')
console.log('✅ sample_upload_SUCCESS.xlsx created (10 rows, all valid)')

// ─── ERROR FILE ──────────────────────────────────────────────────────────────
const errorRows = [
  // Row 2 — valid row (control)
  ['V-10042', '2025-01-15', 'INVOICE',       'INV-2025-00123', 'PO-4500012345', 10, 'MAT-00987', 'Office Chair Black',   5, 'EA',  1250.00, 'PHP', 6250.00, 'V1', 'CC-1001', ''],
  // Row 3 — missing vendor_code
  ['',        '2025-01-20', 'INVOICE',       'INV-2025-00125', 'PO-4500012351', 10, 'MAT-00989', 'Monitor 27 inch',      1, 'EA', 15000.00, 'PHP', 15000.00, 'V1', 'CC-1001', ''],
  // Row 4 — invalid document_type
  ['V-10043', '2025-01-22', 'RECEIPT',       'INV-2025-00126', 'PO-4500012352', 10, 'MAT-00990', 'Keyboard Mechanical',  2, 'EA',  3200.00, 'PHP',  6400.00, 'V1', 'CC-1002', ''],
  // Row 5 — future document_date
  ['V-10044', '2099-06-01', 'PO',            'PO-2025-00050',  'PO-4500012353', 10, 'MAT-00991', 'Webcam HD 1080p',      3, 'PC',  2500.00, 'PHP',  7500.00, 'V2', 'CC-1003', ''],
  // Row 6 — total_amount does not match qty × price (wrong total)
  ['V-10045', '2025-02-10', 'INVOICE',       'INV-2025-00127', 'PO-4500012354', 10, 'MAT-00992', 'Headset Noise Cancel',  4, 'EA',  4000.00, 'PHP',  9999.00, 'V1', 'CC-1001', 'Wrong total'],
  // Row 7 — negative quantity
  ['V-10046', '2025-02-12', 'INVOICE',       'INV-2025-00128', 'PO-4500012355', 10, 'MAT-00993', 'Mouse Pad XL',         -5, 'EA',   350.00, 'PHP', -1750.00, 'V1', 'CC-1002', ''],
  // Row 8 — invalid unit
  ['V-10047', '2025-02-15', 'GOODS_RECEIPT', 'GR-2025-00011',  'PO-4500012356', 10, 'MAT-00994', 'Bottled Water 500ml',  24, 'CTN',   25.00, 'PHP',   600.00, 'V3', 'CC-2001', ''],
  // Row 9 — invalid currency
  ['V-10048', '2025-02-18', 'INVOICE',       'INV-2025-00129', 'PO-4500012357', 10, 'MAT-00995', 'Desk Lamp LED',         2, 'EA',  1200.00, 'XYZ',  2400.00, 'V1', 'CC-1001', ''],
  // Row 10 — missing po_number and cost_center
  ['V-10049', '2025-02-20', 'CREDIT_NOTE',   'CN-2025-00006',  '',              10, 'MAT-00996', 'Return: Faulty Lamp',   1, 'EA',  1200.00, 'PHP',  1200.00, 'V1', '',        'Missing PO & CC'],
  // Row 11 — multiple errors: empty document_number, zero unit_price
  ['V-10050', '2025-03-01', 'INVOICE',       '',               'PO-4500012359', 10, 'MAT-00997', 'Extension Cord 3m',    5, 'BOX',    0.00, 'PHP',     0.00, 'V2', 'CC-3001', ''],
]

const errorWb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(errorWb, makeSheet(errorRows), 'Documents')
XLSX.writeFile(errorWb, 'sample_upload_ERROR.xlsx')
console.log('❌ sample_upload_ERROR.xlsx created (11 rows, 9 rows with errors)')
console.log('')
console.log('Error summary:')
console.log('  Row 3  — missing vendor_code')
console.log('  Row 4  — invalid document_type "RECEIPT"')
console.log('  Row 5  — future document_date (2099)')
console.log('  Row 6  — total_amount mismatch (4×4000=16000, but 9999 entered)')
console.log('  Row 7  — negative quantity (-5)')
console.log('  Row 8  — invalid unit "CTN"')
console.log('  Row 9  — invalid currency "XYZ"')
console.log('  Row 10 — missing po_number and cost_center')
console.log('  Row 11 — empty document_number + zero unit_price')
