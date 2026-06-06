import type { DeploymentContext } from './types'
import { extractJsonObject } from './parse-json'
import { callJsonAgent, hasOpenAIKey } from './llm'
import { normalizeDeploymentContext } from './normalize-context'
import { parseContextFromPrompt } from './parse-context'

export { parseContextFromPrompt } from './parse-context'

const SYSTEM = `You are the Context Agent for Physical Cursor.

Read the user's urban problem description and extract a structured DeploymentContext JSON.

Output ONLY valid JSON matching this schema:
{
  "city": string,
  "site": string,
  "surface": string,
  "regulation": string | null,
  "environment": string[],
  "climate": { "humidity": string | null, "rainfall": string | null, "wind": string | null },
  "mounting": string[],
  "power": string[],
  "connectivity": string[],
  "privacy": string[],
  "goal": string
}

Rules:
- Do NOT suggest components.
- Do NOT invent prices or specs.
- If unknown, use null or [].
- Do not explain your reasoning.`

export async function runContextAgent(prompt: string): Promise<DeploymentContext> {
  if (!hasOpenAIKey()) {
    return parseContextFromPrompt(prompt)
  }

  const text = await callJsonAgent(SYSTEM, prompt)
  const raw = extractJsonObject<DeploymentContext>(text)
  return normalizeDeploymentContext(raw, prompt)
}
