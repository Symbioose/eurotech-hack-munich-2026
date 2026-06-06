import OpenAI from 'openai'
import { buildSystemPrompt, parseEvents } from './helpers'
import { OPENAI_MODEL } from '@/lib/pipeline/llm'

export async function POST(req: Request) {
  let message: string, fileNames: string[] | undefined
  try {
    ;({ message, fileNames } = await req.json())
    if (!message) throw new Error('missing message')
  } catch {
    return new Response(JSON.stringify({ error: 'bad request' }), { status: 400 })
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'OPENAI_API_KEY not configured' }), { status: 503 })
  }

  const client = new OpenAI({ apiKey })
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
          model: OPENAI_MODEL,
          max_tokens: 1024,
          stream: true,
          messages: [
            { role: 'system', content: buildSystemPrompt() },
            { role: 'user', content: userContent },
          ],
        })

        let accumulated = ''
        const firedEvents = new Set<string>()

        for await (const chunk of openaiStream) {
          const text = chunk.choices[0]?.delta?.content
          if (!text) continue
          accumulated += text
          send('text', text)

          for (const e of parseEvents(accumulated)) {
            if (!firedEvents.has(e.type)) {
              firedEvents.add(e.type)
              send(e.type, e.data)
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
