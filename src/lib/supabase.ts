import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ─── Types matching the import_logs table ─────────────────────────────────

export interface ImportLogRow {
  id?: string
  user_id: string
  user_name: string
  user_email: string
  biz_object_id: string
  biz_object_label: string
  doc_filename: string | null
  lines_filename: string | null
  mode: 'test' | 'import'
  status: 'success' | 'failed' | 'partial'
  total_records: number
  success_count: number
  failed_count: number
  sap_reference: string | null
  errors: { row: number; field: string; message: string }[]
  mappings: { sourceField: string; targetField: string; tab: 'doc' | 'lines' }[] | null
  error_handling: string | null
  created_at?: string
}

export const insertImportLog = async (log: Omit<ImportLogRow, 'id' | 'created_at'>): Promise<void> => {
  const { error } = await supabase.from('import_logs').insert(log)
  if (error) throw error
}

export const fetchImportLogs = async (userEmail?: string): Promise<ImportLogRow[]> => {
  let query = supabase
    .from('import_logs')
    .select('*')
    .order('created_at', { ascending: false })

  if (userEmail) {
    query = query.eq('user_email', userEmail)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as ImportLogRow[]
}
