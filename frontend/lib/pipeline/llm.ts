import OpenAI from 'openai'

/** Default model for Context, Component, Intent and RFQ agents. Override via OPENAI_MODEL.
 *  gpt-4.1-mini is the demo default: noticeably stronger intent/component reasoning
 *  than nano for a small latency cost. */
export const OPENAI_MODEL = process.env.OPENAI_MODEL ?? 'gpt-4.1-mini'

export function hasOpenAIKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY)
}

export function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set')
  return new OpenAI({ apiKey })
}

/** Single-turn JSON agent call (Context, Component, RFQ, Scene). */
export async function callJsonAgent(
  system: string,
  user: string,
  maxTokens = 1024
): Promise<string> {
  const client = getOpenAIClient()
  const response = await client.chat.completions.create({
    model: OPENAI_MODEL,
    max_tokens: maxTokens,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  })

  return response.choices[0]?.message?.content ?? ''
}
