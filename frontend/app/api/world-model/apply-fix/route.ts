import { applyComponentEdit, applyPipelineFix } from '@/lib/pipeline/orchestrator'
import type { PipelineState } from '@/lib/pipeline/types'
import type { WorldModelVerdict } from '@/lib/types'

export async function POST(req: Request) {
  let pipelineState: PipelineState
  let verdict: WorldModelVerdict

  try {
    ;({ pipelineState, verdict } = await req.json())
    if (!pipelineState || !verdict?.recommendedAction) throw new Error('missing fields')
  } catch {
    return Response.json({ error: 'bad request' }, { status: 400 })
  }

  const action = verdict.recommendedAction
  if (action.kind === 'none') {
    return Response.json({ error: 'no actionable fix for this verdict' }, { status: 422 })
  }

  if (action.kind === 'dfma_fix') {
    return Response.json(await applyPipelineFix(pipelineState, action.dfmaWarningId))
  }

  return Response.json(await applyComponentEdit(pipelineState, action.editOps))
}
