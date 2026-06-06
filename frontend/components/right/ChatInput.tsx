'use client'
import { useRef, useState } from 'react'
import { useProjectStore } from '@/lib/store'

type Props = {
  onSend: (content: string, files?: File[]) => void
  disabled?: boolean
}

export function ChatInput({ onSend, disabled }: Props) {
  const [value, setValue] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const isStreaming = useProjectStore((s) => s.isStreaming)

  function handleSend() {
    const text = value.trim()
    if (!text && files.length === 0) return
    onSend(text, files)
    setValue('')
    setFiles([])
    if (fileRef.current) fileRef.current.value = ''
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="p-3 border-t border-white/[0.06]">
      {files.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {files.map((f) => (
            <span key={f.name} className="text-[10px] bg-white/[0.05] text-white/50 px-2 py-0.5 rounded border border-white/[0.08]">
              📎 {f.name}
            </span>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2">
        <button
          onClick={() => fileRef.current?.click()}
          className="text-white/30 hover:text-white/60 transition-colors pb-1.5 shrink-0"
          title="Upload file"
          type="button"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
          </svg>
        </button>
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          multiple
          accept=".pdf,.png,.jpg,.jpeg,.docx"
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
        />
        <textarea
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            e.target.style.height = 'auto'
            e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
          }}
          onKeyDown={handleKeyDown}
          placeholder="Describe a product, or ask to add / remove a part..."
          disabled={disabled || isStreaming}
          rows={1}
          className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded text-sm text-white/90 placeholder:text-white/25 px-3 py-2 resize-none focus:outline-none focus:border-white/20 transition-colors"
          style={{ minHeight: '38px' }}
        />
        <button
          onClick={handleSend}
          disabled={disabled || isStreaming || (!value.trim() && files.length === 0)}
          className="text-[#3b82f6] hover:text-blue-400 transition-colors pb-1.5 disabled:opacity-30 shrink-0"
          type="button"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z"/>
          </svg>
        </button>
      </div>
      {isStreaming && (
        <p className="text-[10px] text-white/30 mt-1 text-center animate-pulse">Generating...</p>
      )}
    </div>
  )
}
