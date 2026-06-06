import fs from 'fs'
import path from 'path'
import { resolveBOM } from '@/lib/pipeline/bom-resolver'
import { resolveCompliance } from '@/lib/pipeline/compliance-resolver'
import { runDfmaEngine } from '@/lib/pipeline/dfma-engine'
import { loadSupplierGraph } from '@/lib/pipeline/load-data'
import { buildRfqPackDeterministic } from '@/lib/pipeline/rfq-agent'
import { resolveAssemblyPattern } from '@/lib/pipeline/assembly-resolver'
import { resolveScene } from '@/lib/pipeline/scene-resolver'
import { gbaRouteToUI } from '@/lib/pipeline/to-ui'
import type {
  CatalogComponent,
  ComponentCatalog,
  DeploymentContext,
  PipelineState,
} from '@/lib/pipeline/types'

type DemoObject = {
  demo_prompt: string
  deployment_context: DeploymentContext
  component_graph: {
    node_type: string
    base_component_ids: string[]
  }
  components: CatalogComponent[]
  fix_components: CatalogComponent[]
}

function demoObjectPath() {
  const candidates = [
    path.resolve(process.cwd(), 'demo-object.json'),
    path.resolve(process.cwd(), '..', 'demo-object.json'),
  ]

  const found = candidates.find((candidate) => fs.existsSync(candidate))
  if (!found) throw new Error('demo-object.json not found')
  return found
}

function loadDemoObject(): DemoObject {
  return JSON.parse(fs.readFileSync(demoObjectPath(), 'utf-8')) as DemoObject
}

function buildDemoPipelineState(demoObject: DemoObject): PipelineState {
  const selectedComponentIds = demoObject.component_graph.base_component_ids
  const catalog: ComponentCatalog = {
    components: [...demoObject.components, ...demoObject.fix_components],
  }
  const componentGraph = {
    node_type: demoObject.component_graph.node_type,
    selected_component_ids: selectedComponentIds,
  }
  const supplierGraph = loadSupplierGraph()
  const bom = resolveBOM(componentGraph, catalog)
  const dfma = runDfmaEngine(demoObject.deployment_context, componentGraph, bom, catalog)
  const rfq = buildRfqPackDeterministic(componentGraph, dfma, supplierGraph, false)

  return {
    prompt: demoObject.demo_prompt,
    deploymentContext: demoObject.deployment_context,
    compliance: resolveCompliance(demoObject.deployment_context),
    componentGraph,
    assembly: resolveAssemblyPattern(demoObject.deployment_context, componentGraph),
    bom,
    dfma,
    rfq,
    scene: resolveScene(componentGraph, catalog),
    fixApplied: false,
    appliedWarningId: null,
    usedDeterministic: true,
    baselineComponentIds: selectedComponentIds,
    baselineBomTotal: bom.total_cost_usd,
    extraComponents: [],
    gbaRouteDisplay: gbaRouteToUI(rfq, supplierGraph),
    mcpToolCalls: [],
    agentTrace: [],
    pipelineStatus: 'complete',
    interruption: null,
  }
}

export async function GET() {
  try {
    return Response.json(buildDemoPipelineState(loadDemoObject()))
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'failed to load demo project' },
      { status: 500 }
    )
  }
}
