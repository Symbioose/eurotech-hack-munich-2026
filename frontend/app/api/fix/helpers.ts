import { loadCatalog, loadSupplierGraph } from '@/lib/pipeline/load-data'
import { runDfmaEngine } from '@/lib/pipeline/dfma-engine'
import { resolveBOM } from '@/lib/pipeline/bom-resolver'
import { parseContextFromPrompt } from '@/lib/pipeline/parse-context'
import { ruleBasedComponentGraph } from '@/lib/pipeline/inclusion-rules'
import { buildRfqPackDeterministic } from '@/lib/pipeline/rfq-agent'
import { resolveScene } from '@/lib/pipeline/scene-resolver'
import { resolveCompliance } from '@/lib/pipeline/compliance-resolver'
import { resolveAssemblyPattern } from '@/lib/pipeline/assembly-resolver'
import { primaryWarningToUI, gbaRouteToUI } from '@/lib/pipeline/to-ui'
import type { PipelineState } from '@/lib/pipeline/types'
import type { SimulationWarning } from '@/lib/types'

export function getFixForWarning(warningId: string, prompt?: string): SimulationWarning['fix'] | null {
  const catalog = loadCatalog()
  const supplierGraph = loadSupplierGraph()
  const deploymentContext = parseContextFromPrompt(prompt ?? '')
  const compliance = resolveCompliance(deploymentContext)
  const componentGraph = ruleBasedComponentGraph(deploymentContext, catalog)
  const assembly = resolveAssemblyPattern(deploymentContext, componentGraph)
  const bom = resolveBOM(componentGraph, catalog)
  const dfma = runDfmaEngine(deploymentContext, componentGraph, bom, catalog)
  const warning = dfma.warnings.find((w) => w.id === warningId)
  if (!warning) return null

  const rfq = buildRfqPackDeterministic(componentGraph, dfma, supplierGraph, false)
  const scene = resolveScene(componentGraph, catalog)

  const state: PipelineState = {
    prompt: prompt ?? '',
    deploymentContext,
    compliance,
    componentGraph,
    assembly,
    bom,
    dfma,
    rfq,
    scene,
    fixApplied: false,
    appliedWarningId: null,
    usedDeterministic: true,
    baselineComponentIds: componentGraph.selected_component_ids,
    baselineBomTotal: bom.total_cost_usd,
    gbaRouteDisplay: gbaRouteToUI(rfq, supplierGraph),
    mcpToolCalls: [],
    agentTrace: [],
  }

  return primaryWarningToUI(state)?.fix ?? null
}
