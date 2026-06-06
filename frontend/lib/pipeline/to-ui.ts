import type { ContextField, BOMRow as UIBOMRow, Component3D, SimulationWarning } from '../types'
import type { GbaRouteDisplay, PipelineState, SceneNode, SupplierGraph } from './types'

export function deploymentContextToFields(ctx: PipelineState['deploymentContext']): ContextField[] {
  return [
    { label: 'City', value: ctx.city },
    { label: 'Site', value: ctx.site },
    { label: 'Surface', value: ctx.surface },
    { label: 'Regulation', value: ctx.regulation ?? '—' },
    { label: 'Environment', value: ctx.environment.join(', ') || '—' },
    { label: 'Mounting', value: ctx.mounting.join(', ') || '—' },
    { label: 'Power', value: ctx.power.join(', ') || '—' },
    { label: 'Connectivity', value: ctx.connectivity.join(', ') || '—' },
    { label: 'Privacy', value: ctx.privacy.join(', ') || '—' },
    { label: 'Goal', value: ctx.goal },
  ]
}

export function formatNodeTitle(nodeType: string): string {
  return nodeType
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function bomToUI(state: PipelineState): UIBOMRow[] {
  const baseline = new Set(state.baselineComponentIds)
  return state.bom.rows.map((row) => ({
    id: row.component_id,
    part: row.part,
    supplierRoute: row.supplier_route,
    cost: row.cost_usd,
    componentId: row.scene_id ?? row.component_id,
    isNew: state.fixApplied && !baseline.has(row.component_id),
  }))
}

export function sceneToUI(nodes: SceneNode[]): Component3D[] {
  return nodes.map((n) => ({
    id: n.scene_id,
    label: n.label,
    position: n.position,
    explodeOffset: n.explodeOffset,
    color: n.color,
    geometry: n.geometry,
    scale: n.scale,
  }))
}

export function gbaRouteToUI(
  rfq: PipelineState['rfq'],
  supplierGraph: SupplierGraph
): GbaRouteDisplay[] {
  return rfq.gba_route.map((step) => ({
    ...step,
    suppliers: supplierGraph.suppliers
      .filter((s) => s.stop === step.stop)
      .map((s) => ({ name: s.name, city: s.city, scope: s.scope })),
  }))
}

export function primaryWarningToUI(state: PipelineState): SimulationWarning | null {
  const w = state.dfma.warnings[0]
  if (!w) return null

  const fixComponentIds = [
    ...w.fix.add_component_ids,
    ...(w.fix.add_scene_only_ids ?? []),
  ]

  const costDelta = state.fixApplied
    ? state.bom.total_cost_usd - state.baselineBomTotal
    : w.fix.cost_delta_usd

  return {
    id: w.id,
    category: w.category,
    severity: w.severity,
    title: w.title,
    explanation: w.explanation,
    affectedComponents: w.affected_component_ids
      .map((id) => state.bom.rows.find((r) => r.component_id === id)?.scene_id)
      .filter((id): id is string => !!id),
    fix: {
      label: w.fix.label,
      componentChanges: fixComponentIds.map((id) => {
        const row = state.bom.rows.find((r) => r.component_id === id)
        return { id: row?.scene_id ?? id, note: 'added by Apply Fix' }
      }),
      bomChanges: w.fix.add_component_ids.map((id) => {
        const row = state.bom.rows.find((r) => r.component_id === id)
        return {
          part: row?.part ?? id,
          supplierRoute: row?.supplier_route ?? '',
          cost: row?.cost_usd ?? 0,
          isNew: true,
        }
      }),
      costDelta,
      rfqQuestionsAdded: state.rfq.supplier_questions
        .filter((q) => w.fix.rfq_topic_tags.includes(q.topic))
        .map((q) => q.question),
    },
  }
}

export function rfqQuestionsToUI(state: PipelineState): string[] {
  return state.rfq.supplier_questions.map((q) => q.question)
}
