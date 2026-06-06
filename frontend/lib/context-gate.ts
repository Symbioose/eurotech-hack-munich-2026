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

const FIELD_CHECKS: {
  id: string
  required: boolean
  question: string
  matches: RegExp[]
}[] = [
  {
    id: 'city',
    required: true,
    question: 'Which city or jurisdiction is this device for?',
    matches: [/hong kong|hk\b|singapore|shenzhen|munich|tokyo|seoul|san francisco|dubai/i],
  },
  {
    id: 'site',
    required: true,
    question: 'What kind of site is it: residential building, MTR station, mall, airport, bridge, street, tunnel or something else?',
    matches: [/building|station|mall|airport|bridge|street|tunnel|port|road|school|hospital|warehouse|facade/i],
  },
  {
    id: 'surface',
    required: true,
    question: 'Where would the node be mounted: facade, ceiling, pole, wall, roof, floor, street furniture or another surface?',
    matches: [/facade|ceiling|pole|wall|roof|floor|street furniture|platform|outdoor|indoor/i],
  },
  {
    id: 'goal',
    required: true,
    question: 'What should the node detect or measure, and what decision should it trigger?',
    matches: [/monitor|detect|measure|track|warning|alert|inspect|predict|count|sense/i],
  },
  {
    id: 'power',
    required: false,
    question: 'What power constraint should I assume: battery, mains, PoE, solar, or unknown?',
    matches: [/battery|mains|poe|power over ethernet|solar|usb|wired power/i],
  },
  {
    id: 'connectivity',
    required: false,
    question: 'What connectivity should I assume: LoRa, NB-IoT, Wi-Fi, Ethernet, 4G/5G, or unknown?',
    matches: [/lora|nb-iot|nbiot|wi-?fi|ethernet|4g|5g|lte|cellular|bluetooth|zigbee/i],
  },
  {
    id: 'privacy',
    required: false,
    question: 'Are cameras or biometric sensing allowed, or should this be privacy-preserving by design?',
    matches: [/no camera|camera|privacy|biometric|facial|face|anonymous|mmwave|thermal/i],
  },
]

function fieldPresent(prompt: string, matches: RegExp[]) {
  return matches.some((pattern) => pattern.test(prompt))
}

export function evaluateContextGate(prompt: string): ContextGateResult {
  const canonicalPrompt = prompt.trim()
  const missing = FIELD_CHECKS.filter((field) => !fieldPresent(canonicalPrompt, field.matches))
  const requiredMissing = missing.filter((field) => field.required)
  const shouldAsk = canonicalPrompt.length < 80 || requiredMissing.length > 0
  const questionSources = shouldAsk ? [...requiredMissing, ...missing.filter((field) => !field.required)] : []
  const presentRatio = (FIELD_CHECKS.length - missing.length) / FIELD_CHECKS.length
  const confidence = shouldAsk ? Math.min(0.65, presentRatio) : Math.max(0.72, presentRatio)

  if (!shouldAsk) {
    return {
      status: 'ready',
      canonicalPrompt,
      missingFields: [],
      questions: [],
      confidence,
      source: 'fallback',
    }
  }

  return {
    status: 'needs_input',
    canonicalPrompt,
    missingFields: missing.map((field) => field.id),
    questions: questionSources.slice(0, 3).map((field) => ({
      id: field.id,
      question: field.question,
    })),
    confidence,
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
        .map((item) => ({ id: String(item.id), question: String(item.question) }))
    : fallback.questions
  const missingFields = Array.isArray(value.missingFields)
    ? value.missingFields.map(String)
    : fallback.missingFields
  const confidence =
    typeof value.confidence === 'number' && Number.isFinite(value.confidence)
      ? Math.max(0, Math.min(1, value.confidence))
      : fallback.confidence
  const status =
    value.status === 'ready' && missingFields.length === 0 && confidence >= 0.7
      ? 'ready'
      : value.status === 'needs_input' || questions.length > 0 || missingFields.length > 0
        ? 'needs_input'
        : fallback.status

  return {
    status,
    canonicalPrompt: value.canonicalPrompt?.trim() || fallback.canonicalPrompt,
    missingFields,
    questions: status === 'ready' ? [] : questions,
    confidence,
    source: value.source === 'llm' ? 'llm' : fallback.source,
  }
}

export function formatContextQuestions(result: ContextGateResult): string {
  if (result.status === 'ready') return 'I have enough context to start the expert agents.'
  return [
    'I need a bit more context before I call the expert agents.',
    ...result.questions.map((item, index) => `${index + 1}. ${item.question}`),
  ].join('\n')
}
