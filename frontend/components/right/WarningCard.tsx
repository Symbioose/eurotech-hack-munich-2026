'use client'
import { useState } from 'react'
import { useProjectStore } from '@/lib/store'
import { applyPipelineFixApi } from '@/lib/pipeline-stream'
import { hydrateStoreFromPipeline } from '@/lib/pipeline/hydrate-store'
import { saveCurrentProjectSnapshot } from '@/lib/project-storage'
import type { SimulationWarning } from '@/lib/types'
import type { PipelineState } from '@/lib/pipeline/types'

type Props = { warning: SimulationWarning }

export function WarningCard({ warning }: Props) {
  const fixApplied = useProjectStore((s) => s.fixApplied)
  const pipelineState = useProjectStore((s) => s.pipelineState)
  const upsertToolCallMessage = useProjectStore((s) => s.upsertToolCallMessage)
  const setConversationState = useProjectStore((s) => s.setConversationState)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const severityStyles = {
    critical: 'border-red-500/40 bg-red-500/5',
    warning: 'border-yellow-500/40 bg-yellow-500/5',
    note: 'border-white/20 bg-white/5',
  }[warning.severity]

  const headline = {
    critical: 'Critical DfMA review required',
    warning: 'DfMA risk flagged for review',
    note: 'Design note',
  }[warning.severity]

  const headlineColor = {
    critical: 'text-red-400',
    warning: 'text-yellow-400',
    note: 'text-white/60',
  }[warning.severity]

  async function handleApplyFix() {
    if (!pipelineState || applying) return
    const startedAt = Date.now()
    const toolCallId = `fix-${warning.id}-${startedAt}`
    setApplying(true)
    setError(null)
    setConversationState('applying_fix')
    upsertToolCallMessage({
      id: toolCallId,
      server: 'orchestrator',
      tool: 'apply_dfma_fix',
      title: 'Apply DfMA fix',
      status: 'running',
      input: warning.fix.label,
      startedAt,
    })
    try {
      const updated = (await applyPipelineFixApi(
        warning.id,
        pipelineState
      )) as PipelineState
      hydrateStoreFromPipeline(updated)
      const projectId = window.location.pathname.match(/\/project\/([^/]+)/)?.[1]
      if (projectId) saveCurrentProjectSnapshot(projectId)
      setConversationState('complete')
      upsertToolCallMessage({
        id: toolCallId,
        server: 'orchestrator',
        tool: 'apply_dfma_fix',
        title: 'Apply DfMA fix',
        status: 'completed',
        output: `BOM updated (+$${warning.fix.costDelta}). RFQ and scene graph regenerated.`,
        startedAt,
        completedAt: Date.now(),
      })
    } catch {
      setError('Apply fix failed. The current BOM was not changed.')
      setConversationState('awaiting_risk_decision')
      upsertToolCallMessage({
        id: toolCallId,
        server: 'orchestrator',
        tool: 'apply_dfma_fix',
        title: 'Apply DfMA fix',
        status: 'error',
        output: 'Apply fix request failed.',
        startedAt,
        completedAt: Date.now(),
      })
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className={`rounded-lg border p-3 space-y-2 ${severityStyles}`}>
      <p className={`text-[10px] uppercase tracking-widest font-semibold ${headlineColor}`}>
        {warning.severity === 'critical' ? '⛔ ' : '⚠ '}
        {headline}
      </p>
      <div className="flex items-start gap-2">
        <div>
          <p className="text-sm font-medium text-white/90">{warning.title}</p>
          <p className="text-xs text-white/50 mt-0.5">{warning.explanation}</p>
          {warning.severity === 'critical' && (
            <p className="text-[11px] text-red-300/70 mt-1">
              This is a rule-based manufacturability risk, not a certified failure prediction.
              Review the fix before treating the design as production-ready.
            </p>
          )}
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
      {error && <p className="text-xs text-red-300/80">{error}</p>}
    </div>
  )
}
