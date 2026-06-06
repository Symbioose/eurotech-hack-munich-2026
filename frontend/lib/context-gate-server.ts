import { extractJsonObject } from './pipeline/parse-json'
import { callJsonAgent, hasOpenAIKey } from './pipeline/llm'
import {
  evaluateContextGate,
  normalizeContextGateResult,
  type ContextGateResult,
} from './context-gate'

const SYSTEM = `You are the Context Gate Agent for Physical Cursor.

Before any hardware, compliance, supplier, or 3D agent runs, decide whether the user gave enough deployment context.

Return ONLY valid JSON:
{
  "status": "ready" | "needs_input",
  "canonicalPrompt": string,
  "missingFields": string[],
  "questions": [{ "id": string, "question": string }],
  "confidence": number
}

Required context:
- city or jurisdiction
- site type
- mounting surface
- device goal / measured signal

Useful optional context:
- power
- connectivity
- privacy constraints
- environmental exposure

Rules:
- Ask at most 3 questions.
- Do not suggest components.
- Do not run compliance reasoning.
- If enough information exists, rewrite a concise canonicalPrompt and use status "ready".
- If critical details are missing, use status "needs_input".`

export async function analyzeContextGateWithAgent(prompt: string): Promise<ContextGateResult> {
  if (!hasOpenAIKey()) return evaluateContextGate(prompt)

  try {
    const text = await callJsonAgent(SYSTEM, prompt)
    const raw = extractJsonObject<Partial<ContextGateResult>>(text)
    return normalizeContextGateResult({ ...raw, source: 'llm' }, prompt)
  } catch {
    return evaluateContextGate(prompt)
  }
}
