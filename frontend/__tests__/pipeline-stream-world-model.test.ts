import { afterEach, describe, expect, test, vi } from 'vitest'
import { analyzeWorldModelApi, applyWorldModelFixApi } from '@/lib/pipeline-stream'

describe('world model pipeline client helpers', () => {
  afterEach(() => vi.restoreAllMocks())

  test('posts report to analyze endpoint', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ severity: 'pass' }),
    } as Response)

    await analyzeWorldModelApi({ id: 'state' }, { steps: [] }, [])

    expect(fetchMock).toHaveBeenCalledWith('/api/world-model/analyze', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }))
  })

  test('posts verdict to apply-fix endpoint', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ pipelineStatus: 'complete' }),
    } as Response)

    await applyWorldModelFixApi({ id: 'state' }, { id: 'verdict' })

    expect(fetchMock).toHaveBeenCalledWith('/api/world-model/apply-fix', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }))
  })
})
