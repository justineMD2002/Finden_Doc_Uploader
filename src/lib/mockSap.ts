import type { UploadLog, ValidationError } from '@/types/document'
import { generateId } from '@/lib/utils'

const LOGS_KEY = 'pixelcare_upload_logs'

export const getLogs = (): UploadLog[] => {
  const raw = localStorage.getItem(LOGS_KEY)
  if (!raw) return []
  try {
    return JSON.parse(raw) as UploadLog[]
  } catch {
    return []
  }
}

const saveLogs = (logs: UploadLog[]) => {
  localStorage.setItem(LOGS_KEY, JSON.stringify(logs))
}

export const submitToSAP = async (
  rows: Record<string, unknown>[],
  errors: ValidationError[],
  filename: string,
  uploadedBy: string,
  databaseId?: string,
  databaseName?: string,
  module?: string,
): Promise<UploadLog> => {
  // Simulate network delay
  await new Promise(res => setTimeout(res, 1800))

  const hasErrors = errors.length > 0
  // Simulate random SAP-side failures for demo
  const sapFailed = !hasErrors && Math.random() < 0.05

  let status: UploadLog['status']
  let successCount = rows.length
  let failedCount = 0
  let sapReference: string | undefined

  if (hasErrors) {
    status = errors.length === rows.length ? 'FAILED' : 'PARTIAL'
    failedCount = errors.length
    successCount = rows.length - failedCount
  } else if (sapFailed) {
    status = 'FAILED'
    successCount = 0
    failedCount = rows.length
  } else {
    status = 'SUCCESS'
    sapReference = `SAP-${Date.now().toString(36).toUpperCase()}`
  }

  const log: UploadLog = {
    id: generateId(),
    filename,
    uploadedBy,
    uploadedAt: new Date().toISOString(),
    rowCount: rows.length,
    successCount,
    failedCount,
    status,
    sapReference,
    errors,
    databaseId,
    databaseName,
    module,
  }

  const existing = getLogs()
  saveLogs([log, ...existing])

  return log
}
