import { loadAssemblyPatterns } from './load-data'
import type { AssemblyPattern, AssemblyPatternResult, ComponentGraph, DeploymentContext } from './types'

function scoreKeywords(value: string, keywords: string[] = []): number {
  const lower = value.toLowerCase()
  return keywords.reduce(
    (score, keyword) => score + (lower.includes(keyword.toLowerCase()) ? 1 : 0),
    0
  )
}

function scorePattern(ctx: DeploymentContext, pattern: AssemblyPattern): number {
  return (
    scoreKeywords(ctx.surface, pattern.applies_when.surface_keywords) +
    scoreKeywords(ctx.power.join(' '), pattern.applies_when.power_keywords) +
    scoreKeywords(ctx.privacy.join(' '), pattern.applies_when.privacy_keywords) +
    scoreKeywords(ctx.goal, pattern.applies_when.goal_keywords)
  )
}

export function resolveAssemblyPattern(
  ctx: DeploymentContext,
  graph: ComponentGraph
): AssemblyPatternResult {
  const patterns = loadAssemblyPatterns().patterns
  const pattern =
    [...patterns].sort((a, b) => scorePattern(ctx, b) - scorePattern(ctx, a))[0] ??
    patterns[0]

  const selected = new Set(graph.selected_component_ids)
  const missing = pattern.required_component_ids.filter((id) => !selected.has(id))

  return {
    pattern_id: pattern.id,
    label: pattern.label,
    required_component_ids: pattern.required_component_ids,
    recommended_component_ids: pattern.recommended_component_ids,
    missing_required_component_ids: missing,
    constraints: pattern.constraints,
    assembly_steps: pattern.assembly_steps,
  }
}
