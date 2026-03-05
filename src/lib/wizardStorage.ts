/**
 * Wizard draft persistence — saves/restores wizard state to localStorage.
 *
 * The raw `File` object cannot be serialized, so we store only the parsed
 * data (rows, columns, rowCount, fileName). On restore, a placeholder File
 * is created so the filename still displays correctly in the UI.
 */

import type {
  BizObject, MappingRow, ErrorHandlingMode, WizardStep,
} from '@/types/wizard'

const DRAFT_KEY = 'finden_wizard_draft'

// ─── Serialisable file shape (no File object) ──────────────────────────────

interface StoredFile {
  fileName: string
  columns: string[]
  rowCount: number
  rows: Record<string, unknown>[]
}

// ─── Draft shape ───────────────────────────────────────────────────────────

export interface WizardDraft {
  step: WizardStep
  bizObject: BizObject | null
  docFileData: StoredFile | null
  linesFileData: StoredFile | null
  mappings: MappingRow[]
  errorHandling: ErrorHandlingMode
  savedAt: string  // ISO timestamp — shown in UI if desired
}

// ─── Save ──────────────────────────────────────────────────────────────────

export function saveWizardDraft(draft: Omit<WizardDraft, 'savedAt'>): void {
  const payload: WizardDraft = { ...draft, savedAt: new Date().toISOString() }
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(payload))
  } catch {
    // localStorage quota exceeded — silently ignore
  }
}

// ─── Load ──────────────────────────────────────────────────────────────────

export function loadWizardDraft(): WizardDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    return JSON.parse(raw) as WizardDraft
  } catch {
    return null
  }
}

// ─── Clear ─────────────────────────────────────────────────────────────────

export function clearWizardDraft(): void {
  localStorage.removeItem(DRAFT_KEY)
}

// ─── Helper: StoredFile → UploadedFile ─────────────────────────────────────

/**
 * Reconstruct an UploadedFile from stored data.
 * The `file` property will be an empty placeholder File so `.name` works.
 */
export function storedFileToUploaded(stored: StoredFile) {
  return {
    file: new File([], stored.fileName),
    columns: stored.columns,
    rowCount: stored.rowCount,
    rows: stored.rows,
  }
}

// ─── Helper: UploadedFile → StoredFile ─────────────────────────────────────

export function uploadedFileToStored(uploaded: {
  file: File
  columns: string[]
  rowCount: number
  rows: Record<string, unknown>[]
}): StoredFile {
  return {
    fileName: uploaded.file.name,
    columns: uploaded.columns,
    rowCount: uploaded.rowCount,
    rows: uploaded.rows,
  }
}
