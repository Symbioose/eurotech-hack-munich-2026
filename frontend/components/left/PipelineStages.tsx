'use client'
import { useProjectStore } from '@/lib/store'

const STAGES = [
  { key: 'context', label: 'Context Agent' },
  { key: 'components', label: 'Component Agent' },
  { key: 'bom', label: 'BOM Resolver' },
  { key: 'dfma', label: 'DFMA Engine' },
  { key: 'rfq', label: 'RFQ Agent' },
  { key: 'scene', label: 'Scene Resolver' },
] as const

export function PipelineStages() {
  const pipelineStage = useProjectStore((s) => s.pipelineStage)
  const usedDeterministic = useProjectStore((s) => s.usedDeterministic)
  const isStreaming = useProjectStore((s) => s.isStreaming)

  if (!isStreaming && !pipelineStage && !usedDeterministic) return null

  const activeIndex = STAGES.findIndex((s) => s.key === pipelineStage)
  const complete = pipelineStage === 'complete'

  return (
    <div className="space-y-1">
      <p className="text-[10px] uppercase tracking-widest text-white/30 mb-2">Pipeline</p>
      {STAGES.map((stage, i) => {
        const isDone = complete || (activeIndex >= 0 && i < activeIndex)
        const isActive = stage.key === pipelineStage
        return (
          <div
            key={stage.key}
            className={`flex items-center gap-2 text-[10px] ${
              isActive ? 'text-[#3b82f6]' : isDone ? 'text-white/50' : 'text-white/20'
            }`}
          >
            <div
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                isActive ? 'bg-[#3b82f6]' : isDone ? 'bg-white/40' : 'bg-white/10'
              }`}
            />
            <span>{stage.label}</span>
            {isActive && <span className="text-white/30 animate-pulse">…</span>}
          </div>
        )
      })}
      {usedDeterministic && (
        <p className="text-[10px] text-amber-400/80 mt-1">Deterministic pipeline (no LLM)</p>
      )}
    </div>
  )
}
