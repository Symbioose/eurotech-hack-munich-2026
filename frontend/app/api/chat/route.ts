import Anthropic from '@anthropic-ai/sdk'
import { buildSystemPrompt, parseEvents } from './helpers'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: Request) {
  let message: string, fileNames: string[] | undefined, history: { role: 'user' | 'assistant'; content: string }[]
  try {
    ;({ message, fileNames, history = [] } = await req.json())
    if (!message) throw new Error('missing message')
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
        const userContent = fileNames?.length
          ? `${message}\n\n[Attached files: ${fileNames.join(', ')}]`
          : message

        const anthropicStream = client.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 4096,
          system: buildSystemPrompt(),
          messages: [
            ...history,
            { role: 'user', content: userContent },
          ],
        })

        let accumulated = ''
        const firedEvents = new Set<string>()

        for await (const event of anthropicStream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            const chunk = event.delta.text
            accumulated += chunk
            send('text', chunk)

            // Fire pipeline events once each based on accumulated text
            for (const e of parseEvents(accumulated)) {
              if (!firedEvents.has(e.type)) {
                firedEvents.add(e.type)
                send(e.type, e.data)
              }
            }
          }
        }
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
