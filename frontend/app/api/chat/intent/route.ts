import { classifyChatIntent, type DesignSummary } from '@/lib/pipeline/intent'

export async function POST(req: Request) {
  let message: string
  let design: DesignSummary
  try {
    ;({ message, design } = await req.json())
    if (!message?.trim()) throw new Error('missing message')
    if (!design || !Array.isArray(design.components)) {
      design = { node_type: '', components: [] }
    }
  } catch {
    return Response.json({ error: 'bad request' }, { status: 400 })
  }

  const intent = await classifyChatIntent(message, design)
  return Response.json(intent)
}
