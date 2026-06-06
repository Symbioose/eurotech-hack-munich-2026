import { streamPipeline } from '@/lib/pipeline-stream'
import {
  evaluateContextGate,
  formatContextQuestions,
  normalizeContextGateResult,
  type ContextGateResult,
} from '@/lib/context-gate'
import { formatRiskCheckpointMessage } from '@/lib/agent-checkpoints'
import { hydrateStoreFromPipeline, pipelineStageToDemoStep } from '@/lib/pipeline/hydrate-store'
import { formatNodeTitle, primaryWarningToUI } from '@/lib/pipeline/to-ui'
import { PIPELINE_TOOL_REGISTRY } from '@/lib/pipeline/agent-registry'
import { useProjectStore } from '@/lib/store'
import type { PipelineState } from '@/lib/pipeline/types'
import type { ChatToolCall, PipelineStageName } from '@/lib/types'

let msgCounter = 0
function mkId() {
  return `msg-${++msgCounter}-${Date.now()}`
}

type ToolStage = Exclude<PipelineStageName, 'complete' | null>

const TOOL_STAGES: ToolStage[] = [
  'context',
  'compliance',
  'components',
  'assembly',
  'bom',
  'dfma',
  'rfq',
  'scene',
]

const TOOL_META: Record<ToolStage, { server: string; tool: string; title: string }> = {
  context: {
    server: 'context_agent',
    tool: 'extract_context',
    title: 'Read deployment context',
  },
  compliance: {
    server: 'compliance_hk_agent',
    tool: PIPELINE_TOOL_REGISTRY['compliance.search_requirements'].tool,
    title: PIPELINE_TOOL_REGISTRY['compliance.search_requirements'].title,
  },
  components: {
    server: 'component_agent',
    tool: 'select_catalog_components',
    title: 'Select electronic components',
  },
  assembly: {
    server: 'hardware_expert_agent',
    tool: PIPELINE_TOOL_REGISTRY['hardware.match_assembly_pattern'].tool,
    title: PIPELINE_TOOL_REGISTRY['hardware.match_assembly_pattern'].title,
  },
  bom: {
    server: 'bom_resolver',
    tool: 'resolve_bom',
    title: 'Build bill of materials',
  },
  dfma: {
    server: 'dfma_engine',
    tool: 'check_manufacturability',
    title: 'Run DfMA check',
  },
  rfq: {
    server: 'supplier_gba_agent',
    tool: PIPELINE_TOOL_REGISTRY['supplier.route_bom_to_gba'].tool,
    title: PIPELINE_TOOL_REGISTRY['supplier.route_bom_to_gba'].title,
  },
  scene: {
    server: 'scene_3d_agent',
    tool: PIPELINE_TOOL_REGISTRY['scene.generate_scene_graph'].tool,
    title: PIPELINE_TOOL_REGISTRY['scene.generate_scene_graph'].title,
  },
}

function nextStage(stage: ToolStage): ToolStage | null {
  const index = TOOL_STAGES.indexOf(stage)
  return TOOL_STAGES[index + 1] ?? null
}

function len(value: unknown): number {
  return Array.isArray(value) ? value.length : 0
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function summarizeStageOutput(stage: ToolStage, data: unknown): string {
  const value = record(data)

  switch (stage) {
    case 'context':
      return [
        value.city ? `city: ${value.city}` : null,
        value.surface ? `surface: ${value.surface}` : null,
        value.goal ? `goal: ${value.goal}` : null,
      ]
        .filter(Boolean)
        .join('\n')
    case 'compliance':
      return `${len(value.requirements)} requirement(s) matched`
    case 'components':
      return `${len(value.selected_component_ids)} catalog component(s) selected`
    case 'assembly':
      return [
        value.label ? `pattern: ${value.label}` : null,
        `missing required: ${len(value.missing_required_component_ids)}`,
      ]
        .filter(Boolean)
        .join('\n')
    case 'bom':
      return `${len(value.rows)} line item(s), $${Number(value.total_cost_usd ?? 0).toFixed(2)} estimated`
    case 'dfma':
      return `${len(value.warnings)} manufacturability warning(s)`
    case 'rfq':
      return `${len(value.gba_route)} GBA route step(s), ${len(value.supplier_questions)} supplier question(s)`
    case 'scene':
      return `${len(value.nodes)} 3D node part(s)`
  }
}

function applyMcpStatuses(runId: string, state: PipelineState) {
  for (const stage of TOOL_STAGES) {
    const call = state.mcpToolCalls?.find((item) => item.tool === TOOL_META[stage].tool)
    if (!call) continue
    upsertToolCall(runId, stage, {
      server: call.agent ?? `${call.server}_mcp`,
      title: call.title,
      status: call.status === 'ok' ? 'completed' : 'fallback',
      completedAt: Date.now(),
    })
  }
}

function upsertToolCall(runId: string, stage: ToolStage, patch: Partial<ChatToolCall>) {
  const meta = TOOL_META[stage]
  const now = Date.now()
  useProjectStore.getState().upsertToolCallMessage({
    id: `${runId}-${stage}`,
    server: meta.server,
    tool: meta.tool,
    title: meta.title,
    status: 'running',
    startedAt: now,
    ...patch,
  })
}

async function loadDeterministicFromApi(prompt: string): Promise<PipelineState> {
  const res = await fetch('/api/pipeline/fallback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  })
  return res.json() as Promise<PipelineState>
}

async function analyzeContextGate(prompt: string): Promise<ContextGateResult> {
  try {
    const res = await fetch('/api/context/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    })
    if (!res.ok) throw new Error('Context gate request failed')
    return normalizeContextGateResult((await res.json()) as Partial<ContextGateResult>, prompt)
  } catch {
    return evaluateContextGate(prompt)
  }
}

export async function runPipelineInStore(content: string, files?: File[]) {
  const store = useProjectStore.getState()
  if (!content.trim() && (!files || files.length === 0)) return

  if (files?.length) {
    files.forEach((f) => {
      store.addMessage({
        id: mkId(),
        type: 'file-upload',
        content: '',
        timestamp: Date.now(),
        fileName: f.name,
      })
    })
  }

  store.addMessage({ id: mkId(), type: 'user', content, timestamp: Date.now() })
  const pendingGate = store.contextGate
  const gatedPrompt = pendingGate
    ? `${pendingGate.originalPrompt}\n\nAdditional context from user:\n${content}`
    : content
  const gate = await analyzeContextGate(gatedPrompt)

  if (gate.status === 'needs_input') {
    store.setConversationState('awaiting_context')
    store.setContextGate({
      status: 'awaiting_user',
      originalPrompt: gate.canonicalPrompt,
      missingFields: gate.missingFields,
      questions: gate.questions,
    })
    const startedAt = Date.now()
    store.upsertToolCallMessage({
      id: `context-gate-${startedAt}`,
      server: 'context_agent',
      tool: 'clarify_context',
      title: 'Clarify deployment context',
      status: 'completed',
      input: gatedPrompt.slice(0, 220),
      output: `needs input: ${gate.missingFields.join(', ')}`,
      startedAt,
      completedAt: Date.now(),
    })
    store.addMessage({
      id: mkId(),
      type: 'ai',
      content: formatContextQuestions(gate),
      timestamp: Date.now(),
    })
    store.setPipelineStage(null)
    store.setStreaming(false)
    return
  }

  store.setContextGate(null)
  store.setConversationState('context_ready')
  store.addMessage({
    id: mkId(),
    type: 'ai',
    content: 'I’ll compile this into a deployable smart-city node.',
    timestamp: Date.now(),
  })
  store.setStreaming(true)
  store.setConversationState('running_experts')
  store.setPipelineStage('context')
  store.setDemoStep(1)
  const runId = `run-${++msgCounter}-${Date.now()}`
  let currentStage: ToolStage | null = 'context'
  upsertToolCall(runId, 'context', {
    status: 'running',
    input: content.slice(0, 220),
    startedAt: Date.now(),
  })

  try {
    await streamPipeline(
      gate.canonicalPrompt,
      (type, data) => {
        const s = useProjectStore.getState()

        if (type.startsWith('stage:')) {
          const stage = type.replace('stage:', '')

          if (stage === 'checkpoint:risk') {
            const pipelineState = data as PipelineState
            hydrateStoreFromPipeline(pipelineState)
            applyMcpStatuses(runId, pipelineState)
            currentStage = null
            const warning = primaryWarningToUI(pipelineState)
            if (warning) {
              s.addMessage({
                id: mkId(),
                type: 'ai',
                content: formatRiskCheckpointMessage(warning),
                timestamp: Date.now(),
              })
              s.addMessage({
                id: mkId(),
                type: 'warning-card',
                content: '',
                timestamp: Date.now(),
                warning,
              })
            }
            s.setPipelineStage('dfma')
            s.setConversationState('awaiting_risk_decision')
            s.setStreaming(false)
            return
          }

          s.setPipelineStage(stage as PipelineStageName)

          if (stage !== 'complete' && stage !== 'fallback') {
            const toolStage = stage as ToolStage
            upsertToolCall(runId, toolStage, {
              status: 'completed',
              output: summarizeStageOutput(toolStage, data),
              completedAt: Date.now(),
            })
            currentStage = nextStage(toolStage)
            if (currentStage) {
              upsertToolCall(runId, currentStage, {
                status: 'running',
                startedAt: Date.now(),
              })
            }
            s.setDemoStep(pipelineStageToDemoStep(stage))
          }

          if (stage === 'complete') {
            const pipelineState = data as PipelineState
            hydrateStoreFromPipeline(pipelineState)
            applyMcpStatuses(runId, pipelineState)
            currentStage = null
            s.addMessage({
              id: mkId(),
              type: 'ai',
              content: `${formatNodeTitle(pipelineState.componentGraph.node_type)} generated. BOM, DfMA check, 3D scene graph, and GBA supplier route are ready.`,
              timestamp: Date.now(),
            })
            const warning = primaryWarningToUI(pipelineState)
            if (warning) {
              const hasWarning = s.messages.some((m) => m.type === 'warning-card')
              if (!hasWarning) {
                s.addMessage({
                  id: mkId(),
                  type: 'ai',
                  content: formatRiskCheckpointMessage(warning),
                  timestamp: Date.now(),
                })
                s.addMessage({
                  id: mkId(),
                  type: 'warning-card',
                  content: '',
                  timestamp: Date.now(),
                  warning,
                })
              }
            }
            s.setPipelineStage('complete')
            s.setConversationState('complete')
          }

          if (stage === 'fallback') {
            s.setUsedDeterministic(true)
            if (currentStage) {
              upsertToolCall(runId, currentStage, {
                status: 'fallback',
                output: 'LLM path failed; deterministic resolver produced the result.',
                completedAt: Date.now(),
              })
              s.addMessage({
                id: mkId(),
                type: 'ai',
                content: 'The LLM path failed, so the deterministic pipeline produced the hardware brief.',
                timestamp: Date.now(),
              })
            }
          }
        }
      },
      () => useProjectStore.getState().setStreaming(false)
    )
  } catch {
    const s = useProjectStore.getState()
    try {
      const deterministic = await loadDeterministicFromApi(gate.canonicalPrompt)
      hydrateStoreFromPipeline(deterministic)
      const warning = primaryWarningToUI(deterministic)
      if (warning) {
        s.addMessage({
          id: mkId(),
          type: 'warning-card',
          content: '',
          timestamp: Date.now(),
          warning,
        })
      }
      if (currentStage) {
        upsertToolCall(runId, currentStage, {
          status: 'error',
          output: 'Streaming connection failed before this step completed.',
          completedAt: Date.now(),
        })
      }
      s.addMessage({
        id: mkId(),
        type: 'ai',
        content: 'The streaming connection failed, so the deterministic pipeline generated the hardware brief.',
        timestamp: Date.now(),
      })
      s.setUsedDeterministic(true)
      s.setPipelineStage('complete')
      s.setDemoStep(7)
    } catch {
      if (currentStage) {
        upsertToolCall(runId, currentStage, {
          status: 'error',
          output: 'Pipeline failed before a fallback result was available.',
          completedAt: Date.now(),
        })
      }
      s.addMessage({
        id: mkId(),
        type: 'ai',
        content: 'Pipeline error. No hardware brief was generated.',
        timestamp: Date.now(),
      })
    }
    s.setStreaming(false)
  }
}

export function markProjectComplete(projectId: string) {
  try {
    const raw = localStorage.getItem('pc_projects')
    if (!raw) return
    const title = useProjectStore.getState().projectTitle
    const projects = JSON.parse(raw) as { id: string; status: string; title?: string }[]
    const updated = projects.map((p) =>
      p.id === projectId
        ? { ...p, status: 'complete', ...(title ? { title } : {}) }
        : p
    )
    localStorage.setItem('pc_projects', JSON.stringify(updated))
  } catch {
    // ignore
  }
}
