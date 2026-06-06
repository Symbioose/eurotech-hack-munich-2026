import { describe, expect, it, vi } from 'vitest'

vi.mock('../lib/context-gate-server', () => ({
  analyzeContextGateWithAgent: vi.fn(async () => ({
    status: 'needs_input',
    canonicalPrompt: 'Need a sensor',
    missingFields: ['city'],
    questions: [{ id: 'city', question: 'Which city is this for?' }],
    confidence: 0.4,
    source: 'llm',
  })),
}))

describe('/api/context/analyze', () => {
  it('returns context-agent gate analysis', async () => {
    const { POST } = await import('../app/api/context/analyze/route')
    const res = await POST(
      new Request('http://localhost/api/context/analyze', {
        method: 'POST',
        body: JSON.stringify({ prompt: 'Need a sensor' }),
      })
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('needs_input')
    expect(body.missingFields).toContain('city')
    expect(body.confidence).toBe(0.4)
  })
})
