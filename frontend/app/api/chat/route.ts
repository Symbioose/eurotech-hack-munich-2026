import OpenAI from 'openai'
import { buildSystemPrompt, parseEvents } from './helpers'

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

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

        const openaiStream = await client.chat.completions.create({
          model: 'gpt-4o',
          max_tokens: 4096,
          stream: true,
          messages: [
            { role: 'system', content: buildSystemPrompt() },
            ...history,
            { role: 'user', content: userContent },
          ],
        })

        let accumulated = ''
        const firedEvents = new Set<string>()

        for await (const chunk of openaiStream) {
          const delta = chunk.choices[0]?.delta?.content
          if (delta) {
            accumulated += delta
            send('text', delta)

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
