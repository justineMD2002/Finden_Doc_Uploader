import { useCallback, useState } from 'react'
import { UploadCloud, FileSpreadsheet, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FileDropzoneProps {
  onFileSelect: (file: File) => void
  selectedFile: File | null
  onClear: () => void
  disabled?: boolean
}

const isValidFile = (file: File): boolean => {
  return (
    file.name.endsWith('.xlsx') ||
    file.name.endsWith('.xls') ||
    file.name.endsWith('.csv')
  )
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const FileDropzone = ({ onFileSelect, selectedFile, onClear, disabled }: FileDropzoneProps) => {
  const [isDragging, setIsDragging] = useState(false)

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (disabled) return
    const file = e.dataTransfer.files[0]
    if (file && isValidFile(file)) onFileSelect(file)
  }, [onFileSelect, disabled])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (!disabled) setIsDragging(true)
  }, [disabled])

  const handleDragLeave = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && isValidFile(file)) onFileSelect(file)
    e.target.value = ''
  }

  if (selectedFile) {
    return (
      <div className="border-2 border-brand-200 rounded-xl bg-brand-50/50 p-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-brand-100 flex items-center justify-center flex-shrink-0">
            <FileSpreadsheet className="w-6 h-6 text-brand-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{selectedFile.name}</p>
            <p className="text-xs text-gray-500 mt-0.5">{formatFileSize(selectedFile.size)}</p>
          </div>
          {!disabled && (
            <button
              onClick={onClear}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <label
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={cn(
        'flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-xl p-12 cursor-pointer transition-all duration-200',
        isDragging
          ? 'border-brand-400 bg-brand-50 scale-[1.01]'
          : 'border-gray-200 bg-white hover:border-brand-300 hover:bg-brand-50/30',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      <div className={cn(
        'w-14 h-14 rounded-2xl flex items-center justify-center transition-colors',
        isDragging ? 'bg-brand-100' : 'bg-gray-100'
      )}>
        <UploadCloud className={cn('w-7 h-7 transition-colors', isDragging ? 'text-brand-600' : 'text-gray-400')} />
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-gray-700">
          {isDragging ? 'Drop your file here' : 'Drag & drop your file here'}
        </p>
        <p className="text-xs text-gray-400 mt-1">or click to browse</p>
        <p className="text-xs text-gray-400 mt-2">Supports <span className="font-medium text-gray-600">.xlsx</span>, <span className="font-medium text-gray-600">.xls</span>, <span className="font-medium text-gray-600">.csv</span></p>
      </div>
      <input
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={handleInput}
        disabled={disabled}
      />
    </label>
  )
}

export default FileDropzone
