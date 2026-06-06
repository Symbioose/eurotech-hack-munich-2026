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
    <div className="rounded-lg border border-[#e0dfd8] bg-[#f5f4f0] p-3 space-y-2">
      <div className="flex items-start gap-2">
        <span className="text-[#111] text-sm mt-0.5">⚠</span>
        <div>
          <p className="text-sm font-medium text-[#111]">{warning.title}</p>
          <p className="text-xs text-[#888] mt-0.5">{warning.explanation}</p>
        </div>
      </div>
      {!fixApplied && (
        <button
          onClick={handleApplyFix}
          disabled={applying || !pipelineState}
          className="w-full text-xs py-1.5 rounded bg-[#111] text-white hover:bg-[#333] transition-colors disabled:opacity-40"
        >
          {applying ? 'Applying fix…' : `Apply Fix — ${warning.fix.label}`}
        </button>
      )}
      {fixApplied && (
        <p className="text-xs text-[#111] font-medium">{`✓ Fix applied — BOM updated (+$${warning.fix.costDelta})`}</p>
      )}
    </div>
  )
}
