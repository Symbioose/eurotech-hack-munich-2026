import type {
  ComponentGraph,
  DeploymentContext,
  DfmaResult,
  RfqPack,
  SupplierGraph,
} from './types'
import { extractJsonObject } from './parse-json'
import { callJsonAgent, hasOpenAIKey } from './llm'

const SYSTEM = `You are the RFQ Agent for Physical Cursor.

Generate supplier questions and select the GBA pilot route from the provided supplier graph.

Output ONLY valid JSON:
{
  "supplier_questions": [
    { "topic": string, "question": string, "related_component_ids": string[] }
  ],
  "gba_route": [
    { "step": number, "role": string, "region": string, "supplier_id": string, "description": string }
  ]
}

Rules:
- Use ONLY supplier_id values from the supplier graph gba_route.
- Do NOT invent supplier names or prices.
- Questions must reference real component IDs from the ComponentGraph.
- Do not explain your reasoning.`

const GBA_REGION_KEYWORDS = [
  'hong kong',
  'hongkong',
  'hk',
  'shenzhen',
  'dongguan',
  'guangzhou',
  'macau',
  'macao',
  'zhuhai',
  'foshan',
  'greater bay',
]

/**
 * Pick the supplier route for the deployment. Greater Bay Area deployments use
 * the seeded GBA pilot route; anything else uses the region-neutral generic
 * route so we don't claim a Shenzhen supply chain for, say, a US product.
 * Defaults to the GBA route when no context is given (keeps the demo unchanged).
 */
export function selectSupplierRoute(
  supplierGraph: SupplierGraph,
  ctx?: DeploymentContext
): SupplierGraph['gba_route'] {
  if (!ctx || !supplierGraph.generic_route?.length) return supplierGraph.gba_route
  const haystack = `${ctx.city} ${ctx.site}`.toLowerCase()
  const isGba = GBA_REGION_KEYWORDS.some((keyword) => haystack.includes(keyword))
  return isGba ? supplierGraph.gba_route : supplierGraph.generic_route
}

export function buildRfqPackDeterministic(
  graph: ComponentGraph,
  dfma: DfmaResult,
  supplierGraph: SupplierGraph,
  fixApplied: boolean,
  ctx?: DeploymentContext
): RfqPack {
  const route = selectSupplierRoute(supplierGraph, ctx)
  const graphIds = new Set(graph.selected_component_ids)
  const questions = supplierGraph.base_rfq_questions.filter((q) =>
    q.related_component_ids.some((id) => graphIds.has(id))
  )

  for (const warning of dfma.warnings) {
    const tags = fixApplied ? warning.fix.rfq_topic_tags : warning.fix.rfq_topic_tags
    for (const tag of tags) {
      const template = supplierGraph.topic_rfq_templates[tag]
      if (template) {
        questions.push({
          topic: tag,
          question: template.question,
          related_component_ids: template.related_component_ids.filter((id) =>
            graphIds.has(id)
          ),
        })
      }
    }
  }

  if (fixApplied) {
    questions.push({
      topic: 'gasket',
      question: 'Gasket material and compression specification for IP67 facade seal?',
      related_component_ids: ['ip67-gasket-kit', 'weatherproof-enclosure'],
    })
    questions.push({
      topic: 'drainage',
      question: 'Drainage channel dimensions and slope for typhoon rain runoff?',
      related_component_ids: ['weatherproof-enclosure', 'drainage-lip'],
    })
  }

  const seen = new Set<string>()
  const uniqueQuestions = questions.filter((q) => {
    const key = q.question
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  return {
    supplier_questions: uniqueQuestions,
    gba_route: route.map((step) => ({
      step: step.step,
      role: step.role,
      region: step.region,
      supplier_id: step.supplier_id,
      stop: step.stop,
      description: step.description,
    })),
  }
}

export async function runRfqAgent(
  ctx: DeploymentContext,
  graph: ComponentGraph,
  dfma: DfmaResult,
  supplierGraph: SupplierGraph,
  fixApplied: boolean
): Promise<RfqPack> {
  if (!hasOpenAIKey()) {
    return buildRfqPackDeterministic(graph, dfma, supplierGraph, fixApplied, ctx)
  }

  const route = selectSupplierRoute(supplierGraph, ctx)

  const text = await callJsonAgent(
    SYSTEM,
    JSON.stringify(
      {
        deploymentContext: ctx,
        componentGraph: graph,
        dfmaWarnings: dfma.warnings.map((w) => ({
          id: w.id,
          rfq_topic_tags: w.fix.rfq_topic_tags,
        })),
        supplierGraph: {
          gba_route: route,
          base_rfq_questions: supplierGraph.base_rfq_questions,
        },
        fixApplied,
      },
      null,
      2
    )
  )

  const pack = extractJsonObject<RfqPack>(text)

  const allowedSuppliers = new Set(route.map((s) => s.supplier_id))
  pack.gba_route = route.map((step) => ({
    step: step.step,
    role: step.role,
    region: step.region,
    supplier_id: step.supplier_id,
    stop: step.stop,
    description: step.description,
  }))

  pack.supplier_questions = pack.supplier_questions.filter(
    (q) => q.related_component_ids.every((id) => graph.selected_component_ids.includes(id) || id.includes('gasket') || id.includes('membrane') || id.includes('drainage'))
  )

  if (pack.gba_route.some((s) => !allowedSuppliers.has(s.supplier_id))) {
    return buildRfqPackDeterministic(graph, dfma, supplierGraph, fixApplied, ctx)
  }

  if (pack.supplier_questions.length === 0) {
    return buildRfqPackDeterministic(graph, dfma, supplierGraph, fixApplied, ctx)
  }

  return pack
}
