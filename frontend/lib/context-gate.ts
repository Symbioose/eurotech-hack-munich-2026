export type ContextGateQuestion = {
  id: string
  question: string
}

export type ContextGateResult = {
  status: 'ready' | 'needs_input'
  canonicalPrompt: string
  missingFields: string[]
  questions: ContextGateQuestion[]
  confidence: number
  source: 'llm' | 'fallback'
}

/**
 * Product-agnostic context gate.
 *
 * The gate's only job is to decide whether the user gave enough of a brief to
 * start designing *some* product. It is intentionally permissive: any concrete
 * description of a device and what it should do is enough. We do NOT require
 * smart-city specific fields (city / site / mounting surface) — those are just
 * one product domain. When information is genuinely missing the chat can ask
 * follow-up questions reactively instead of blocking on a fixed checklist.
 */

// A brief is designable once it has a handful of meaningful words. Below this we
// ask one open question instead of guessing.
const MIN_MEANINGFUL_WORDS = 4

const GENERIC_QUESTIONS: ContextGateQuestion[] = [
  {
    id: 'brief',
    question:
      'What should I design, and what should it do? A short description of the product and its purpose is enough to start.',
  },
  {
    id: 'context',
    question:
      'Where or how will it be used? Any constraints (environment, power, size, budget) help, but are optional.',
  },
]

function normalizeForMatching(value: string) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

function meaningfulWordCount(value: string) {
  return value
    .split(/\s+/)
    .filter((word) => word.replace(/[^a-z0-9]/gi, '').length >= 2).length
}

function canonicalFieldId(value: string) {
  return (
    normalizeForMatching(value)
      .trim()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'context'
  )
}

function delegatesContextChoice(prompt: string) {
  const normalized = normalizeForMatching(prompt)
  return [
    /\bjsp\b/,
    /\bje sais pas\b/,
    /\bje ne sais pas\b/,
    /\bfais comme tu veux\b/,
    /\bfait comme tu veux\b/,
    /\bcomme tu veux\b/,
    /\ba toi de choisir\b/,
    /\bchoisis\b/,
    /\bdecide for me\b/,
    /\bdo what you want\b/,
    /\bup to you\b/,
    /\buse defaults?\b/,
    /\bi don'?t know\b/,
    /\bnot sure\b/,
    /\bany product\b/,
    /\bwhatever\b/,
  ].some((pattern) => pattern.test(normalized))
}

/**
 * Deterministic fallback gate. Used when no LLM key is set or the LLM gate
 * fails. It errs toward `ready` for any non-trivial brief — the goal is to let
 * the pipeline attempt a design, not to interrogate the user.
 */
export function evaluateContextGate(prompt: string): ContextGateResult {
  const canonicalPrompt = prompt.trim()
  const words = meaningfulWordCount(canonicalPrompt)
  const delegated = delegatesContextChoice(canonicalPrompt)

  // Enough substance to design something, or the user explicitly told us to use
  // our judgement on top of an existing brief.
  if (words >= MIN_MEANINGFUL_WORDS || (delegated && words >= 2)) {
    return {
      status: 'ready',
      canonicalPrompt,
      missingFields: [],
      questions: [],
      confidence: 0.76,
      source: 'fallback',
    }
  }

  return {
    status: 'needs_input',
    canonicalPrompt,
    missingFields: ['brief'],
    questions: GENERIC_QUESTIONS.slice(0, words === 0 ? 2 : 1),
    confidence: 0.4,
    source: 'fallback',
  }
}

export function normalizeContextGateResult(
  value: Partial<ContextGateResult>,
  prompt: string
): ContextGateResult {
  const fallback = evaluateContextGate(prompt)

  const questions = Array.isArray(value.questions)
    ? value.questions
        .filter((item) => item?.id && item?.question)
        .slice(0, 3)
        .map((item) => ({ id: canonicalFieldId(String(item.id)), question: String(item.question) }))
    : fallback.questions

  const missingFields = Array.isArray(value.missingFields)
    ? value.missingFields.map((field) => canonicalFieldId(String(field)))
    : fallback.missingFields

  // If the deterministic gate already considers the brief designable, never let
  // an over-cautious LLM block it with another round of questions.
  const status: ContextGateResult['status'] =
    fallback.status === 'ready'
      ? 'ready'
      : value.status === 'ready'
        ? 'ready'
        : value.status === 'needs_input' && questions.length > 0
          ? 'needs_input'
          : fallback.status

  const rawConfidence =
    typeof value.confidence === 'number' && Number.isFinite(value.confidence)
      ? Math.max(0, Math.min(1, value.confidence))
      : fallback.confidence
  const confidence = status === 'ready' ? Math.max(rawConfidence, 0.7) : rawConfidence

  const canonicalPrompt =
    value.canonicalPrompt?.trim() || fallback.canonicalPrompt || prompt.trim()

  return {
    status,
    canonicalPrompt,
    missingFields: status === 'ready' ? [] : missingFields,
    questions: status === 'ready' ? [] : questions.length > 0 ? questions : fallback.questions,
    confidence,
    source: value.source === 'llm' ? 'llm' : fallback.source,
  }
}

export function formatContextQuestions(result: ContextGateResult): string {
  if (result.status === 'ready') return 'I have enough to start designing this.'
  return [
    'I need a bit more context before I start designing.',
    ...result.questions.map((item, index) => `${index + 1}. ${item.question}`),
  ].join('\n')
}
