import { loadAssemblyPatterns, loadCatalog } from './load-data'
import type { AssemblyPattern, AssemblyPatternResult, ComponentGraph, DeploymentContext } from './types'

function scoreKeywords(value: string, keywords: string[] = []): number {
  const lower = value.toLowerCase()
  return keywords.reduce(
    (score, keyword) => score + (lower.includes(keyword.toLowerCase()) ? 1 : 0),
    0
  )
}

function selectedTags(graph: ComponentGraph): Set<string> {
  const catalog = loadCatalog()
  const byId = new Map(catalog.components.map((component) => [component.id, component]))
  return new Set(graph.selected_component_ids.flatMap((id) => byId.get(id)?.tags ?? []))
}

function scoreTagOverlap(tags: Set<string>, pattern: AssemblyPattern): number {
  const keywords = [
    ...(pattern.applies_when.surface_keywords ?? []),
    ...(pattern.applies_when.power_keywords ?? []),
    ...(pattern.applies_when.privacy_keywords ?? []),
    ...(pattern.applies_when.goal_keywords ?? []),
  ]
  return keywords.filter((keyword) => tags.has(keyword)).length * 2
}

function scorePattern(ctx: DeploymentContext, graph: ComponentGraph, pattern: AssemblyPattern): number {
  return (
    scoreKeywords(ctx.surface, pattern.applies_when.surface_keywords) +
    scoreKeywords(ctx.power.join(' '), pattern.applies_when.power_keywords) +
    scoreKeywords(ctx.privacy.join(' '), pattern.applies_when.privacy_keywords) +
    scoreKeywords(ctx.goal, pattern.applies_when.goal_keywords) +
    scoreTagOverlap(selectedTags(graph), pattern)
  )
}

export function resolveAssemblyPattern(
  ctx: DeploymentContext,
  graph: ComponentGraph
): AssemblyPatternResult {
  const patterns = loadAssemblyPatterns().patterns
  const pattern =
    [...patterns].sort((a, b) => scorePattern(ctx, graph, b) - scorePattern(ctx, graph, a))[0] ??
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
