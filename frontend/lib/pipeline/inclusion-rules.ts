import selectionRules from '../../data/component-selection-rules.json'
import type { ComponentCatalog, ComponentGraph, DeploymentContext } from './types'

type SelectionRule = {
  id: string
  keywords: string[]
  component_ids?: string[]
  select_tags?: string[]
}

type SelectionRulesFile = {
  rules: SelectionRule[]
  compute: {
    component_id: string
    keywords: string[]
  }
}

const RULES = selectionRules as SelectionRulesFile

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

function promptMentions(lower: string, keywords: string[]): boolean {
  return keywords.some((k) => lower.includes(k))
}

function contextText(ctx: DeploymentContext): string {
  return [
    ctx.city,
    ctx.site,
    ctx.surface,
    ctx.goal,
    ctx.regulation ?? '',
    ...ctx.environment,
    ...ctx.mounting,
    ...ctx.power,
    ...ctx.connectivity,
    ...ctx.privacy,
  ]
    .join(' ')
    .toLowerCase()
}

function addIfExists(catalogIds: Set<string>, selected: Set<string>, id: string) {
  if (catalogIds.has(id)) selected.add(id)
}

function addMany(catalogIds: Set<string>, selected: Set<string>, ids: string[]) {
  for (const id of ids) addIfExists(catalogIds, selected, id)
}

function selectFromCatalogTags(
  catalog: ComponentCatalog,
  tag: string,
  selected: Set<string>,
  ctx: DeploymentContext
) {
  for (const c of catalog.components) {
    if (c.category === 'fix') continue
    if (c.tags.includes('privacy-sensitive') && !wantsCamera(ctx)) continue
    if (c.tags.includes(tag) && c.category !== 'fix') selected.add(c.id)
  }
}

function applySelectionRules(
  ctx: DeploymentContext,
  catalog: ComponentCatalog,
  selected: Set<string>
) {
  const fullText = contextText(ctx)
  const catalogIds = new Set(catalog.components.map((c) => c.id))

  for (const rule of RULES.rules) {
    if (!promptMentions(fullText, rule.keywords)) continue

    addMany(catalogIds, selected, rule.component_ids ?? [])
    for (const tag of rule.select_tags ?? []) {
      selectFromCatalogTags(catalog, tag, selected, ctx)
    }
  }

  const needsCompute = selected.size > 0 && promptMentions(fullText, RULES.compute.keywords)
  if (needsCompute) addIfExists(catalogIds, selected, RULES.compute.component_id)
}

export function ruleBasedComponentGraph(
  ctx: DeploymentContext,
  catalog: ComponentCatalog
): ComponentGraph {
  const catalogIds = new Set(catalog.components.map((c) => c.id))
  const selected = new Set<string>()
  applySelectionRules(ctx, catalog, selected)

  excludeCameraUnlessRequested(ctx, selected)
  for (const id of [...selected]) {
    if (!catalogIds.has(id)) selected.delete(id)
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
