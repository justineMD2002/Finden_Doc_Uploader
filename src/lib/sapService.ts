/**
 * SAP B1 Service Layer client.
 * All fetch calls go to /b1s/... which is proxied by Vite → VITE_SAP_BASE_URL.
 * The proxy runs in Node.js with secure:false so it can reach self-signed certs.
 */

import type { UploadedFile, MappingRow, ImportResult, CopyFromState } from '@/types/wizard'
import type { ErrorHandlingMode } from '@/types/wizard'

const BASE = '/b1s/v1'

// ─── Session ───────────────────────────────────────────────────────────────

export interface SapSession {
  sessionId: string
  sessionTimeout: number   // minutes
  companyDB: string
}

// ─── SAP endpoint registry ─────────────────────────────────────────────────

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

// ─── HTTP helpers ──────────────────────────────────────────────────────────

function authHeaders(sessionId: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'Cookie': `B1SESSION=${sessionId}`,
  }
}

async function parseError(res: Response): Promise<string> {
  try {
    const body = await res.json()
    return body?.error?.message?.value ?? `SAP error (HTTP ${res.status})`
  } catch {
    return `SAP error (HTTP ${res.status})`
  }
}

async function sapGet<T = unknown>(endpoint: string, sessionId: string): Promise<T | null> {
  const res = await fetch(`${BASE}/${endpoint}`, {
    method: 'GET',
    headers: authHeaders(sessionId),
    credentials: 'include',
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<T>
}

async function sapPost<T = unknown>(endpoint: string, body: unknown, sessionId: string): Promise<T> {
  const res = await fetch(`${BASE}/${endpoint}`, {
    method: 'POST',
    headers: authHeaders(sessionId),
    credentials: 'include',
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<T>
}

async function sapPatch(endpoint: string, docEntry: number, body: unknown, sessionId: string): Promise<void> {
  const res = await fetch(`${BASE}/${endpoint}(${docEntry})`, {
    method: 'PATCH',
    headers: authHeaders(sessionId),
    credentials: 'include',
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  // 204 No Content on success — nothing to return
}

/** Best-effort cancel — used during rollback. Never throws. */
async function sapCancel(endpoint: string, docEntry: number, sessionId: string): Promise<void> {
  try {
    const res = await fetch(`${BASE}/${endpoint}(${docEntry})/Cancel`, {
      method: 'POST',
      headers: authHeaders(sessionId),
      credentials: 'include',
    })
    if (!res.ok) console.warn(`[SAP] Cancel failed for ${endpoint}(${docEntry}): HTTP ${res.status}`)
  } catch (err) {
    console.warn(`[SAP] Cancel threw for ${endpoint}(${docEntry}):`, err)
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
  if (!res.ok) throw new Error(await parseError(res))
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
  }).catch(() => { /* best-effort */ })
}

// ─── Master-data lookups (used in test import) ────────────────────────────

async function cardCodeExists(cardCode: string, sessionId: string): Promise<boolean> {
  const data = await sapGet<{ CardCode: string }>(
    `BusinessPartners('${encodeURIComponent(cardCode)}')?$select=CardCode`,
    sessionId,
  )
  return data !== null
}

async function itemCodeExists(itemCode: string, sessionId: string): Promise<boolean> {
  const data = await sapGet<{ ItemCode: string }>(
    `Items('${encodeURIComponent(itemCode)}')?$select=ItemCode`,
    sessionId,
  )
  return data !== null
}

/** Returns DocEntry if the document exists in SAP, otherwise null. */
async function findDocEntry(
  endpoint: string,
  docNum: number,
  sessionId: string,
): Promise<number | null> {
  const data = await sapGet<{ value: Array<{ DocEntry: number }> }>(
    `${endpoint}?$filter=DocNum eq ${docNum}&$select=DocEntry,DocNum&$top=1`,
    sessionId,
  )
  if (data?.value?.length) return data.value[0].DocEntry
  return null
}

/**
 * Look up a source document by DocNum for Copy From.
 * Returns { docEntry, docNum } if found, null if not found.
 */
export async function lookupSourceDoc(
  sourceObjectId: string,
  docNum: number,
  sessionId: string,
): Promise<{ docEntry: number; docNum: number } | null> {
  const endpoint = SAP_ENDPOINTS[sourceObjectId]
  if (!endpoint) return null
  const docEntry = await findDocEntry(endpoint, docNum, sessionId)
  if (docEntry === null) return null
  return { docEntry, docNum }
}

// ─── Payload builder ───────────────────────────────────────────────────────

/** Convert a raw cell value to the format SAP Service Layer expects. */
function toSapValue(value: unknown, fieldName: string): unknown {
  if (value === null || value === undefined || value === '') return undefined

  if (value instanceof Date) {
    const y = value.getFullYear()
    const m = String(value.getMonth() + 1).padStart(2, '0')
    const d = String(value.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  if (typeof value === 'string') {
    const s = value.trim()
    if (!s) return undefined
    // YYYYMMDD → YYYY-MM-DD for date fields
    if (/Date$/.test(fieldName) && /^\d{8}$/.test(s)) {
      return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
    }
    return s
  }

  return value
}

/**
 * Build a Service Layer document payload.
 * If the DocNum mapping produces a value it is included in the payload
 * (SAP will treat this as a Handwritten/manual document).
 * If DocNum is empty/unmapped, it is omitted and SAP auto-assigns it.
 */
function buildPayload(
  docRow: Record<string, unknown>,
  lineRows: Record<string, unknown>[],
  mappings: MappingRow[],
  copyFrom?: CopyFromState | null,
): { payload: Record<string, unknown>; docNum: number | null } {
  const docMappings   = mappings.filter(m => m.tab === 'doc'   && m.targetField.trim())
  const linesMappings = mappings.filter(m => m.tab === 'lines' && m.targetField.trim())

  const header: Record<string, unknown> = {}
  let docNum: number | null = null

  for (const m of docMappings) {
    const v = toSapValue(docRow[m.sourceField], m.targetField)
    if (v === undefined) continue

    if (m.targetField === 'DocNum') {
      const n = Number(v)
      if (!isNaN(n) && n > 0) {
        docNum = n
        header['DocNum'] = n
        // Mark as Handwritten so SAP respects the provided DocNum
        header['Handwritten'] = 'tYES'
      }
      continue
    }

    header[m.targetField] = v
  }

  const DocumentLines = lineRows.map((lineRow, lineIndex) => {
    const line: Record<string, unknown> = {}
    for (const m of linesMappings) {
      if (m.targetField === 'ParentKey' || m.targetField === 'LineNum') continue
      const v = toSapValue(lineRow[m.sourceField], m.targetField)
      if (v !== undefined) line[m.targetField] = v
    }
    if (copyFrom) {
      line['BaseType']  = copyFrom.sourceObjectType
      line['BaseEntry'] = copyFrom.sourceDocEntry
      line['BaseLine']  = lineIndex
    }
    return line
  })

  return { payload: { ...header, DocumentLines }, docNum }
}

/** Group doc rows with their matching line rows by DocNum → ParentKey. */
function groupDocuments(
  docRows: Record<string, unknown>[],
  linesRows: Record<string, unknown>[],
  mappings: MappingRow[],
): Array<{ docRow: Record<string, unknown>; lineRows: Record<string, unknown>[] }> {
  const docNumSrc    = mappings.find(m => m.tab === 'doc'   && m.targetField === 'DocNum')?.sourceField
  const parentKeySrc = mappings.find(m => m.tab === 'lines' && m.targetField === 'ParentKey')?.sourceField

  return docRows.map(docRow => {
    if (docNumSrc && parentKeySrc) {
      const key = String(docRow[docNumSrc] ?? '')
      return { docRow, lineRows: linesRows.filter(l => String(l[parentKeySrc] ?? '') === key) }
    }
    return { docRow, lineRows: linesRows }
  })
}

// ─── Progress callback type ────────────────────────────────────────────────

export interface ImportProgress {
  current: number
  total: number
  phase: 'validating' | 'importing' | 'rolling_back'
  action: string          // Human-readable current action
  successCount: number
  failedCount: number
}

export type ProgressCallback = (p: ImportProgress) => void

// ─── Concurrency helper ────────────────────────────────────────────────────

/**
 * Runs `tasks` with at most `limit` running concurrently.
 * Results are returned in the same order as the input tasks.
 */
async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  limit: number,
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = new Array(tasks.length)
  let nextIndex = 0

  async function worker() {
    while (nextIndex < tasks.length) {
      const i = nextIndex++
      try {
        results[i] = { status: 'fulfilled', value: await tasks[i]() }
      } catch (e) {
        results[i] = { status: 'rejected', reason: e }
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker))
  return results
}

// ─── Test import ───────────────────────────────────────────────────────────

/**
 * Validates all documents locally and against SAP master data
 * without writing anything to SAP.
 */
export async function runSapTest(
  bizObjectId: string,
  docFile: UploadedFile,
  linesFile: UploadedFile,
  mappings: MappingRow[],
  sessionId: string,
  onProgress: ProgressCallback,
  copyFrom?: CopyFromState | null,
): Promise<ImportResult> {
  const endpoint = SAP_ENDPOINTS[bizObjectId]
  const errors: ImportResult['errors'] = []

  if (!endpoint) {
    return {
      mode: 'test', status: 'failed',
      totalRecords: 0, successCount: 0, failedCount: 0,
      errors: [{ row: 0, field: 'Business Object', message: `No SAP endpoint for "${bizObjectId}"` }],
      timestamp: new Date().toISOString(),
    }
  }

  const groups = groupDocuments(docFile.rows, linesFile.rows, mappings)
  const total  = groups.length

  // Cache checked codes to avoid duplicate SAP queries
  const checkedCards = new Map<string, boolean>()
  const checkedItems = new Map<string, boolean>()

  const cardCodeSrc = mappings.find(m => m.tab === 'doc'   && m.targetField === 'CardCode')?.sourceField
  const itemCodeSrc = mappings.find(m => m.tab === 'lines' && m.targetField === 'ItemCode')?.sourceField

  for (let i = 0; i < groups.length; i++) {
    const { docRow, lineRows } = groups[i]
    const { payload } = buildPayload(docRow, lineRows, mappings, copyFrom)

    onProgress({
      current: i + 1, total,
      phase: 'validating',
      action: `Validating document ${i + 1} of ${total}`,
      successCount: i - errors.length,
      failedCount: errors.length,
    })

    // ── Required field checks ──────────────────────────────────────────────
    if (!payload['CardCode'] && !copyFrom) {
      errors.push({ row: i + 1, field: 'CardCode', message: 'CardCode is required' })
      continue
    }
    if (!Array.isArray(payload['DocumentLines']) || payload['DocumentLines'].length === 0) {
      errors.push({ row: i + 1, field: 'DocumentLines', message: 'No document lines found — check ParentKey mapping' })
      continue
    }

    // ── SAP master data validation ─────────────────────────────────────────
    // CardCode
    if (cardCodeSrc) {
      const cardCode = String(docRow[cardCodeSrc] ?? '').trim()
      if (cardCode && !checkedCards.has(cardCode)) {
        const exists = await cardCodeExists(cardCode, sessionId).catch(() => true /* skip on error */)
        checkedCards.set(cardCode, exists)
      }
      if (checkedCards.get(cardCode) === false) {
        errors.push({ row: i + 1, field: 'CardCode', message: `Business partner "${cardCode}" not found in SAP` })
      }
    }

    // ItemCode (check each unique item in lines)
    if (itemCodeSrc) {
      for (const lineRow of lineRows) {
        const itemCode = String(lineRow[itemCodeSrc] ?? '').trim()
        if (!itemCode) continue
        if (!checkedItems.has(itemCode)) {
          const exists = await itemCodeExists(itemCode, sessionId).catch(() => true)
          checkedItems.set(itemCode, exists)
        }
        if (checkedItems.get(itemCode) === false) {
          errors.push({ row: i + 1, field: 'ItemCode', message: `Item "${itemCode}" not found in SAP` })
          break  // one error per document line group is enough
        }
      }
    }
  }

  const failedCount  = Math.min(errors.length, total)
  const successCount = total - failedCount
  const status: ImportResult['status'] = failedCount === 0 ? 'success' : successCount === 0 ? 'failed' : 'partial'

  return {
    mode: 'test', status,
    totalRecords: total, successCount, failedCount,
    errors,
    timestamp: new Date().toISOString(),
  }
}

// ─── Real import ───────────────────────────────────────────────────────────

/**
 * Posts documents to SAP B1 Service Layer.
 *
 * Add vs Update:
 *   - If DocNum is provided and already exists in SAP → PATCH (update)
 *   - If DocNum is provided but doesn't exist       → POST with Handwritten=tYES
 *   - If DocNum is not provided                     → POST, SAP auto-assigns DocNum
 *
 * Error handling:
 *   - cancel_rollback → sequential processing; stop on first error and roll back all created docs
 *   - ignore_up_to_10 → parallel (up to 5 concurrent); stop after 10 cumulative errors
 *   - ignore_all      → parallel (up to 5 concurrent); continue regardless of errors
 *
 * Parallelism note:
 *   cancel_rollback uses sequential (concurrency = 1) so rollback is clean and
 *   deterministic. The other two modes use concurrency = 5 for throughput.
 */
export async function runSapImport(
  bizObjectId: string,
  docFile: UploadedFile,
  linesFile: UploadedFile,
  mappings: MappingRow[],
  sessionId: string,
  errorHandling: ErrorHandlingMode,
  onProgress: ProgressCallback,
  copyFrom?: CopyFromState | null,
): Promise<ImportResult> {
  const endpoint = SAP_ENDPOINTS[bizObjectId]

  if (!endpoint) {
    return {
      mode: 'import', status: 'failed',
      totalRecords: 0, successCount: 0, failedCount: 0,
      errors: [{ row: 0, field: 'Business Object', message: `No SAP endpoint for "${bizObjectId}"` }],
      timestamp: new Date().toISOString(),
    }
  }

  const groups = groupDocuments(docFile.rows, linesFile.rows, mappings)
  const total  = groups.length

  // ── cancel_rollback: sequential so we can stop + rollback immediately ─────
  if (errorHandling === 'cancel_rollback') {
    return runSapImportSequential(endpoint, groups, mappings, sessionId, total, onProgress, copyFrom)
  }

  // ── ignore_all / ignore_up_to_10: parallel with concurrency limit ─────────
  const CONCURRENCY = 5

  const errors: ImportResult['errors'] = []
  const lastDocNums: (string | undefined)[] = new Array(total).fill(undefined)
  let completed = 0

  // Shared mutable counters — updated atomically (JS is single-threaded so safe)
  let successCount = 0
  let stopped = false

  const tasks = groups.map(({ docRow, lineRows }, i) => async () => {
    if (stopped) return

    const { payload, docNum } = buildPayload(docRow, lineRows, mappings, copyFrom)

    try {
      let resultDocNum: string | undefined

      if (docNum !== null) {
        const existingEntry = await findDocEntry(endpoint, docNum, sessionId)
        if (existingEntry !== null) {
          const patchBody = { ...payload }
          delete patchBody['DocNum']
          delete patchBody['Handwritten']
          await sapPatch(endpoint, existingEntry, patchBody, sessionId)
          resultDocNum = String(docNum)
        } else {
          const result = await sapPost<{ DocEntry?: number; DocNum?: number }>(endpoint, payload, sessionId)
          resultDocNum = result.DocNum !== undefined ? String(result.DocNum) : String(docNum)
        }
      } else {
        const result = await sapPost<{ DocEntry?: number; DocNum?: number }>(endpoint, payload, sessionId)
        resultDocNum = result.DocNum !== undefined ? String(result.DocNum) : undefined
      }

      successCount++
      lastDocNums[i] = resultDocNum

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown SAP error'
      errors.push({ row: i + 1, field: 'Document', message })
      console.error(`[SAP] Error on document ${i + 1}:`, message)

      if (errorHandling === 'ignore_up_to_10' && errors.length >= 10) {
        stopped = true
        console.log('[SAP] Reached 10 errors — stopping import')
      }
    } finally {
      completed++
      onProgress({
        current: completed, total,
        phase: 'importing',
        action: `Processed ${completed} of ${total} document(s)`,
        successCount,
        failedCount: errors.length,
      })
    }
  })

  onProgress({ current: 0, total, phase: 'importing', action: `Importing ${total} document(s) in parallel…`, successCount: 0, failedCount: 0 })
  await runWithConcurrency(tasks, CONCURRENCY)

  const lastDocNum = [...lastDocNums].reverse().find(v => v !== undefined)
  const status: ImportResult['status'] =
    errors.length === 0 ? 'success' : successCount === 0 ? 'failed' : 'partial'

  return {
    mode: 'import', status,
    totalRecords: total,
    successCount,
    failedCount: total - successCount,
    errors,
    sapReference: lastDocNum,
    timestamp: new Date().toISOString(),
  }
}

/** Sequential processor used by cancel_rollback mode. */
async function runSapImportSequential(
  endpoint: string,
  groups: Array<{ docRow: Record<string, unknown>; lineRows: Record<string, unknown>[] }>,
  mappings: MappingRow[],
  sessionId: string,
  total: number,
  onProgress: ProgressCallback,
  copyFrom?: CopyFromState | null,
): Promise<ImportResult> {
  const errors: ImportResult['errors'] = []
  const createdDocEntries: number[] = []
  let successCount = 0
  let lastDocNum: string | undefined

  for (let i = 0; i < groups.length; i++) {
    const { docRow, lineRows } = groups[i]
    const { payload, docNum } = buildPayload(docRow, lineRows, mappings, copyFrom)

    onProgress({
      current: i + 1, total,
      phase: 'importing',
      action: `Processing document ${i + 1} of ${total}`,
      successCount,
      failedCount: errors.length,
    })

    try {
      let resultDocNum: string | undefined

      if (docNum !== null) {
        const existingEntry = await findDocEntry(endpoint, docNum, sessionId)
        if (existingEntry !== null) {
          const patchBody = { ...payload }
          delete patchBody['DocNum']
          delete patchBody['Handwritten']
          await sapPatch(endpoint, existingEntry, patchBody, sessionId)
          resultDocNum = String(docNum)
        } else {
          const result = await sapPost<{ DocEntry?: number; DocNum?: number }>(endpoint, payload, sessionId)
          if (result.DocEntry) createdDocEntries.push(result.DocEntry)
          resultDocNum = result.DocNum !== undefined ? String(result.DocNum) : String(docNum)
        }
      } else {
        const result = await sapPost<{ DocEntry?: number; DocNum?: number }>(endpoint, payload, sessionId)
        if (result.DocEntry) createdDocEntries.push(result.DocEntry)
        resultDocNum = result.DocNum !== undefined ? String(result.DocNum) : undefined
      }

      successCount++
      if (resultDocNum) lastDocNum = resultDocNum

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown SAP error'
      errors.push({ row: i + 1, field: 'Document', message })
      console.error(`[SAP] Error on document ${i + 1}:`, message)

      // Rollback all created docs then stop
      if (createdDocEntries.length > 0) {
        onProgress({
          current: i + 1, total,
          phase: 'rolling_back',
          action: `Rolling back ${createdDocEntries.length} document(s)…`,
          successCount, failedCount: errors.length,
        })
        await Promise.all(createdDocEntries.map(entry => sapCancel(endpoint, entry, sessionId)))
        successCount = 0
      }
      break
    }
  }

  const status: ImportResult['status'] = errors.length > 0 ? 'failed' : 'success'

  return {
    mode: 'import', status,
    totalRecords: total,
    successCount,
    failedCount: total - successCount,
    errors,
    sapReference: lastDocNum,
    timestamp: new Date().toISOString(),
  }
}
