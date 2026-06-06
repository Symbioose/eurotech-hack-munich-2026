import { beforeEach, describe, expect, it, vi } from 'vitest'
import { runPipelineInStore } from '../lib/pipeline-client'
import { useProjectStore } from '../lib/store'
import type { PipelineState } from '../lib/pipeline/types'

function closedStream() {
  return new Response(
    new ReadableStream({
      start(controller) {
        controller.close()
      },
    }),
    { status: 200 }
  )
}

/** A complete-enough pipeline state so hydrateStoreFromPipeline can run. */
function fakeDesign(overrides: Partial<PipelineState> = {}): PipelineState {
  return {
    prompt: 'demo',
    deploymentContext: {
      city: 'Hong Kong',
      site: 'residential building',
      surface: 'outdoor facade',
      regulation: null,
      environment: [],
      climate: { humidity: null, rainfall: null, wind: null },
      mounting: [],
      power: [],
      connectivity: [],
      privacy: [],
      goal: 'monitor cracks',
    },
    compliance: { requirements: [] },
    componentGraph: {
      node_type: 'facade-sensor-node',
      selected_component_ids: ['camera-module', 'edge-compute-board'],
    },
    assembly: {
      pattern_id: 'p',
      label: 'pattern',
      required_component_ids: [],
      recommended_component_ids: [],
      missing_required_component_ids: [],
      constraints: [],
      assembly_steps: [],
    },
    bom: {
      rows: [
        { component_id: 'camera-module', part: 'Camera module', supplier_route: 'x', cost_usd: 20, scene_id: null },
        { component_id: 'edge-compute-board', part: 'Edge compute board', supplier_route: 'x', cost_usd: 30, scene_id: null },
      ],
      total_cost_usd: 50,
    },
    dfma: { warnings: [], passed_checks: [] },
    rfq: { supplier_questions: [], gba_route: [] },
    scene: { nodes: [] },
    fixApplied: false,
    appliedWarningId: null,
    usedDeterministic: false,
    baselineComponentIds: ['camera-module', 'edge-compute-board'],
    baselineBomTotal: 50,
    extraComponents: [],
    gbaRouteDisplay: [],
    mcpToolCalls: [],
    agentTrace: [],
    pipelineStatus: 'complete',
    interruption: null,
    ...overrides,
  }
}

describe('runPipelineInStore — gate', () => {
  beforeEach(() => {
    useProjectStore.setState(useProjectStore.getInitialState())
  })

  it('asks for context (no generation) when the brief is too vague to design anything', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          status: 'needs_input',
          canonicalPrompt: 'hi',
          missingFields: ['brief'],
          questions: [{ id: 'brief', question: 'What should I design, and what should it do?' }],
          confidence: 0.4,
          source: 'llm',
        }),
      }))
    )

    await runPipelineInStore('hi')

    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledWith('/api/context/analyze', expect.objectContaining({ method: 'POST' }))
    expect(useProjectStore.getState().contextGate?.status).toBe('awaiting_user')
    expect(useProjectStore.getState().conversationState).toBe('awaiting_context')
    expect(useProjectStore.getState().messages.at(-1)?.content).toContain('I need a bit more context')
    const toolCall = useProjectStore.getState().messages.find((m) => m.type === 'tool-call')
    expect(toolCall?.toolCall?.status).toBe('completed')
  })

  it('marks the gate tool call as fallback when the server used the deterministic gate', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          status: 'needs_input',
          canonicalPrompt: 'hi',
          missingFields: ['brief'],
          questions: [{ id: 'brief', question: 'What should I design?' }],
          confidence: 0.4,
          source: 'fallback',
        }),
      }))
    )

    await runPipelineInStore('hi')

    const toolCall = useProjectStore.getState().messages.find((m) => m.type === 'tool-call')
    expect(toolCall?.toolCall?.status).toBe('fallback')
    expect(toolCall?.toolCall?.output).toContain('source: fallback')
  })

  it('starts generation immediately for any concrete product brief (no smart-city checklist)', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/api/context/analyze') {
        return {
          ok: true,
          json: async () => ({
            status: 'ready',
            canonicalPrompt: 'A quiet desktop air purifier that shows air quality.',
            missingFields: [],
            questions: [],
            confidence: 0.85,
            source: 'llm',
          }),
        }
      }
      return closedStream()
    })
    vi.stubGlobal('fetch', fetchMock)

    await runPipelineInStore('A quiet desktop air purifier that filters dust and shows air quality.')

    expect(useProjectStore.getState().contextGate).toBeNull()
    expect(fetchMock).toHaveBeenCalledWith('/api/pipeline/generate', expect.objectContaining({ method: 'POST' }))
  })
})

describe('runPipelineInStore — conversational routing on an existing design', () => {
  beforeEach(() => {
    useProjectStore.setState(useProjectStore.getInitialState())
    useProjectStore.setState({ pipelineState: fakeDesign(), conversationState: 'complete' })
  })

  it('routes an edit request to the intent + edit endpoints and reports the change', async () => {
    const updated = fakeDesign({
      componentGraph: { node_type: 'facade-sensor-node', selected_component_ids: ['edge-compute-board'] },
      bom: {
        rows: [
          { component_id: 'edge-compute-board', part: 'Edge compute board', supplier_route: 'x', cost_usd: 30, scene_id: null },
        ],
        total_cost_usd: 30,
      },
    })
    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/api/chat/intent') {
        return {
          ok: true,
          json: async () => ({
            action: 'edit',
            reply: 'Removing the camera module.',
            edits: [{ op: 'remove', target: 'camera' }],
          }),
        }
      }
      if (url === '/api/pipeline/edit') {
        return { ok: true, json: async () => updated }
      }
      return closedStream()
    })
    vi.stubGlobal('fetch', fetchMock)

    await runPipelineInStore('remove the camera')

    expect(fetchMock).toHaveBeenCalledWith('/api/chat/intent', expect.objectContaining({ method: 'POST' }))
    expect(fetchMock).toHaveBeenCalledWith('/api/pipeline/edit', expect.objectContaining({ method: 'POST' }))
    // Did NOT regenerate from scratch.
    expect(fetchMock).not.toHaveBeenCalledWith('/api/pipeline/generate', expect.anything())
    expect(useProjectStore.getState().bomTotal).toBe(30)
    expect(useProjectStore.getState().messages.at(-1)?.content).toContain('Removed')
  })

  it('answers a question without changing the design when intent is chat', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/api/chat/intent') {
        return {
          ok: true,
          json: async () => ({ action: 'chat', reply: 'It currently has 2 components.' }),
        }
      }
      return closedStream()
    })
    vi.stubGlobal('fetch', fetchMock)

    await runPipelineInStore('how many components does it have?')

    expect(fetchMock).toHaveBeenCalledWith('/api/chat/intent', expect.objectContaining({ method: 'POST' }))
    expect(fetchMock).not.toHaveBeenCalledWith('/api/pipeline/edit', expect.anything())
    expect(useProjectStore.getState().messages.at(-1)?.content).toBe('It currently has 2 components.')
  })
})
