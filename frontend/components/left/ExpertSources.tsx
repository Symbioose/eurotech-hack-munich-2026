'use client'
import { useProjectStore } from '@/lib/store'
import type { McpToolCallUI, SourceRefreshState } from '@/lib/types'
import type { PipelineState } from '@/lib/pipeline/types'

type RefreshResponse = {
  refreshed_at: string
  results: {
    compliance: { status: string; provider: string; results?: unknown[]; limitation?: string }
    hardware: { status: string; provider: string; results?: unknown[]; limitation?: string }
  }
  mcpToolCalls: McpToolCallUI[]
}

function statusFromResponse(body: RefreshResponse): SourceRefreshState {
  const statuses = [body.results.compliance.status, body.results.hardware.status]
  if (statuses.includes('ok')) {
    return {
      status: 'candidate',
      message: 'Candidate updates found',
      refreshedAt: body.refreshed_at,
    }
  }
  if (statuses.every((s) => s === 'not_configured')) {
    return {
      status: 'not_configured',
      message: 'Tavily key not configured',
      refreshedAt: body.refreshed_at,
    }
  }
  return {
    status: 'error',
    message: 'Refresh returned partial results',
    refreshedAt: body.refreshed_at,
  }
}

function hardwareQuery(state: PipelineState): string {
  const parts = state.bom.rows.map((row) => row.part).join(', ')
  return `availability datasheet distributor ${parts}`
}

function deviceType(state: PipelineState): string {
  const ctx = state.deploymentContext
  return `${ctx.surface} ${ctx.goal}`.trim()
}

function StatusDot({ status }: { status: SourceRefreshState['status'] }) {
  const color =
    status === 'candidate'
      ? 'bg-blue-400/80'
      : status === 'not_configured'
        ? 'bg-amber-400/80'
        : status === 'error'
          ? 'bg-red-400/80'
          : status === 'checking'
            ? 'bg-white/50'
            : 'bg-emerald-400/70'

  return <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${color}`} />
}

export function ExpertSources() {
  const pipelineState = useProjectStore((s) => s.pipelineState)
  const bom = useProjectStore((s) => s.bom)
  const sourceRefresh = useProjectStore((s) => s.sourceRefresh)
  const setSourceRefresh = useProjectStore((s) => s.setSourceRefresh)
  const setMcpToolCalls = useProjectStore((s) => s.setMcpToolCalls)
  const upsertToolCallMessage = useProjectStore((s) => s.upsertToolCallMessage)

  if (!pipelineState) return null

  const requirements = pipelineState.compliance.requirements
  const sourcedParts = bom.filter((row) => row.sourceStatus).slice(0, 4)

  async function handleRefresh() {
    if (!pipelineState || sourceRefresh.status === 'checking') return
    const startedAt = Date.now()
    const runId = `refresh-${startedAt}`
    upsertToolCallMessage({
      id: `${runId}-compliance`,
      server: 'compliance_mcp',
      tool: 'refresh_sources',
      title: 'Refresh compliance sources',
      status: 'running',
      input: `${pipelineState.deploymentContext.city} · ${deviceType(pipelineState)}`,
      startedAt,
    })
    upsertToolCallMessage({
      id: `${runId}-hardware`,
      server: 'hardware_mcp',
      tool: 'research_component_availability',
      title: 'Refresh component availability',
      status: 'running',
      input: hardwareQuery(pipelineState).slice(0, 220),
      startedAt,
    })
    setSourceRefresh({ status: 'checking', message: 'Checking web sources' })
    try {
      const res = await fetch('/api/research/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pipelineState }),
      })
      if (!res.ok) throw new Error('refresh failed')
      const body = (await res.json()) as RefreshResponse
      setSourceRefresh(statusFromResponse(body))
      setMcpToolCalls([...useProjectStore.getState().mcpToolCalls, ...body.mcpToolCalls])
      upsertToolCallMessage({
        id: `${runId}-compliance`,
        server: 'compliance_mcp',
        tool: 'refresh_sources',
        title: 'Refresh compliance sources',
        status: body.results.compliance.status === 'ok' ? 'completed' : 'fallback',
        output: `${body.results.compliance.provider}: ${body.results.compliance.status}`,
        startedAt,
        completedAt: Date.now(),
      })
      upsertToolCallMessage({
        id: `${runId}-hardware`,
        server: 'hardware_mcp',
        tool: 'research_component_availability',
        title: 'Refresh component availability',
        status: body.results.hardware.status === 'ok' ? 'completed' : 'fallback',
        output: `${body.results.hardware.provider}: ${body.results.hardware.status}`,
        startedAt,
        completedAt: Date.now(),
      })
    } catch {
      setSourceRefresh({ status: 'error', message: 'Refresh failed' })
      upsertToolCallMessage({
        id: `${runId}-compliance`,
        server: 'compliance_mcp',
        tool: 'refresh_sources',
        title: 'Refresh compliance sources',
        status: 'error',
        output: 'Refresh request failed',
        startedAt,
        completedAt: Date.now(),
      })
      upsertToolCallMessage({
        id: `${runId}-hardware`,
        server: 'hardware_mcp',
        tool: 'research_component_availability',
        title: 'Refresh component availability',
        status: 'error',
        output: 'Refresh request failed',
        startedAt,
        completedAt: Date.now(),
      })
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <StatusDot status={sourceRefresh.status} />
          <span className="text-[10px] text-white/35 truncate">{sourceRefresh.message}</span>
          {sourceRefresh.refreshedAt && (
            <span className="text-white/20 text-[10px] shrink-0">
              · {new Date(sourceRefresh.refreshedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={sourceRefresh.status === 'checking'}
          className="text-[10px] text-white/35 hover:text-white/60 transition-colors disabled:opacity-40 shrink-0"
        >
          {sourceRefresh.status === 'checking' ? 'Checking…' : 'Refresh'}
        </button>
      </div>

      {(requirements.length > 0 || sourcedParts.length > 0) && (
        <div className="space-y-2 border-l border-white/[0.06] pl-3">
          {requirements.map((req) => (
            <a
              key={req.id}
              href={req.source_url}
              target="_blank"
              rel="noreferrer"
              className="block group"
            >
              <p className="text-[10px] text-white/60 group-hover:text-white/80 truncate">
                {req.title}
              </p>
              <p className="text-[10px] text-white/25 truncate">
                {req.authority} · {req.source_status} · {req.last_checked_at}
              </p>
            </a>
          ))}
          {sourcedParts.map((part) => (
            <div key={part.id}>
              <p className="text-[10px] text-white/55 truncate">{part.part}</p>
              <p className="text-[10px] text-white/25 truncate">
                {part.sourceStatus} · {part.lastCheckedAt} · {part.supplierRoute}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
