import type {
  CatalogComponent,
  ComponentCatalog,
  ComponentGraph,
  DeploymentContext,
} from './types'
import { extractJsonObject } from './parse-json'
import { ruleBasedComponentGraph, validateComponentGraph } from './inclusion-rules'
import { callJsonAgent, hasOpenAIKey } from './llm'
import { makeUnverifiedComponent, type ProposedComponent } from './edit-resolver'

/** The component step output: catalog selection plus any unverified extras. */
export type ComponentSelection = {
  graph: ComponentGraph
  extraComponents: CatalogComponent[]
}

const SYSTEM = `You are the Component Agent for Manu. You design the parts list for ANY physical product (a sensor node, an appliance, a wearable, a robot — anything).

You receive a DeploymentContext (the product brief) and a component catalog.

Output ONLY valid JSON:
{
  "node_type": string,                  // short product type, e.g. "facade-sensor-node", "desk-air-purifier"
  "selected_component_ids": string[],   // ids that EXIST in the catalog and fit the product
  "proposed_components": [              // parts the product needs that are NOT in the catalog
    { "part": string, "category": string, "estimated_cost_usd": number }
  ]
}

Rules:
- Prefer catalog component ids whenever one fits the need. Only put ids that exist in the catalog in "selected_component_ids".
- For parts the catalog does not contain, add them to "proposed_components" with a realistic rough USD cost. These are treated as UNVERIFIED estimates.
- Catalog entries are seeded/source-status annotated, not guaranteed live-available. Do not call them "verified" unless source_status is "verified".
- Never invent prices for catalog components — the catalog owns those.
- Respect explicit constraints in the brief (e.g. "no camera" → do not add any camera).
- Choose the minimum sensible set of parts that makes a working product.
- Do not explain your reasoning.`

function tokens(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 3)
}

/**
 * True when a catalog part already covers this proposed part by name. Prevents
 * the LLM from re-proposing (as an unverified extra) something the catalog has,
 * which keeps well-covered designs like the demo node clean and catalog-grounded.
 */
function catalogAlreadyCovers(proposed: ProposedComponent, catalog: ComponentCatalog) {
  const proposedTokens = new Set(tokens(proposed.part))
  if (proposedTokens.size === 0) return false
  return catalog.components.some((component) =>
    tokens(component.part).some((token) => proposedTokens.has(token))
  )
}

function filterToCatalog(
  raw: { node_type?: string; selected_component_ids?: string[] },
  catalog: ComponentCatalog
): ComponentGraph {
  const catalogIds = new Set(catalog.components.map((c) => c.id))
  const selected = Array.isArray(raw.selected_component_ids)
    ? raw.selected_component_ids.filter((id) => typeof id === 'string' && catalogIds.has(id))
    : []
  return {
    node_type: raw.node_type?.trim() || 'custom-product',
    selected_component_ids: [...new Set(selected)],
  }
}

export async function runComponentAgent(
  ctx: DeploymentContext,
  catalog: ComponentCatalog,
  recommendedComponents: CatalogComponent[] = []
): Promise<ComponentSelection> {
  if (!hasOpenAIKey()) {
    return { graph: ruleBasedComponentGraph(ctx, catalog), extraComponents: [] }
  }

  const shortlist = recommendedComponents.length > 0 ? recommendedComponents : catalog.components
  const catalogSummary = shortlist.map((c) => ({
    id: c.id,
    part: c.part,
    category: c.category,
    tags: c.tags,
    source_status: c.source?.source_status ?? 'unknown',
  }))

  const text = await callJsonAgent(
    SYSTEM,
    [
      `DeploymentContext:\n${JSON.stringify(ctx, null, 2)}`,
      `Hardware MCP catalog shortlist:\n${JSON.stringify(catalogSummary, null, 2)}`,
      'Use the shortlist first. If a needed part is missing from the shortlist and no catalog id fits, put it in proposed_components as an unverified estimate.',
    ].join('\n\n'),
    1400
  )

  const raw = extractJsonObject<{
    node_type?: string
    selected_component_ids?: string[]
    proposed_components?: ProposedComponent[]
  }>(text)

  // Ground the LLM selection in the catalog. validateComponentGraph also folds
  // in the deterministic domain rules, which keeps known domains (e.g. the
  // outdoor facade demo) reliable; filterToCatalog is the plain fallback.
  const baseGraph = validateComponentGraph(
    filterToCatalog(raw, catalog),
    ctx,
    catalog
  )

  const taken = new Set<string>([
    ...catalog.components.map((c) => c.id),
    ...baseGraph.selected_component_ids,
  ])
  const extraComponents: CatalogComponent[] = []
  const selected = [...baseGraph.selected_component_ids]
  let index = 0

  for (const proposed of raw.proposed_components ?? []) {
    if (!proposed?.part || typeof proposed.part !== 'string') continue
    // Skip anything the catalog already covers — it should have been selected.
    if (catalogAlreadyCovers(proposed, catalog)) continue
    const component = makeUnverifiedComponent(proposed, taken, index++)
    taken.add(component.id)
    extraComponents.push(component)
    selected.push(component.id)
  }

  return {
    graph: { node_type: baseGraph.node_type, selected_component_ids: selected },
    extraComponents,
  }
}
