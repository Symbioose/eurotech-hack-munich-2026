import { runDeterministicPipeline } from '@/lib/pipeline/orchestrator'

export async function POST(req: Request) {
  let prompt: string
  try {
    ;({ prompt } = await req.json())
    if (!prompt?.trim()) throw new Error('missing prompt')
  } catch {
    return Response.json({ error: 'bad request' }, { status: 400 })
  }

  const state = await runDeterministicPipeline(prompt)
  return Response.json(state)
}
