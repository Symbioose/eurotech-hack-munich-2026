import { applyPipelineFix } from '@/lib/pipeline/orchestrator'
import type { PipelineState } from '@/lib/pipeline/types'

export async function POST(req: Request) {
  let warningId: string
  let pipelineState: PipelineState
  try {
    ;({ warningId, pipelineState } = await req.json())
    if (!warningId || !pipelineState) throw new Error('missing fields')
  } catch {
    return new Response(JSON.stringify({ error: 'bad request' }), { status: 400 })
  }

  const updated = await applyPipelineFix(pipelineState, warningId)
  return Response.json(updated)
}
