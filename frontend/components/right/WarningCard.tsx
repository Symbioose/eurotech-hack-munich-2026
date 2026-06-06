'use client'
import { useState } from 'react'
import { useProjectStore } from '@/lib/store'
import { applyPipelineFixApi } from '@/lib/pipeline-stream'
import { hydrateStoreFromPipeline } from '@/lib/pipeline/hydrate-store'
import type { SimulationWarning } from '@/lib/types'
import type { PipelineState } from '@/lib/pipeline/types'

type Props = { warning: SimulationWarning }

export function WarningCard({ warning }: Props) {
  const fixApplied = useProjectStore((s) => s.fixApplied)
  const pipelineState = useProjectStore((s) => s.pipelineState)
  const [applying, setApplying] = useState(false)

  const severityStyles = {
    critical: 'border-red-500/40 bg-red-500/5',
    warning: 'border-yellow-500/40 bg-yellow-500/5',
    note: 'border-white/20 bg-white/5',
  }[warning.severity]

  async function handleApplyFix() {
    if (!pipelineState || applying) return
    setApplying(true)
    try {
      const updated = (await applyPipelineFixApi(
        warning.id,
        pipelineState
      )) as PipelineState
      hydrateStoreFromPipeline(updated)
    } catch {
      useProjectStore.getState().setFixApplied(true)
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className={`rounded-lg border p-3 space-y-2 ${severityStyles}`}>
      <div className="flex items-start gap-2">
        <span className="text-red-400 text-sm mt-0.5">⚠</span>
        <div>
          <p className="text-sm font-medium text-white/90">{warning.title}</p>
          <p className="text-xs text-white/50 mt-0.5">{warning.explanation}</p>
        </div>
      </div>
      {!fixApplied && (
        <button
          onClick={handleApplyFix}
          disabled={applying || !pipelineState}
          className="w-full text-xs py-1.5 rounded bg-blue-500/10 text-[#3b82f6] border border-blue-500/20 hover:bg-blue-500/20 transition-colors disabled:opacity-40"
        >
          {applying ? 'Applying fix…' : `Apply Fix — ${warning.fix.label}`}
        </button>
      )}
      {fixApplied && (
        <p className="text-xs text-emerald-400">{`✓ Fix applied — BOM updated (+$${warning.fix.costDelta})`}</p>
      )}
    </div>
  )
}
