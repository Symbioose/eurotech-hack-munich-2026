import { runPipeline } from '@/lib/pipeline/orchestrator'

export async function POST(req: Request) {
  let prompt: string
  try {
    ;({ prompt } = await req.json())
    if (!prompt?.trim()) throw new Error('missing prompt')
  } catch {
    return new Response(JSON.stringify({ error: 'bad request' }), { status: 400 })
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      function send(type: string, data: unknown = null) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type, data })}\n\n`))
      }

      try {
        await runPipeline(prompt, (stage, data) => {
          send(`stage:${stage}`, data)
        }, { interruptOnRisk: true })
      } catch (err) {
        send('error', { message: String(err) })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
