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

const DEFAULT_DELEGATED_CONTEXT_PROMPT =
  'Assume a Hong Kong dense-city deployment: a battery-powered LoRa smart-city sensor node mounted on an outdoor concrete facade of a residential high-rise, detecting crack propagation, moisture ingress, vibration anomalies and tilt shifts, with no camera and privacy-preserving sensing.'

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

const REQUIRED_FIELD_IDS = new Set(
  FIELD_CHECKS.filter((field) => field.required).map((field) => field.id)
)
const FIELD_ID_ALIASES: Record<string, string> = {
  city: 'city',
  cityjurisdiction: 'city',
  jurisdiction: 'city',
  location: 'city',
  site: 'site',
  sitetype: 'site',
  site_type: 'site',
  type_of_site: 'site',
  surface: 'surface',
  mounting: 'surface',
  mountingsurface: 'surface',
  mount_surface: 'surface',
  mounting_surface: 'surface',
  installation_surface: 'surface',
  goal: 'goal',
  device_goal: 'goal',
  measured_signal: 'goal',
  measurement_goal: 'goal',
  signal: 'goal',
  power: 'power',
  power_constraint: 'power',
  connectivity: 'connectivity',
  network: 'connectivity',
  privacy: 'privacy',
  privacy_constraints: 'privacy',
}

function normalizeForMatching(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function fieldPresent(prompt: string, matches: RegExp[]) {
  const normalizedPrompt = normalizeForMatching(prompt)
  return matches.some((pattern) => pattern.test(normalizedPrompt))
}

function requiredMissingFields(fields: string[]) {
  return fields.filter((field) => REQUIRED_FIELD_IDS.has(field))
}

function canonicalFieldId(value: string) {
  const normalized = normalizeForMatching(value)
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return FIELD_ID_ALIASES[normalized] ?? normalized
}

function unique(values: string[]) {
  return Array.from(new Set(values))
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
  ].some((pattern) => pattern.test(normalized))
}

export function evaluateContextGate(prompt: string): ContextGateResult {
  const canonicalPrompt = prompt.trim()
  if (delegatesContextChoice(canonicalPrompt)) {
    return {
      status: 'ready',
      canonicalPrompt: DEFAULT_DELEGATED_CONTEXT_PROMPT,
      missingFields: [],
      questions: [],
      confidence: 0.74,
      source: 'fallback',
    }
  }

  const missing = FIELD_CHECKS.filter((field) => !fieldPresent(canonicalPrompt, field.matches))
  const requiredMissing = missing.filter((field) => field.required)
  const shouldAsk = requiredMissing.length > 0
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
    missingFields: requiredMissing.map((field) => field.id),
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
        .map((item) => ({ id: canonicalFieldId(String(item.id)), question: String(item.question) }))
    : fallback.questions
  const missingFields = Array.isArray(value.missingFields)
    ? value.missingFields.map((field) => canonicalFieldId(String(field)))
    : fallback.missingFields
  const requiredMissing = requiredMissingFields(missingFields)
  const requiredQuestionFields = requiredMissingFields(questions.map((question) => question.id))
  const fallbackRequiredMissing =
    value.status === 'ready' ? [] : requiredMissingFields(fallback.missingFields)
  const blockingFields = unique([
    ...requiredMissing,
    ...requiredQuestionFields,
    ...fallbackRequiredMissing,
  ])
  const rawConfidence =
    typeof value.confidence === 'number' && Number.isFinite(value.confidence)
      ? Math.max(0, Math.min(1, value.confidence))
      : fallback.confidence
  const confidence = fallback.status === 'ready' ? Math.max(rawConfidence, fallback.confidence) : rawConfidence
  const status =
    fallback.status === 'ready'
      ? 'ready'
      : value.status === 'ready' && requiredMissing.length === 0 && confidence >= 0.7
        ? 'ready'
      : value.status === 'needs_input' && blockingFields.length > 0
        ? 'needs_input'
        : blockingFields.length > 0
          ? 'needs_input'
          : fallback.status
  const canonicalPrompt =
    fallback.status === 'ready' && value.status !== 'ready'
      ? fallback.canonicalPrompt
      : value.canonicalPrompt?.trim() || fallback.canonicalPrompt

  return {
    status,
    canonicalPrompt,
    missingFields: status === 'ready' ? [] : blockingFields,
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
