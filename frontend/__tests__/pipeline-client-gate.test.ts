import { beforeEach, describe, expect, it, vi } from 'vitest'
import { runPipelineInStore } from '../lib/pipeline-client'
import { useProjectStore } from '../lib/store'

describe('runPipelineInStore context gate', () => {
  beforeEach(() => {
    useProjectStore.setState(useProjectStore.getInitialState())
    vi.stubGlobal('fetch', vi.fn())
  })

  it('does not call the generation API when required context is missing', async () => {
    await runPipelineInStore('I need a sensor for a building')

    expect(fetch).not.toHaveBeenCalled()
    expect(useProjectStore.getState().contextGate?.status).toBe('awaiting_user')
    expect(useProjectStore.getState().messages.at(-1)?.content).toContain('I need a bit more context')
  })
})
