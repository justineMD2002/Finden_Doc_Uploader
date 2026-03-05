/**
 * SAP B1 Service Layer client.
 * All fetch calls go to /b1s/... which is proxied by Vite → https://47.250.53.233:50000
 */

import type { UploadedFile } from '@/types/wizard'
import type { MappingRow } from '@/types/wizard'
import type { ImportResult } from '@/types/wizard'

const BASE = '/b1s/v1'

// ─── Session ───────────────────────────────────────────────────────────────

export interface SapSession {
  sessionId: string
  sessionTimeout: number   // minutes
  companyDB: string
}

function authHeaders(sessionId: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'Cookie': `B1SESSION=${sessionId}`,
  }
}

// ─── Auth ──────────────────────────────────────────────────────────────────

export async function sapLogin(companyDB: string): Promise<SapSession> {
  const res = await fetch(`${BASE}/Login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      CompanyDB: companyDB,
      UserName: import.meta.env.VITE_SAP_USERNAME,
      Password: import.meta.env.VITE_SAP_PASSWORD,
    }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(
      body?.error?.message?.value ?? `SAP login failed (HTTP ${res.status})`
    )
  }

  const data = await res.json()
  console.log('[SAP] Login response:', data)
  const session: SapSession = {
    sessionId: data.SessionId as string,
    sessionTimeout: data.SessionTimeout as number,
    companyDB,
  }
  console.log('[SAP] Session established:', session)
  return session
}

export async function sapLogout(sessionId: string): Promise<void> {
  await fetch(`${BASE}/Logout`, {
    method: 'POST',
    headers: authHeaders(sessionId),
    credentials: 'include',
  }).catch(() => {
    // Best-effort — ignore errors on logout
  })
}

// ─── Generic request ───────────────────────────────────────────────────────

async function sapPost<T = unknown>(
  endpoint: string,
  body: unknown,
  sessionId: string,
): Promise<T> {
  const res = await fetch(`${BASE}/${endpoint}`, {
    method: 'POST',
    headers: authHeaders(sessionId),
    credentials: 'include',
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(
      err?.error?.message?.value ?? `SAP API error on ${endpoint} (HTTP ${res.status})`
    )
  }

  return res.json() as Promise<T>
}

// ─── Business object → Service Layer endpoint ─────────────────────────────

const SAP_ENDPOINTS: Record<string, string> = {
  po:             'PurchaseOrders',
  ap_invoice:     'PurchaseInvoices',
  ap_downpayment: 'PurchaseDownPayments',
  grpo:           'GoodsReceiptsPO',
  ar_invoice:     'Invoices',
  ar_credit_memo: 'CreditNotes',
  delivery:       'DeliveryNotes',
  return:         'Returns',
  goods_issue:    'InventoryGenExits',
  goods_receipt:  'InventoryGenEntries',
  inv_transfer:   'StockTransfers',
}

// ─── Payload builders ──────────────────────────────────────────────────────

/**
 * Convert a raw cell value to the format SAP Service Layer expects.
 * - Date objects / YYYYMMDD strings → "YYYY-MM-DD"
 * - Everything else passes through
 */
function toSapValue(value: unknown, fieldName: string): unknown {
  if (value === null || value === undefined || value === '') return undefined

  // JS Date from xlsx cellDates: true
  if (value instanceof Date) {
    const y = value.getFullYear()
    const m = String(value.getMonth() + 1).padStart(2, '0')
    const d = String(value.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  if (typeof value === 'string') {
    const s = value.trim()
    if (s === '') return undefined
    // YYYYMMDD date strings for date-type fields
    if (/Date$/.test(fieldName) && /^\d{8}$/.test(s)) {
      return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
    }
    return s
  }

  return value
}

/**
 * Build a Service Layer document payload from one doc-header row
 * and its associated line rows, using the field mappings.
 */
function buildPayload(
  docRow: Record<string, unknown>,
  lineRows: Record<string, unknown>[],
  mappings: MappingRow[],
): Record<string, unknown> {
  const docMappings   = mappings.filter(m => m.tab === 'doc'   && m.targetField.trim())
  const linesMappings = mappings.filter(m => m.tab === 'lines' && m.targetField.trim())

  // Header fields
  const header: Record<string, unknown> = {}
  for (const m of docMappings) {
    if (m.targetField === 'DocNum') continue  // SAP assigns DocNum; skip in payload
    const v = toSapValue(docRow[m.sourceField], m.targetField)
    if (v !== undefined) header[m.targetField] = v
  }

  // Lines
  const DocumentLines = lineRows.map(lineRow => {
    const line: Record<string, unknown> = {}
    for (const m of linesMappings) {
      if (m.targetField === 'ParentKey') continue  // internal key, not sent
      const v = toSapValue(lineRow[m.sourceField], m.targetField)
      if (v !== undefined) line[m.targetField] = v
    }
    return line
  })

  return { ...header, DocumentLines }
}

/**
 * Group doc rows with their matching lines rows (by DocNum → ParentKey).
 */
function groupDocuments(
  docRows: Record<string, unknown>[],
  linesRows: Record<string, unknown>[],
  mappings: MappingRow[],
): Array<{ docRow: Record<string, unknown>; lineRows: Record<string, unknown>[] }> {
  const docNumSrc   = mappings.find(m => m.tab === 'doc'   && m.targetField === 'DocNum')?.sourceField
  const parentKeySrc = mappings.find(m => m.tab === 'lines' && m.targetField === 'ParentKey')?.sourceField

  return docRows.map(docRow => {
    let lineRows: Record<string, unknown>[]

    if (docNumSrc && parentKeySrc) {
      const docNum = String(docRow[docNumSrc] ?? '')
      lineRows = linesRows.filter(l => String(l[parentKeySrc] ?? '') === docNum)
    } else {
      // No key mapping — assign all lines to every document (edge case)
      lineRows = linesRows
    }

    return { docRow, lineRows }
  })
}

// ─── Test import (local validation only, no SAP write) ────────────────────

export async function runSapTest(
  bizObjectId: string,
  docFile: UploadedFile,
  linesFile: UploadedFile,
  mappings: MappingRow[],
): Promise<ImportResult> {
  const endpoint = SAP_ENDPOINTS[bizObjectId]
  const errors: ImportResult['errors'] = []

  if (!endpoint) {
    return {
      mode: 'test',
      status: 'failed',
      totalRecords: 0,
      successCount: 0,
      failedCount: 0,
      errors: [{ row: 0, field: 'Business Object', message: `No SAP endpoint configured for "${bizObjectId}"` }],
      timestamp: new Date().toISOString(),
    }
  }

  const groups = groupDocuments(docFile.rows, linesFile.rows, mappings)

  for (let i = 0; i < groups.length; i++) {
    const { docRow, lineRows } = groups[i]
    const payload = buildPayload(docRow, lineRows, mappings)

    // Validate required header fields
    if (!payload['CardCode']) {
      errors.push({ row: i + 1, field: 'CardCode', message: 'Vendor/Customer code (CardCode) is required' })
    }
    if (!payload['DocumentLines'] || (payload['DocumentLines'] as unknown[]).length === 0) {
      errors.push({ row: i + 1, field: 'DocumentLines', message: 'No document lines found — check ParentKey mapping' })
    }
  }

  const failedCount  = Math.min(errors.length, groups.length)
  const successCount = groups.length - failedCount
  const status: ImportResult['status'] = failedCount === 0 ? 'success' : successCount === 0 ? 'failed' : 'partial'

  return {
    mode: 'test',
    status,
    totalRecords: groups.length,
    successCount,
    failedCount,
    errors,
    timestamp: new Date().toISOString(),
  }
}

// ─── Real import (posts to SAP Service Layer) ─────────────────────────────

export async function runSapImport(
  bizObjectId: string,
  docFile: UploadedFile,
  linesFile: UploadedFile,
  mappings: MappingRow[],
  sessionId: string,
): Promise<ImportResult> {
  const endpoint = SAP_ENDPOINTS[bizObjectId]

  if (!endpoint) {
    return {
      mode: 'import',
      status: 'failed',
      totalRecords: 0,
      successCount: 0,
      failedCount: 0,
      errors: [{ row: 0, field: 'Business Object', message: `No SAP endpoint configured for "${bizObjectId}"` }],
      timestamp: new Date().toISOString(),
    }
  }

  const groups = groupDocuments(docFile.rows, linesFile.rows, mappings)
  const errors: ImportResult['errors'] = []
  let successCount = 0
  let lastDocNum: string | undefined

  for (let i = 0; i < groups.length; i++) {
    const { docRow, lineRows } = groups[i]
    try {
      const payload = buildPayload(docRow, lineRows, mappings)
      const result  = await sapPost<{ DocNum?: number; DocEntry?: number }>(endpoint, payload, sessionId)
      successCount++
      if (result.DocNum !== undefined) lastDocNum = String(result.DocNum)
    } catch (err) {
      errors.push({
        row: i + 1,
        field: 'Document',
        message: err instanceof Error ? err.message : 'Unknown SAP error',
      })
    }
  }

  const failedCount  = groups.length - successCount
  const status: ImportResult['status'] = failedCount === 0 ? 'success' : successCount === 0 ? 'failed' : 'partial'

  return {
    mode: 'import',
    status,
    totalRecords: groups.length,
    successCount,
    failedCount,
    errors,
    sapReference: lastDocNum,
    timestamp: new Date().toISOString(),
  }
}
