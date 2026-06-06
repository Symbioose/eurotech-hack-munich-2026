import { beforeEach, describe, expect, it, vi } from 'vitest'
import { runPipelineInStore } from '../lib/pipeline-client'
import { useProjectStore } from '../lib/store'

describe('runPipelineInStore context gate', () => {
  beforeEach(() => {
    useProjectStore.setState(useProjectStore.getInitialState())
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          status: 'needs_input',
          canonicalPrompt: 'I need a sensor for a building',
          missingFields: ['city', 'surface'],
          questions: [{ id: 'city', question: 'Which city is this for?' }],
          confidence: 0.35,
          source: 'llm',
        }),
      }))
    )
  })

  it('does not call the generation API when required context is missing', async () => {
    await runPipelineInStore('I need a sensor for a building')

    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledWith(
      '/api/context/analyze',
      expect.objectContaining({ method: 'POST' })
    )
    expect(useProjectStore.getState().contextGate?.status).toBe('awaiting_user')
    expect(useProjectStore.getState().conversationState).toBe('awaiting_context')
    expect(useProjectStore.getState().messages.at(-1)?.content).toContain('I need a bit more context')
  })
})
