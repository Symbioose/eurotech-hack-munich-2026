import type { DeploymentContext } from './types'
import { parseContextFromPrompt } from './parse-context'

function str(value: string | null | undefined, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function arr(value: string[] | null | undefined, fallback: string[]): string[] {
  if (!Array.isArray(value) || value.length === 0) return fallback
  return value.filter((v) => typeof v === 'string' && v.trim()).map((v) => v.trim())
}

/** Fill null/empty LLM fields from prompt parsing so downstream rules never crash. */
export function normalizeDeploymentContext(
  raw: DeploymentContext,
  prompt: string
): DeploymentContext {
  const fallback = parseContextFromPrompt(prompt)

  return {
    city: str(raw.city, fallback.city),
    site: str(raw.site, fallback.site),
    surface: str(raw.surface, fallback.surface),
    regulation: raw.regulation?.trim() ? raw.regulation.trim() : fallback.regulation,
    environment: arr(raw.environment, fallback.environment),
    climate: {
      humidity: raw.climate?.humidity ?? fallback.climate.humidity,
      rainfall: raw.climate?.rainfall ?? fallback.climate.rainfall,
      wind: raw.climate?.wind ?? fallback.climate.wind,
    },
    mounting: arr(raw.mounting, fallback.mounting),
    power: arr(raw.power, fallback.power),
    connectivity: arr(raw.connectivity, fallback.connectivity),
    privacy: arr(raw.privacy, fallback.privacy),
    goal: str(raw.goal, fallback.goal),
  }
}
