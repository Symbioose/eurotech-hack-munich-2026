'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const DEMO_PROMPT =
  'A 52-year-old Hong Kong residential building needs a low-maintenance facade sensor node that monitors crack propagation, vibration anomalies, tilt shifts and moisture ingress, and creates early warnings before the next Mandatory Building Inspection.'

type Props = {
  projectId: string
}

export function ContextEntryForm({ projectId }: Props) {
  const router = useRouter()
  const [prompt, setPrompt] = useState('')
  const [error, setError] = useState('')

  function handleSubmit() {
    const text = prompt.trim()
    if (!text) {
      setError('Describe your urban problem before continuing.')
      return
    }
    setError('')
    sessionStorage.setItem(`pc_prompt_${projectId}`, text)
    router.push(`/project/${projectId}/workspace`)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="flex flex-col h-screen bg-[#f5f4f0] overflow-hidden">
      {/* Wordmark */}
      <div className="px-8 pt-8 shrink-0">
        <span className="text-sm font-medium text-[#111] tracking-tight">Physical Cursor</span>
      </div>

      {/* Centered content */}
      <main className="flex-1 flex items-center justify-center px-8">
        <div className="w-full max-w-2xl">
          <h1 className="text-3xl font-light text-[#111] mb-8 leading-tight">
            Describe your smart city problem.
          </h1>

          <textarea
            value={prompt}
            onChange={(e) => {
              setPrompt(e.target.value)
              if (error) setError('')
            }}
            onKeyDown={handleKeyDown}
            placeholder="A 52-year-old Hong Kong residential building needs a facade sensor node that monitors structural changes between mandatory inspections…"
            rows={5}
            className="w-full bg-transparent border-0 border-b border-[#e0dfd8] text-base text-[#111] placeholder:text-[#bbb] py-3 resize-none focus:outline-none focus:border-[#888] transition-colors leading-relaxed"
            autoFocus
          />

          {error && <p className="text-xs text-[#888] mt-3">{error}</p>}

          <div className="flex items-center justify-between mt-6">
            <button
              type="button"
              onClick={() => setPrompt(DEMO_PROMPT)}
              className="text-xs text-[#bbb] hover:text-[#888] transition-colors"
            >
              Use demo prompt →
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!prompt.trim()}
              className="text-sm px-6 py-2.5 rounded bg-[#111] text-white hover:bg-[#333] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Generate →
            </button>
          </div>

          <p className="text-[10px] text-[#bbb] mt-4">Cmd+Enter to continue</p>
        </div>
      </main>
    </div>
  )
}
