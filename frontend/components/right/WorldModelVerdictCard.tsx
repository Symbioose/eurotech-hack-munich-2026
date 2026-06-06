'use client'
import type { WorldModelVerdict } from '@/lib/types'

type Props = {
  verdict: WorldModelVerdict
}

function percent(value: number) {
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`
}

function formatAction(action: string) {
  return action.replace(/_/g, ' ')
}

export function WorldModelVerdictCard({ verdict }: Props) {
  const action = verdict.recommendedAction
  const canApply = action.kind !== 'none'
  const severityClass = verdict.severity === 'critical'
    ? 'border-red-400/35 bg-red-400/[0.06]'
    : verdict.severity === 'warning'
      ? 'border-amber-400/35 bg-amber-400/[0.06]'
      : 'border-emerald-400/25 bg-emerald-400/[0.05]'

  function handleApply() {
    if (!canApply) return
    window.dispatchEvent(
      new CustomEvent('physical-cursor:chat-action', {
        detail: { action: 'apply-world-model-fix', verdict },
      })
    )
  }

  return (
    <div className={`rounded-lg border p-3 ${severityClass}`}>
      <p className="text-[10px] uppercase tracking-widest text-white/35">World Model Agent</p>
      <p className="mt-1 text-sm font-medium text-white/90">{verdict.title}</p>
      <p className="mt-1 text-xs text-white/55">{verdict.summary}</p>

      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
        <div className="rounded-md border border-white/[0.06] bg-black/10 px-2 py-1.5">
          <p className="text-white/30">Peak device risk</p>
          <p className="font-mono text-white/80">{percent(verdict.evidence.peakDeviceRisk)}</p>
        </div>
        <div className="rounded-md border border-white/[0.06] bg-black/10 px-2 py-1.5">
          <p className="text-white/30">Peak week</p>
          <p className="font-mono text-white/80">{verdict.evidence.peakWeek}</p>
        </div>
      </div>

      <p className="mt-2 text-[11px] text-white/45">
        Peak device risk: {percent(verdict.evidence.peakDeviceRisk)}
        {' · '}
        Highest component: <span className="text-white/70">{verdict.evidence.peakComponentId ?? 'none'}</span>
        {' · '}
        Trigger: <span className="text-white/70">{formatAction(verdict.evidence.triggerAction)}</span>
      </p>
      <p className="mt-2 text-xs leading-relaxed text-white/55">{verdict.rootCause}</p>

      {canApply ? (
        <button
          type="button"
          onClick={handleApply}
          className="mt-3 w-full rounded-md border border-blue-400/25 bg-blue-400/10 px-3 py-2 text-xs font-medium text-blue-200 transition-colors hover:bg-blue-400/15"
        >
          {action.label}
        </button>
      ) : (
        <p className="mt-3 text-xs text-emerald-300/75">{action.explanation}</p>
      )}
    </div>
  )
}
