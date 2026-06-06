import type { BOM, ComponentCatalog, ComponentGraph, DeploymentContext, DfmaResult } from './types'
import { loadDfmaRules } from './load-data'

function isOutdoor(ctx: DeploymentContext): boolean {
  const s = (ctx.surface ?? '').toLowerCase()
  return s.includes('outdoor') || s.includes('facade') || s.includes('exterior')
}

function hasHumidityExposure(ctx: DeploymentContext): boolean {
  return ctx.environment.some((e) => {
    const lower = e.toLowerCase()
    return lower.includes('humid') || lower.includes('rain') || lower.includes('typhoon')
  })
}

function fixCostFromCatalog(catalog: ComponentCatalog, ids: string[]): number {
  const byId = new Map(catalog.components.map((c) => [c.id, c]))
  return ids.reduce((sum, id) => sum + (byId.get(id)?.cost_usd ?? 0), 0)
}

function hasFixComponents(graph: ComponentGraph, fixIds: string[]): boolean {
  return fixIds.every((id) => graph.selected_component_ids.includes(id))
}

export function runDfmaEngine(
  ctx: DeploymentContext,
  graph: ComponentGraph,
  _bom: BOM,
  catalog: ComponentCatalog
): DfmaResult {
  const rules = loadDfmaRules()
  const warnings: DfmaResult['warnings'] = []
  const passed: string[] = []

  if (graph.selected_component_ids.includes('battery-pack')) {
    passed.push('BATTERY_PRESENT')
  }

  if (!graph.selected_component_ids.includes('camera-module')) {
    passed.push('NO_CAMERA_PRIVACY_OK')
  }

  for (const check of rules.checks) {
    const fixDef = rules.fix_catalog_ids[check.fix_key]
    if (!fixDef) continue

    const allFixIds = [...fixDef.add_component_ids, ...(fixDef.add_scene_only_ids ?? [])]
    const contextOk =
      (!check.requires_outdoor_surface || isOutdoor(ctx)) &&
      (!check.requires_humidity_exposure || hasHumidityExposure(ctx)) &&
      check.requires_any_component_ids.some((id) => graph.selected_component_ids.includes(id))

    if (!contextOk) continue

    if (!hasFixComponents(graph, fixDef.add_component_ids)) {
      const costDelta = fixCostFromCatalog(catalog, fixDef.add_component_ids)
      warnings.push({
        id: check.id,
        category: check.category,
        severity: check.severity,
        title: check.title,
        explanation: `Outdoor deployment with humidity exposure — missing weatherproofing components from catalog: ${fixDef.add_component_ids.join(', ')}.`,
        affected_component_ids: check.affected_component_ids,
        fix: {
          label: check.fix_label,
          add_component_ids: fixDef.add_component_ids,
          add_scene_only_ids: fixDef.add_scene_only_ids,
          cost_delta_usd: costDelta,
          rfq_topic_tags: check.rfq_topic_tags,
        },
      })
    } else {
      passed.push(`${check.id}_OK`)
    }
  }

  return { warnings, passed_checks: passed }
}
