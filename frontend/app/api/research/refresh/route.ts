import { callMcpTool } from '@/lib/mcp/client'
import type { PipelineState } from '@/lib/pipeline/types'

function hardwareQuery(state: PipelineState): string {
  const parts = state.bom.rows.map((row) => row.part).join(', ')
  return `availability datasheet distributor ${parts}`
}

function deviceType(state: PipelineState): string {
  const ctx = state.deploymentContext
  return `${ctx.surface} ${ctx.goal}`.trim()
}

export async function POST(req: Request) {
  let pipelineState: PipelineState
  try {
    ;({ pipelineState } = await req.json())
    if (!pipelineState?.deploymentContext || !pipelineState?.componentGraph) {
      throw new Error('missing pipelineState')
    }
  } catch {
    return Response.json({ error: 'bad request' }, { status: 400 })
  }

  const [compliance, hardware] = await Promise.all([
    callMcpTool('compliance', 'refresh_sources', {
      jurisdiction: pipelineState.deploymentContext.city,
      device_type: deviceType(pipelineState),
      max_results: 3,
    }),
    callMcpTool('hardware', 'research_component_availability', {
      query: hardwareQuery(pipelineState),
      max_results: 3,
    }),
  ])

  return Response.json({
    status: 'ok',
    refreshed_at: new Date().toISOString(),
    results: { compliance, hardware },
    mcpToolCalls: [
      { server: 'compliance', tool: 'refresh_sources', status: 'ok' },
      { server: 'hardware', tool: 'research_component_availability', status: 'ok' },
    ],
  })
}
