'use client'
import type { ChatMessage as ChatMessageType } from '@/lib/types'
import { WarningCard } from './WarningCard'
import { WorldModelVerdictCard } from './WorldModelVerdictCard'
import { useProjectStore } from '@/lib/store'

type Props = { message: ChatMessageType }

function formatDuration(startedAt: number, completedAt?: number) {
  const end = completedAt ?? Date.now()
  const ms = Math.max(0, end - startedAt)
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function ToolCallMessage({ message }: Props) {
  const call = message.toolCall
  if (!call) return null

  const statusStyle = {
    running: 'bg-blue-400/80',
    completed: 'bg-emerald-400/75',
    fallback: 'bg-amber-400/85',
    error: 'bg-red-400/80',
  }[call.status]

  const statusLabel = {
    running: 'running',
    completed: 'done',
    fallback: 'fallback',
    error: 'failed',
  }[call.status]

  return (
    <div className="flex justify-start">
      <div className="w-full max-w-[88%] border-l border-white/[0.08] pl-3 py-0.5">
        <div className="flex items-center gap-2 text-[11px] text-white/45 min-w-0">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusStyle}`} />
          <span className="truncate text-white/60">{call.title}</span>
          <span className="shrink-0 text-white/25">{`${call.server}.${call.tool}`}</span>
          <span className="shrink-0 text-white/25">{statusLabel}</span>
          <span className="shrink-0 text-white/20">{formatDuration(call.startedAt, call.completedAt)}</span>
        </div>
        {(call.input || call.output) && (
          <details className="group mt-1">
            <summary className="list-none cursor-pointer text-[10px] text-white/25 hover:text-white/45 transition-colors">
              details
            </summary>
            <div className="mt-1 space-y-1 text-[10px] leading-relaxed text-white/35">
              {call.input && (
                <div>
                  <p className="uppercase tracking-widest text-white/20">Input</p>
                  <pre className="mt-0.5 whitespace-pre-wrap break-words rounded border border-white/[0.06] bg-black/15 px-2 py-1">
                    {call.input}
                  </pre>
                </div>
              )}
              {call.output && (
                <div>
                  <p className="uppercase tracking-widest text-white/20">Result</p>
                  <pre className="mt-0.5 whitespace-pre-wrap break-words rounded border border-white/[0.06] bg-black/15 px-2 py-1">
                    {call.output}
                  </pre>
                </div>
              )}
            </div>
          </details>
        )}
      </div>
    </div>
  )
}

export function ChatMessage({ message }: Props) {
  const simulationStatus = useProjectStore((s) => s.simulation.status)

  if (message.type === 'tool-call') {
    return <ToolCallMessage message={message} />
  }

  if (message.type === 'warning-card' && message.warning) {
    return (
      <div className="my-2">
        <WarningCard warning={message.warning} />
      </div>
    )
  }

  if (message.type === 'world-model-verdict' && message.worldModelVerdict) {
    return (
      <div className="my-2">
        <WorldModelVerdictCard verdict={message.worldModelVerdict} />
      </div>
    )
  }

  if (message.type === 'file-upload') {
    return (
      <div className="flex items-center gap-2 bg-white/[0.03] rounded px-3 py-2 text-xs text-white/50 border border-white/[0.06]">
        <span className="text-[10px] uppercase tracking-widest text-white/30">File</span>
        <span>{message.fileName}</span>
      </div>
    )
  }

  if (message.type === 'action-button') {
    const isRunningSimulation =
      message.actionCallback === 'run-simulation' &&
      (simulationStatus === 'connecting' || simulationStatus === 'running')

    function handleAction() {
      if (!message.actionCallback || isRunningSimulation) return
      window.dispatchEvent(
        new CustomEvent('manu:chat-action', {
          detail: { action: message.actionCallback },
        })
      )
    }

    return (
      <div className="flex justify-start">
        <div className="w-full max-w-[88%] rounded-lg border border-emerald-400/20 bg-emerald-400/[0.06] px-3 py-3">
          {message.content && (
            <p className="text-xs leading-relaxed text-white/60 mb-2">
              {message.content}
            </p>
          )}
          <button
            type="button"
            onClick={handleAction}
            disabled={isRunningSimulation}
            className="w-full rounded-md border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs font-medium text-emerald-200 transition-colors hover:bg-emerald-400/15 active:translate-y-px disabled:cursor-wait disabled:opacity-60"
          >
            {isRunningSimulation ? 'Simulation Running' : message.actionLabel ?? 'Run Simulation'}
          </button>
        </div>
      </div>
    )
  }

  const isUser = message.type === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
        isUser
          ? 'bg-blue-500/10 text-white/90 border border-blue-500/20'
          : 'bg-white/[0.04] text-white/80 border border-white/[0.06]'
      }`}>
        {message.content}
      </div>
    </div>
  )
}
