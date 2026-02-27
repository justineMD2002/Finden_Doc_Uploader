import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Server, Eye, EyeOff, AlertCircle } from 'lucide-react'
import type { Database } from '@/types/document'
import { saveCustomDatabase } from '@/lib/databases'
import { ENV_STYLES } from '@/lib/databases'
import { generateId } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface Props {
  onClose: () => void
  onAdded: (db: Database) => void
}

const ENVIRONMENTS: Database['environment'][] = ['Production', 'Staging', 'Development']

const FIELD_HINTS: Record<string, string> = {
  systemId: 'e.g. PRD, DEV, QAS — the 3-letter SAP System ID',
  instanceNumber: 'e.g. 00, 01 — usually 2 digits',
  client: 'e.g. 100, 200 — 3-digit SAP client number',
  host: 'Hostname or IP address of the SAP application server',
}

export default function AddDatabaseModal({ onClose, onAdded }: Props) {
  const [form, setForm] = useState({
    name: '',
    description: '',
    environment: 'Production' as Database['environment'],
    host: '',
    systemId: '',
    instanceNumber: '',
    client: '',
    username: '',
    password: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<Partial<typeof form>>({})

  function set(field: keyof typeof form, value: string) {
    setForm(f => ({ ...f, [field]: value }))
    setErrors(e => ({ ...e, [field]: undefined }))
  }

  function validate(): boolean {
    const e: Partial<typeof form> = {}
    if (!form.name.trim()) e.name = 'Required'
    if (!form.host.trim()) e.host = 'Required'
    if (!form.systemId.trim()) e.systemId = 'Required'
    if (!/^\d{2}$/.test(form.instanceNumber.trim())) e.instanceNumber = 'Must be 2 digits (e.g. 00)'
    if (!/^\d{3}$/.test(form.client.trim())) e.client = 'Must be 3 digits (e.g. 100)'
    if (!form.username.trim()) e.username = 'Required'
    if (!form.password.trim()) e.password = 'Required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    const db: Database = {
      id: `custom-${generateId()}`,
      name: form.name.trim(),
      description: form.description.trim() || `${form.systemId} · Client ${form.client} · ${form.host}`,
      environment: form.environment,
      host: form.host.trim(),
      systemId: form.systemId.trim().toUpperCase(),
      instanceNumber: form.instanceNumber.trim(),
      client: form.client.trim(),
      username: form.username.trim(),
      password: form.password,
      isCustom: true,
    }

    saveCustomDatabase(db)
    onAdded(db)
    onClose()
  }

  return createPortal(
    <div className="fixed inset-0 z-50">
      {/* Backdrop — independent fixed layer so blur covers the full viewport */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Centering wrapper */}
      <div className="relative flex items-center justify-center min-h-full p-4 pointer-events-none">
      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden pointer-events-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center">
              <Server className="w-4 h-4 text-brand-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Add SAP Database</h2>
              <p className="text-xs text-gray-400">Connection details are stored locally</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 max-h-[75vh] overflow-y-auto">

          {/* Display name */}
          <Field label="Display Name" required error={errors.name}>
            <input
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="e.g. SAP ERP — Thailand"
              className={inputCls(!!errors.name)}
            />
          </Field>

          {/* Description */}
          <Field label="Description">
            <input
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="Short description (optional)"
              className={inputCls(false)}
            />
          </Field>

          {/* Environment */}
          <Field label="Environment" required>
            <div className="flex gap-2">
              {ENVIRONMENTS.map(env => (
                <button
                  key={env}
                  type="button"
                  onClick={() => set('environment', env)}
                  className={cn(
                    'flex-1 py-2 rounded-lg text-xs font-semibold border transition-all',
                    form.environment === env
                      ? cn(ENV_STYLES[env], 'border-current')
                      : 'border-gray-200 text-gray-400 hover:border-gray-300'
                  )}
                >
                  {env}
                </button>
              ))}
            </div>
          </Field>

          <div className="border-t border-gray-100 pt-1">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">SAP Connection</p>

            {/* Host */}
            <div className="space-y-3">
              <Field label="Host / IP Address" required hint={FIELD_HINTS.host} error={errors.host}>
                <input
                  value={form.host}
                  onChange={e => set('host', e.target.value)}
                  placeholder="sap-host.company.com"
                  className={inputCls(!!errors.host)}
                />
              </Field>

              <div className="grid grid-cols-3 gap-3">
                <Field label="System ID (SID)" required hint={FIELD_HINTS.systemId} error={errors.systemId}>
                  <input
                    value={form.systemId}
                    onChange={e => set('systemId', e.target.value.toUpperCase())}
                    placeholder="PRD"
                    maxLength={3}
                    className={cn(inputCls(!!errors.systemId), 'uppercase font-mono tracking-widest')}
                  />
                </Field>
                <Field label="Instance No." required hint={FIELD_HINTS.instanceNumber} error={errors.instanceNumber}>
                  <input
                    value={form.instanceNumber}
                    onChange={e => set('instanceNumber', e.target.value)}
                    placeholder="00"
                    maxLength={2}
                    className={cn(inputCls(!!errors.instanceNumber), 'font-mono')}
                  />
                </Field>
                <Field label="Client" required hint={FIELD_HINTS.client} error={errors.client}>
                  <input
                    value={form.client}
                    onChange={e => set('client', e.target.value)}
                    placeholder="100"
                    maxLength={3}
                    className={cn(inputCls(!!errors.client), 'font-mono')}
                  />
                </Field>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-1">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Credentials</p>
            <div className="space-y-3">
              <Field label="SAP Username" required error={errors.username}>
                <input
                  value={form.username}
                  onChange={e => set('username', e.target.value)}
                  placeholder="SAPUSER"
                  autoComplete="off"
                  className={inputCls(!!errors.username)}
                />
              </Field>
              <Field label="Password" required error={errors.password}>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={e => set('password', e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    className={cn(inputCls(!!errors.password), 'pr-10')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </Field>
            </div>
          </div>

          {/* Disclaimer */}
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5">
            <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              Credentials are stored in your browser's local storage and are not sent to any server. This is a mock interface for demonstration purposes.
            </p>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-5 py-2 text-sm font-semibold bg-brand-600 hover:bg-brand-700 text-white rounded-xl transition-colors shadow-sm"
          >
            Add Database
          </button>
        </div>
      </div>
      </div>
    </div>,
    document.body
  )
}

function inputCls(hasError: boolean) {
  return cn(
    'w-full px-3 py-2 text-sm border rounded-xl bg-white focus:outline-none focus:ring-2 transition-all',
    hasError
      ? 'border-red-300 focus:ring-red-400'
      : 'border-gray-200 focus:ring-brand-500 focus:border-brand-400'
  )
}

function Field({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <label className="flex items-center gap-1 text-xs font-medium text-gray-700">
        {label}
        {required && <span className="text-red-400">*</span>}
      </label>
      {children}
      {error
        ? <p className="text-xs text-red-500">{error}</p>
        : hint && <p className="text-xs text-gray-400">{hint}</p>
      }
    </div>
  )
}
