import type { ComponentCatalog, ComponentGraph, SceneGraph } from './types'

export function resolveScene(graph: ComponentGraph, catalog: ComponentCatalog): SceneGraph {
  const byId = new Map(catalog.components.map((c) => [c.id, c]))
  const nodes = graph.selected_component_ids
    .map((id) => byId.get(id))
    .filter((c): c is NonNullable<typeof c> => !!c && !!c.scene)
    .map((c) => ({
      component_id: c.id,
      scene_id: c.scene!.scene_id,
      label: c.scene!.label,
      position: c.scene!.position,
      explodeOffset: c.scene!.explodeOffset,
      color: c.scene!.color,
      geometry: c.scene!.geometry,
      scale: c.scene!.scale,
    }))

  return { nodes }
}
