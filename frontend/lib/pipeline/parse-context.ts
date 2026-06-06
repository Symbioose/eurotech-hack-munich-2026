import type { DeploymentContext } from './types'

function pickCity(lower: string): string {
  if (lower.includes('hong kong') || /\bhk\b/.test(lower)) return 'Hong Kong'
  if (lower.includes('singapore')) return 'Singapore'
  if (lower.includes('shenzhen')) return 'Shenzhen'
  if (lower.includes('munich')) return 'Munich'
  return 'Unknown'
}

function pickEnvironment(lower: string): string[] {
  const env: string[] = []
  if (lower.includes('humid') || lower.includes('moisture')) env.push('humidity')
  if (lower.includes('rain') || lower.includes('storm')) env.push('rain')
  if (lower.includes('typhoon') || lower.includes('wind')) env.push('typhoon wind')
  if (lower.includes('pollution') || lower.includes('urban')) env.push('pollution')
  return env
}

/** Rule-based context extraction — parses the prompt text, no fixed demo values. */
export function parseContextFromPrompt(prompt: string): DeploymentContext {
  const lower = prompt.toLowerCase()
  const yearMatch = lower.match(/(\d+)-year-old/)
  const site = yearMatch
    ? `${yearMatch[1]}-year-old ${lower.includes('residential') ? 'residential' : ''} building`.trim()
    : prompt.split(/[.!?]/)[0]?.slice(0, 80).trim() || 'Urban site'

  const surface = lower.includes('facade')
    ? 'outdoor facade'
    : lower.includes('roof')
      ? 'outdoor rooftop'
      : lower.includes('indoor') || lower.includes('ceiling')
        ? 'indoor ceiling'
        : lower.includes('outdoor')
          ? 'outdoor'
          : 'unknown surface'

  const privacy: string[] = []
  if (lower.includes('no camera') || lower.includes('without camera')) privacy.push('no camera')
  if (lower.includes('no audio')) privacy.push('no audio')
  if (!lower.includes('camera') && !lower.includes('video')) {
    privacy.push('no camera')
  }
  if (privacy.length === 0 && (lower.includes('structural') || lower.includes('sensor'))) {
    privacy.push('structural data only')
  }

  const power: string[] = []
  if (lower.includes('battery')) power.push('battery-powered')
  if (lower.includes('poe') || lower.includes('power over ethernet')) power.push('PoE')
  if (lower.includes('mains')) power.push('mains power')
  if (lower.includes('no mains') || lower.includes('without mains')) power.push('no mains assumed')
  if (lower.includes('solar')) power.push('solar-assisted')
  if (power.length === 0 && lower.includes('low-maintenance') && lower.includes('facade')) {
    power.push('battery-powered')
    power.push('no mains assumed')
  }

  const connectivity: string[] = []
  if (lower.includes('lora')) connectivity.push('LoRa')
  if (lower.includes('nb-iot') || lower.includes('nb iot')) connectivity.push('NB-IoT')
  if (lower.includes('wifi')) connectivity.push('Wi-Fi')
  if (
    connectivity.length === 0 &&
    lower.includes('facade') &&
    (lower.includes('sensor') || lower.includes('early warning'))
  ) {
    connectivity.push('LoRa')
    connectivity.push('NB-IoT')
  }

  const environment = pickEnvironment(lower)

  return {
    city: pickCity(lower),
    site,
    surface,
    regulation:
      lower.includes('mandatory building inspection') || lower.includes('mbis')
        ? 'Mandatory Building Inspection Scheme'
        : null,
    environment,
    climate: {
      humidity: environment.includes('humidity') ? 'high' : null,
      rainfall: environment.includes('rain') ? 'heavy' : null,
      wind: environment.includes('typhoon wind') ? 'typhoon-exposed' : null,
    },
    mounting: lower.includes('facade')
      ? ['facade-mounted', 'low-maintenance', 'limited access']
      : lower.includes('mount')
        ? ['surface-mounted']
        : [],
    power,
    connectivity,
    privacy,
    goal: prompt.split(/[.!?]/).slice(-2).join('. ').slice(0, 120).trim() || 'monitor urban conditions',
  }
}
