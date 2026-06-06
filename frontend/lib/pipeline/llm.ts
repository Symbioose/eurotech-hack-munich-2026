import OpenAI from 'openai'

/** Default model for Context, Component and RFQ agents. Override via OPENAI_MODEL. */
export const OPENAI_MODEL = process.env.OPENAI_MODEL ?? 'gpt-4.1-nano'

export function hasOpenAIKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY)
}

export function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set')
  return new OpenAI({ apiKey })
}

/** Single-turn JSON agent call (Context, Component, RFQ). */
export async function callJsonAgent(system: string, user: string): Promise<string> {
  const client = getOpenAIClient()
  const response = await client.chat.completions.create({
    model: OPENAI_MODEL,
    max_tokens: 1024,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  })

  return response.choices[0]?.message?.content ?? ''
}
