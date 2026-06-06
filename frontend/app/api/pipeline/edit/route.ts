import { applyComponentEdit } from '@/lib/pipeline/orchestrator'
import type { EditOp } from '@/lib/pipeline/edit-resolver'
import type { PipelineState } from '@/lib/pipeline/types'

export async function POST(req: Request) {
  let pipelineState: PipelineState
  let edits: EditOp[]
  try {
    ;({ pipelineState, edits } = await req.json())
    if (!pipelineState || !Array.isArray(edits) || edits.length === 0) {
      throw new Error('missing fields')
    }
  } catch {
    return new Response(JSON.stringify({ error: 'bad request' }), { status: 400 })
  }

  const updated = await applyComponentEdit(pipelineState, edits)
  return Response.json(updated)
}
