'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { Header } from '@/components/ui/Header'

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
    <div className="flex flex-col h-screen">
      <Header />
      <main className="flex-1 flex items-center justify-center p-6 overflow-auto">
        <div className="w-full max-w-2xl space-y-6">
          <div className="text-center space-y-2">
            <p className="text-[10px] uppercase tracking-widest text-white/30">Step 1 of 2</p>
            <h1 className="text-xl font-medium text-white/90">Describe the product you want to build</h1>
            <p className="text-sm text-white/40 max-w-lg mx-auto leading-relaxed">
              Physical Cursor will read the brief, select parts from the catalog (proposing
              unverified parts when needed), validate risks and build a supplier route.
            </p>
          </div>

          <GlassPanel className="p-5 space-y-4">
            <label className="block">
              <span className="text-[10px] uppercase tracking-widest text-white/30 mb-2 block">
                Deployment context
              </span>
              <textarea
                value={prompt}
                onChange={(e) => {
                  setPrompt(e.target.value)
                  if (error) setError('')
                }}
                onKeyDown={handleKeyDown}
                placeholder="e.g. A 52-year-old Hong Kong residential building needs a facade sensor node that monitors structural changes between mandatory inspections…"
                rows={8}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white/90 placeholder:text-white/25 px-4 py-3 resize-none focus:outline-none focus:border-[#3b82f6]/40 transition-colors leading-relaxed"
                autoFocus
              />
            </label>

            {error && <p className="text-xs text-red-400">{error}</p>}

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
              <button
                type="button"
                onClick={() => setPrompt(DEMO_PROMPT)}
                className="text-xs text-white/40 hover:text-white/60 transition-colors text-left"
              >
                Use demo prompt (BuildGuard Node)
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!prompt.trim()}
                className="text-sm px-5 py-2.5 rounded-lg bg-[#3b82f6]/15 text-[#3b82f6] border border-[#3b82f6]/30 hover:bg-[#3b82f6]/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              >
                Generate hardware brief →
              </button>
            </div>

            <p className="text-[10px] text-white/25 text-center">
              Cmd+Enter to continue
            </p>
          </GlassPanel>
        </div>
      </main>
    </div>
  )
}
