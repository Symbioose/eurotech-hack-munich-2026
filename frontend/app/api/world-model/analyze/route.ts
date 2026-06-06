import { analyzeWorldModelReport } from '@/lib/world-model/agent'
import type { PipelineState } from '@/lib/pipeline/types'
import type { SimulationReport } from '@/lib/types'

export async function POST(req: Request) {
  let pipelineState: PipelineState
  let report: SimulationReport
  let previousReports: SimulationReport[] | undefined

  try {
    ;({ pipelineState, report, previousReports } = await req.json())
    if (!pipelineState || !report || !Array.isArray(report.steps)) throw new Error('missing fields')
  } catch {
    return Response.json({ error: 'bad request' }, { status: 400 })
  }

  return Response.json(analyzeWorldModelReport({
    pipelineState,
    report,
    previousReports: previousReports ?? [],
  }))
}
