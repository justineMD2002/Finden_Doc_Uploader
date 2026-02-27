import type { Database } from '@/types/document'

const CUSTOM_DB_KEY = 'pixelcare_custom_databases'

export const BUILTIN_DATABASES: Database[] = [
  {
    id: 'sap-prod-001',
    name: 'SAP ERP — Production',
    description: 'Main production ERP system',
    environment: 'Production',
  },
  {
    id: 'sap-staging-001',
    name: 'SAP ERP — Staging',
    description: 'Pre-production staging environment',
    environment: 'Staging',
  },
  {
    id: 'sap-dev-001',
    name: 'SAP ERP — Development',
    description: 'Local development & testing',
    environment: 'Development',
  },
  {
    id: 'sap-prod-002',
    name: 'SAP S/4HANA — APAC',
    description: 'Asia-Pacific regional ERP instance',
    environment: 'Production',
  },
  {
    id: 'sap-prod-003',
    name: 'SAP S/4HANA — EMEA',
    description: 'Europe, Middle East & Africa ERP instance',
    environment: 'Production',
  },
]

export const ENV_STYLES: Record<Database['environment'], string> = {
  Production: 'bg-green-100 text-green-700',
  Staging: 'bg-amber-100 text-amber-700',
  Development: 'bg-blue-100 text-blue-700',
}

export function getCustomDatabases(): Database[] {
  const raw = localStorage.getItem(CUSTOM_DB_KEY)
  if (!raw) return []
  try {
    return JSON.parse(raw) as Database[]
  } catch {
    return []
  }
}

export function getAllDatabases(): Database[] {
  return [...BUILTIN_DATABASES, ...getCustomDatabases()]
}

export function saveCustomDatabase(db: Database): void {
  const existing = getCustomDatabases()
  localStorage.setItem(CUSTOM_DB_KEY, JSON.stringify([...existing, db]))
}

export function deleteCustomDatabase(id: string): void {
  const existing = getCustomDatabases().filter(db => db.id !== id)
  localStorage.setItem(CUSTOM_DB_KEY, JSON.stringify(existing))
}
