import type { CatalogComponent, ComponentCatalog, ComponentGraph, SceneAssembly, SceneGraph } from './types'

export function inferSceneAssembly(component: CatalogComponent): SceneAssembly {
  const sceneId = component.scene?.scene_id ?? component.id
  const tags = new Set(component.tags)

  if (sceneId === 'enclosure') {
    return {
      placement: 'root',
      parent_scene_id: null,
      anchor_face: 'center',
      contact: 'reference-volume',
    }
  }

  if (sceneId === 'bracket') {
    return {
      placement: 'mount',
      parent_scene_id: 'enclosure',
      anchor_face: 'back',
      contact: 'surface-mounted',
    }
  }

  if (sceneId === 'solar') {
    return {
      placement: 'power-surface',
      parent_scene_id: 'enclosure',
      anchor_face: 'top',
      contact: 'surface-mounted',
    }
  }

  if (sceneId === 'gasket') {
    return {
      placement: 'seal',
      parent_scene_id: 'enclosure',
      anchor_face: 'front',
      contact: 'flush-mounted',
    }
  }

  if (sceneId === 'membrane') {
    return {
      placement: 'seal',
      parent_scene_id: 'moisture-sensor',
      anchor_face: 'front',
      contact: 'flush-mounted',
    }
  }

  if (sceneId === 'fasteners') {
    return {
      placement: 'fastener',
      parent_scene_id: 'bracket',
      anchor_face: 'front',
      contact: 'surface-mounted',
    }
  }

  if (sceneId === 'drainage-lip') {
    return {
      placement: 'drainage',
      parent_scene_id: 'enclosure',
      anchor_face: 'bottom',
      contact: 'edge-mounted',
    }
  }

  if (sceneId === 'cable-gland') {
    return {
      placement: 'external',
      parent_scene_id: 'enclosure',
      anchor_face: 'front',
      contact: 'pass-through',
    }
  }

  if (tags.has('crack') || tags.has('moisture') || tags.has('air-quality')) {
    return {
      placement: 'external',
      parent_scene_id: 'enclosure',
      anchor_face: 'front',
      contact: tags.has('crack') ? 'probe-mounted' : 'flush-mounted',
    }
  }

  if (tags.has('presence')) {
    return {
      placement: 'external',
      parent_scene_id: 'enclosure',
      anchor_face: 'front',
      contact: 'flush-mounted',
    }
  }

  if (component.category === 'power' && tags.has('battery')) {
    return {
      placement: 'internal',
      parent_scene_id: 'enclosure',
      anchor_face: 'inside',
      contact: 'tray-mounted',
    }
  }

  return {
    placement: 'internal',
    parent_scene_id: 'enclosure',
    anchor_face: 'inside',
    contact: 'standoff-mounted',
  }
}

/** A generic shell so products without a domain enclosure still render a body. */
function genericChassisNode(): SceneGraph['nodes'][number] {
  return {
    component_id: '__chassis__',
    scene_id: 'chassis',
    label: 'Chassis',
    position: [0, 0, 0],
    explodeOffset: [0, 0, 0],
    color: '#3a3a44',
    geometry: 'box',
    scale: [1.4, 1.4, 1.0],
    assembly: {
      placement: 'root',
      parent_scene_id: null,
      anchor_face: 'center',
      contact: 'reference-volume',
    },
  }
}

export function resolveScene(graph: ComponentGraph, catalog: ComponentCatalog): SceneGraph {
  const byId = new Map(catalog.components.map((c) => [c.id, c]))
  const nodes = graph.selected_component_ids
    .map((id) => byId.get(id))
    .filter((c): c is NonNullable<typeof c> => !!c && !!c.scene)
    .map((c) => ({
      component_id: c.id,
      scene_id: c.scene!.scene_id,
      label: c.scene!.label,
      category: c.category,
      tags: c.tags,
      position: c.scene!.position,
      explodeOffset: c.scene!.explodeOffset,
      color: c.scene!.color,
      geometry: c.scene!.geometry,
      scale: c.scene!.scale,
      assembly: c.scene!.assembly ?? inferSceneAssembly(c),
    }))

  if (nodes.length === 0) return { nodes }

  // If nothing is a root enclosure (e.g. a non-IoT product made of catalog
  // parts + unverified extras), give it a generic chassis and reparent any
  // orphans so the 3D view shows a coherent body instead of floating parts.
  const hasRoot = nodes.some((node) => node.assembly.placement === 'root')
  if (hasRoot) return { nodes }

  const presentSceneIds = new Set(nodes.map((node) => node.scene_id))
  const reparented = nodes.map((node) =>
    node.assembly.parent_scene_id && !presentSceneIds.has(node.assembly.parent_scene_id)
      ? { ...node, assembly: { ...node.assembly, parent_scene_id: 'chassis' } }
      : node
  )
  return { nodes: [genericChassisNode(), ...reparented] }
}
