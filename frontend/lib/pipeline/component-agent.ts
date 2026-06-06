import type { ComponentCatalog, ComponentGraph, DeploymentContext } from './types'
import { extractJsonObject } from './parse-json'
import { ruleBasedComponentGraph, validateComponentGraph } from './inclusion-rules'
import { callJsonAgent, hasOpenAIKey } from './llm'

const SYSTEM = `You are the Component Agent for Physical Cursor.

Receive a DeploymentContext and component catalog. Select which catalog components fit the context.

Output ONLY valid JSON:
{
  "node_type": string,
  "selected_component_ids": string[]
}

Rules:
- Only use component IDs from the catalog.
- Do NOT invent components.
- Do NOT assign prices.
- If privacy includes "no camera", exclude camera-module.
- Outdoor facade requires weatherproof-enclosure and mounting-bracket.
- Battery-powered requires battery-pack.
- Do not explain your reasoning.`

export async function runComponentAgent(
  ctx: DeploymentContext,
  catalog: ComponentCatalog
): Promise<ComponentGraph> {
  if (!hasOpenAIKey()) {
    return ruleBasedComponentGraph(ctx, catalog)
  }

  const catalogSummary = catalog.components.map((c) => ({
    id: c.id,
    category: c.category,
    tags: c.tags,
  }))

  const text = await callJsonAgent(
    SYSTEM,
    `DeploymentContext:\n${JSON.stringify(ctx, null, 2)}\n\nCatalog:\n${JSON.stringify(catalogSummary, null, 2)}`
  )

  const graph = extractJsonObject<ComponentGraph>(text)
  return validateComponentGraph(graph, ctx, catalog)
}
