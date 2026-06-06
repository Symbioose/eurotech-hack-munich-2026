import type { ComponentCatalog, ComponentGraph, DeploymentContext } from './types'

const FIX_IDS = new Set([
  'ip67-gasket-kit',
  'ptfe-membrane',
  'drainage-lip',
  '316l-stainless-fasteners',
])

function nodeTypeFromContext(ctx: DeploymentContext): string {
  const surface = (ctx.surface ?? 'urban-site').replace(/\s+/g, '-').toLowerCase()
  return `${surface}-node`
}

function wantsCamera(ctx: DeploymentContext): boolean {
  const text = `${ctx.goal} ${ctx.privacy.join(' ')}`.toLowerCase()
  return (
    text.includes('camera') &&
    !text.includes('no camera') &&
    !text.includes('without camera')
  )
}

function excludeCameraUnlessRequested(
  ctx: DeploymentContext,
  selected: Set<string>
) {
  if (!wantsCamera(ctx)) {
    selected.delete('camera-module')
  }
}

function isOutdoorFacade(ctx: DeploymentContext): boolean {
  const surface = (ctx.surface ?? '').toLowerCase()
  return surface.includes('facade') || surface.includes('outdoor') || surface.includes('exterior')
}

function isBatteryPowered(ctx: DeploymentContext): boolean {
  return ctx.power.some((p) => p.toLowerCase().includes('battery'))
}

function wantsLoRa(ctx: DeploymentContext): boolean {
  return ctx.connectivity.some((c) => c.toLowerCase().includes('lora'))
}

function promptMentions(lower: string, keywords: string[]): boolean {
  return keywords.some((k) => lower.includes(k))
}

function selectFromCatalogTags(
  catalog: ComponentCatalog,
  tag: string,
  selected: Set<string>
) {
  for (const c of catalog.components) {
    if (c.tags.includes(tag) && c.category !== 'fix') selected.add(c.id)
  }
}

export function ruleBasedComponentGraph(
  ctx: DeploymentContext,
  catalog: ComponentCatalog
): ComponentGraph {
  const catalogIds = new Set(catalog.components.map((c) => c.id))
  const selected = new Set<string>()
  const lower = `${ctx.goal ?? ''} ${ctx.site ?? ''}`.toLowerCase()

  if (isOutdoorFacade(ctx)) {
    for (const c of catalog.components) {
      if (c.tags.includes('required-facade') || c.tags.includes('outdoor')) {
        if (catalogIds.has(c.id) && c.category !== 'fix') selected.add(c.id)
      }
    }
  }

  if (promptMentions(lower, ['crack'])) selectFromCatalogTags(catalog, 'crack', selected)
  if (promptMentions(lower, ['vibration'])) selectFromCatalogTags(catalog, 'vibration', selected)
  if (promptMentions(lower, ['tilt'])) selectFromCatalogTags(catalog, 'tilt', selected)
  if (promptMentions(lower, ['moisture', 'humidity', 'ingress']))
    selectFromCatalogTags(catalog, 'moisture', selected)

  if (catalogIds.has('edge-compute-board')) selected.add('edge-compute-board')

  if (wantsLoRa(ctx) && catalogIds.has('lora-nbiot-module')) {
    selected.add('lora-nbiot-module')
  }

  if (isBatteryPowered(ctx) && catalogIds.has('battery-pack')) {
    selected.add('battery-pack')
  }

  excludeCameraUnlessRequested(ctx, selected)
  if (
    promptMentions(lower, ['presence', 'mmwave', 'occupancy', 'crowd']) &&
    catalogIds.has('mmwave-presence')
  ) {
    selected.add('mmwave-presence')
  }

  return {
    node_type: nodeTypeFromContext(ctx),
    selected_component_ids: [...selected],
  }
}

export function validateComponentGraph(
  graph: ComponentGraph,
  ctx: DeploymentContext,
  catalog: ComponentCatalog
): ComponentGraph {
  const catalogIds = new Set(catalog.components.map((c) => c.id))
  const selected = new Set(
    graph.selected_component_ids.filter((id) => catalogIds.has(id) && !FIX_IDS.has(id))
  )

  const ruled = ruleBasedComponentGraph(ctx, catalog)
  for (const id of ruled.selected_component_ids) {
    selected.add(id)
  }

  excludeCameraUnlessRequested(ctx, selected)

  return {
    node_type: graph.node_type || nodeTypeFromContext(ctx),
    selected_component_ids: [...selected],
  }
}
