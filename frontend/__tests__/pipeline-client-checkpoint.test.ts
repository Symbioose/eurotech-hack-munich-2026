import { beforeEach, describe, expect, it, vi } from 'vitest'
import { runPipelineInStore } from '../lib/pipeline-client'
import { runDeterministicPipeline } from '../lib/pipeline/orchestrator'
import { useProjectStore } from '../lib/store'

const PROMPT =
  'A 52-year-old Hong Kong residential building needs a low-maintenance facade sensor node that monitors crack propagation, vibration anomalies, tilt shifts and moisture ingress, and creates early warnings before the next Mandatory Building Inspection.'

function sseResponse(event: unknown) {
  const encoder = new TextEncoder()
  return new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
        controller.close()
      },
    }),
    { status: 200 }
  )
}

describe('runPipelineInStore risk checkpoints', () => {
  beforeEach(() => {
    useProjectStore.setState(useProjectStore.getInitialState())
  })

  it('moves into awaiting_risk_decision when the server interrupts at DfMA', async () => {
    const checkpoint = await runDeterministicPipeline(PROMPT, undefined, { interruptOnRisk: true })
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url === '/api/context/analyze') {
          return Response.json({
            status: 'ready',
            canonicalPrompt: PROMPT,
            missingFields: [],
            questions: [],
            confidence: 0.92,
            source: 'llm',
          })
        }
        return sseResponse({ type: 'stage:checkpoint:risk', data: checkpoint })
      })
    )

    await runPipelineInStore(PROMPT)

    const state = useProjectStore.getState()
    expect(state.conversationState).toBe('awaiting_risk_decision')
    expect(state.pipelineState?.pipelineStatus).toBe('awaiting_risk_decision')
    expect(state.messages.some((message) => message.content.includes('Critical DfMA review required'))).toBe(true)
  })
})
