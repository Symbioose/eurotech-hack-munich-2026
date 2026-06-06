import { loadComplianceRules } from './load-data'
import type { ComplianceResult, DeploymentContext } from './types'

function includesAny(value: string, keywords: string[] = []): boolean {
  const lower = value.toLowerCase()
  return keywords.some((keyword) => lower.includes(keyword.toLowerCase()))
}

function requirementApplies(
  ctx: DeploymentContext,
  appliesWhen: {
    site_keywords?: string[]
    surface_keywords?: string[]
    regulation_keywords?: string[]
    connectivity_keywords?: string[]
    privacy_keywords?: string[]
  }
): boolean {
  const checks = [
    appliesWhen.site_keywords
      ? includesAny(ctx.site, appliesWhen.site_keywords)
      : true,
    appliesWhen.surface_keywords
      ? includesAny(ctx.surface, appliesWhen.surface_keywords)
      : true,
    appliesWhen.regulation_keywords
      ? includesAny(ctx.regulation ?? '', appliesWhen.regulation_keywords)
      : true,
    appliesWhen.connectivity_keywords
      ? includesAny(ctx.connectivity.join(' '), appliesWhen.connectivity_keywords)
      : true,
    appliesWhen.privacy_keywords
      ? includesAny(ctx.privacy.join(' '), appliesWhen.privacy_keywords)
      : true,
  ]

  return checks.every(Boolean)
}

export function resolveCompliance(ctx: DeploymentContext): ComplianceResult {
  const rules = loadComplianceRules()
  const requirements = rules.requirements
    .filter((rule) => rule.city.toLowerCase() === ctx.city.toLowerCase())
    .filter((rule) => requirementApplies(ctx, rule.applies_when))
    .map((rule) => ({
      id: rule.id,
      city: rule.city,
      title: rule.title,
      constraint: rule.constraint,
      authority: rule.authority,
      source_url: rule.source_url,
      source_status: rule.source_status,
      last_checked_at: rule.last_checked_at,
      update_strategy: rule.update_strategy,
      risk_tags: rule.risk_tags,
    }))

  return { requirements }
}
