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
    const toolCall = useProjectStore.getState().messages.find((message) => message.type === 'tool-call')
    expect(toolCall?.toolCall?.status).toBe('completed')
    expect(toolCall?.toolCall?.output).toContain('source: llm')
  })

  it('marks the context gate tool call as fallback when the server used the local gate', async () => {
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
          source: 'fallback',
        }),
      }))
    )

    await runPipelineInStore('I need a sensor for a building')

    const toolCall = useProjectStore.getState().messages.find((message) => message.type === 'tool-call')
    expect(toolCall?.toolCall?.status).toBe('fallback')
    expect(toolCall?.toolCall?.output).toContain('source: fallback')
  })

  it('uses the follow-up answer to continue into generation instead of repeating clarification', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'needs_input',
          canonicalPrompt: 'I need a sensor for a building',
          missingFields: ['city', 'surface', 'goal'],
          questions: [
            { id: 'city', question: 'Which city is this for?' },
            { id: 'surface', question: 'Where is it mounted?' },
            { id: 'goal', question: 'What should it detect?' },
          ],
          confidence: 0.3,
          source: 'llm',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'ready',
          canonicalPrompt:
            'Hong Kong residential building facade node mounted on the facade to detect cracks and moisture.',
          missingFields: ['power', 'connectivity', 'privacy'],
          questions: [],
          confidence: 0.91,
          source: 'llm',
        }),
      })
      .mockResolvedValueOnce(
        new Response(
          new ReadableStream({
            start(controller) {
              controller.close()
            },
          }),
          { status: 200 }
        )
      )
    vi.stubGlobal('fetch', fetchMock)

    await runPipelineInStore('I need a sensor for a building')
    await runPipelineInStore(
      'Hong Kong residential building façade. Mounted on the façade, it detects cracks and moisture. Battery powered, LoRa, no camera.'
    )

    expect(useProjectStore.getState().contextGate).toBeNull()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/pipeline/generate',
      expect.objectContaining({ method: 'POST' })
    )
    expect(useProjectStore.getState().messages.at(-1)?.content).not.toContain(
      'I need a bit more context'
    )
  })

  it('uses default deployment context when the user delegates clarification choices', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'needs_input',
          canonicalPrompt: 'I need a sensor for a building',
          missingFields: ['city', 'site', 'surface', 'goal'],
          questions: [
            { id: 'city', question: 'What is the city or jurisdiction?' },
            { id: 'site', question: 'What is the site type?' },
            { id: 'surface', question: 'What is the mounting surface?' },
          ],
          confidence: 0.2,
          source: 'llm',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'needs_input',
          canonicalPrompt:
            'Please provide the city or jurisdiction, site type, mounting surface, and device goal.',
          missingFields: ['city', 'site', 'surface', 'goal'],
          questions: [
            { id: 'cityjurisdiction', question: 'What is the city or jurisdiction?' },
            { id: 'site', question: 'What is the site type?' },
            { id: 'surface', question: 'What is the mounting surface?' },
          ],
          confidence: 0.2,
          source: 'llm',
        }),
      })
      .mockResolvedValueOnce(
        new Response(
          new ReadableStream({
            start(controller) {
              controller.close()
            },
          }),
          { status: 200 }
        )
      )
    vi.stubGlobal('fetch', fetchMock)

    await runPipelineInStore('I need a sensor for a building')
    await runPipelineInStore('jsp fait comme tu veux')

    expect(useProjectStore.getState().contextGate).toBeNull()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/pipeline/generate',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('Hong Kong dense-city deployment'),
      })
    )
  })

  it('preserves all previous clarification answers even when the gate canonical prompt is incomplete', async () => {
    const contextPrompts: string[] = []
    const contextResponses = [
      {
        status: 'needs_input',
        canonicalPrompt: 'I need a sensor for a building',
        missingFields: ['city', 'surface', 'goal'],
        questions: [
          { id: 'city', question: 'Which city is this for?' },
          { id: 'surface', question: 'Where is it mounted?' },
          { id: 'goal', question: 'What should it detect?' },
        ],
        confidence: 0.3,
        source: 'llm',
      },
      {
        status: 'needs_input',
        canonicalPrompt: 'Hong Kong residential building',
        missingFields: ['goal'],
        questions: [{ id: 'goal', question: 'What should it detect?' }],
        confidence: 0.52,
        source: 'llm',
      },
      {
        status: 'ready',
        canonicalPrompt:
          'Hong Kong residential building facade node mounted on the facade to detect cracks and moisture.',
        missingFields: [],
        questions: [],
        confidence: 0.92,
        source: 'llm',
      },
    ]
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/context/analyze') {
        contextPrompts.push(JSON.parse(String(init?.body)).prompt)
        return {
          ok: true,
          json: async () => contextResponses.shift(),
        }
      }
      return new Response(
        new ReadableStream({
          start(controller) {
            controller.close()
          },
        }),
        { status: 200 }
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    await runPipelineInStore('I need a sensor for a building')
    await runPipelineInStore('Hong Kong residential building. Mounted on the façade.')
    await runPipelineInStore('It should detect cracks and moisture.')

    expect(contextPrompts[2]).toContain('Mounted on the façade')
    expect(useProjectStore.getState().contextGate).toBeNull()
  })
})
