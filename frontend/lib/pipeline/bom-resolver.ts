import type { BOM, ComponentCatalog, ComponentGraph } from './types'

export function resolveBOM(graph: ComponentGraph, catalog: ComponentCatalog): BOM {
  const byId = new Map(catalog.components.map((c) => [c.id, c]))
  const rows = graph.selected_component_ids
    .map((id) => byId.get(id))
    .filter((c): c is NonNullable<typeof c> => !!c)
    .map((c) => ({
      component_id: c.id,
      part: c.part,
      supplier_route: c.supplier_route,
      cost_usd: c.cost_usd,
      scene_id: c.scene?.scene_id ?? null,
    }))

  const total_cost_usd = rows.reduce((sum, r) => sum + r.cost_usd, 0)

  return { rows, total_cost_usd }
}
