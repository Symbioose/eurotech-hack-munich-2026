import { describe, expect, it } from 'vitest'
import { POST } from '../app/api/research/refresh/route'
import { runDeterministicPipeline } from '../lib/pipeline/orchestrator'

const PROMPT =
  'A 52-year-old Hong Kong residential building needs a low-maintenance facade sensor node that monitors crack propagation and moisture ingress before the next Mandatory Building Inspection.'

describe('/api/research/refresh', () => {
  it('returns honest Tavily status and MCP calls for source refresh', async () => {
    const pipelineState = await runDeterministicPipeline(PROMPT)
    const req = new Request('http://localhost/api/research/refresh', {
      method: 'POST',
      body: JSON.stringify({ pipelineState }),
    })

    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.status).toBe('ok')
    expect(body.results.compliance.provider).toBe('tavily')
    expect(['ok', 'not_configured']).toContain(body.results.compliance.status)
    expect(body.results.hardware.provider).toBe('tavily')
    expect(body.mcpToolCalls.map((c: { tool: string }) => c.tool)).toContain('refresh_sources')
    expect(body.mcpToolCalls.map((c: { tool: string }) => c.tool)).toContain(
      'research_component_availability'
    )
  })
})
