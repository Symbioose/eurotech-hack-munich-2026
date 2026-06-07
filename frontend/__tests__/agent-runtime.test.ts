import { describe, expect, it, vi } from 'vitest'
import { createAgentRuntime } from '../lib/pipeline/agent-runtime'
import type { ComplianceResult } from '../lib/pipeline/types'

describe('agent runtime', () => {
  it('records agent and tool events around an allowed MCP call', async () => {
    const runtime = createAgentRuntime({
      callMcp: vi.fn(async () => ({
        requirements: [],
      })),
    })

    const result = await runtime.runAgent('compliance_hk_agent', 'Check legal requirements', () =>
      runtime.callMcpWithFallback<ComplianceResult>(
        'compliance_hk_agent',
        'compliance.search_requirements',
        { city: 'Hong Kong' },
        () => ({ requirements: [] })
      )
    )

    expect(result.requirements).toEqual([])
    expect(runtime.mcpToolCalls).toEqual([
      {
        agent: 'compliance_hk_agent',
        server: 'compliance',
        tool: 'search_requirements',
        title: 'Check jurisdiction requirements',
        status: 'ok',
      },
    ])
    expect(runtime.trace.map((event) => event.type)).toEqual([
      'agent.started',
      'tool.started',
      'tool.completed',
      'agent.completed',
    ])
  })

  it('records fallback when an MCP call fails', async () => {
    const runtime = createAgentRuntime({
      callMcp: vi.fn(async () => {
        throw new Error('server unavailable')
      }),
    })

    const result = await runtime.callMcpWithFallback<ComplianceResult>(
      'compliance_hk_agent',
      'compliance.search_requirements',
      { city: 'Hong Kong' },
      () => ({ requirements: [] })
    )

    expect(result.requirements).toEqual([])
    expect(runtime.mcpToolCalls[0]?.status).toBe('fallback')
    expect(runtime.trace.map((event) => event.type)).toEqual([
      'tool.started',
      'tool.fallback',
    ])
  })

  it('records a hard failure for required MCP calls instead of falling back', async () => {
    const runtime = createAgentRuntime({
      callMcp: vi.fn(async () => {
        throw new Error('scene server unavailable')
      }),
    })

    await expect(
      runtime.callMcpRequired<ComplianceResult>(
        'compliance_hk_agent',
        'compliance.search_requirements',
        { city: 'Hong Kong' }
      )
    ).rejects.toThrow('scene server unavailable')

    expect(runtime.mcpToolCalls).toEqual([])
    expect(runtime.trace.map((event) => event.type)).toEqual([
      'tool.started',
      'tool.failed',
    ])
  })

  it('rejects tools outside an agent permission set', async () => {
    const runtime = createAgentRuntime({
      callMcp: vi.fn(async () => ({})),
    })

    await expect(
      runtime.callMcpWithFallback(
        'compliance_hk_agent',
        'supplier.route_bom_to_gba',
        {},
        () => ({})
      )
    ).rejects.toThrow('not allowed')
  })

  it('enforces the maxSteps declared for each agent', async () => {
    const runtime = createAgentRuntime()

    await runtime.runAgent('context_agent', 'first context pass', () => ({}))
    await runtime.runAgent('context_agent', 'second context pass', () => ({}))
    await expect(
      runtime.runAgent('context_agent', 'third context pass', () => ({}))
    ).rejects.toThrow('exceeded maxSteps=2')
  })
})
