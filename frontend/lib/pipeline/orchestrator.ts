import { runContextAgent } from './context-agent'
import { parseContextFromPrompt } from './parse-context'
import { runComponentAgent } from './component-agent'
import { ruleBasedComponentGraph } from './inclusion-rules'
import { resolveBOM } from './bom-resolver'
import { runDfmaEngine } from './dfma-engine'
import { buildRfqPackDeterministic, runRfqAgent } from './rfq-agent'
import { resolveScene } from './scene-resolver'
import { loadCatalog, loadSupplierGraph } from './load-data'
import { gbaRouteToUI } from './to-ui'
import { resolveCompliance } from './compliance-resolver'
import { resolveAssemblyPattern } from './assembly-resolver'
import { createAgentRuntime } from './agent-runtime'
import type {
  AssemblyPatternResult,
  ComponentGraph,
  ComplianceResult,
  PipelineState,
  RfqPack,
  SceneGraph,
} from './types'

export type StageEmitter = (stage: string, data: unknown) => void

function applyFixToGraph(
  graph: ComponentGraph,
  warningId: string,
  state: PipelineState
): ComponentGraph {
  const warning = state.dfma.warnings.find((w) => w.id === warningId)
  if (!warning) return graph

  const ids = new Set(graph.selected_component_ids)
  for (const id of warning.fix.add_component_ids) {
    ids.add(id)
  }
  for (const id of warning.fix.add_scene_only_ids ?? []) {
    ids.add(id)
  }

  return {
    ...graph,
    selected_component_ids: [...ids],
  }
}

async function runPipelineStages(
  prompt: string,
  catalog: ReturnType<typeof loadCatalog>,
  supplierGraph: ReturnType<typeof loadSupplierGraph>,
  emit: StageEmitter | undefined,
  options: {
    useLlm: boolean
    existing?: Partial<PipelineState>
  }
): Promise<PipelineState> {
  const runtime = createAgentRuntime()

  const deploymentContext = await runtime.runAgent('context_agent', 'Extract deployment context', () =>
    options.useLlm ? runContextAgent(prompt) : parseContextFromPrompt(prompt)
  )
  emit?.('context', deploymentContext)

  const compliance = await runtime.runAgent('compliance_hk_agent', 'Check deployability constraints', () =>
    runtime.callMcpWithFallback<ComplianceResult>(
      'compliance_hk_agent',
      'compliance.search_requirements',
      { deploymentContext },
      () => resolveCompliance(deploymentContext)
    )
  )
  emit?.('compliance', compliance)

  const componentGraph = await runtime.runAgent('component_agent', 'Select electronics from catalog', () =>
    options.useLlm
      ? runComponentAgent(deploymentContext, catalog)
      : ruleBasedComponentGraph(deploymentContext, catalog)
  )
  emit?.('components', componentGraph)

  const assembly = await runtime.runAgent('hardware_expert_agent', 'Validate assembly pattern', () =>
    runtime.callMcpWithFallback<AssemblyPatternResult>(
      'hardware_expert_agent',
      'hardware.match_assembly_pattern',
      { deploymentContext, componentGraph },
      () => resolveAssemblyPattern(deploymentContext, componentGraph)
    )
  )
  emit?.('assembly', assembly)

  const bom = await runtime.runAgent('bom_agent', 'Build priced BOM', () =>
    resolveBOM(componentGraph, catalog)
  )
  emit?.('bom', bom)

  const dfma = await runtime.runAgent('dfma_agent', 'Check manufacturability risks', () =>
    runDfmaEngine(deploymentContext, componentGraph, bom, catalog)
  )
  emit?.('dfma', dfma)

  const rfq = await runtime.runAgent('supplier_gba_agent', 'Create GBA supplier route', () =>
    runtime.callMcpWithFallback<RfqPack>(
      'supplier_gba_agent',
      'supplier.route_bom_to_gba',
      {
        componentGraph,
        dfmaWarnings: dfma.warnings.map((w) => ({
          id: w.id,
          rfq_topic_tags: w.fix.rfq_topic_tags,
        })),
        fixApplied: false,
      },
      () =>
        options.useLlm
          ? runRfqAgent(deploymentContext, componentGraph, dfma, supplierGraph, false)
          : buildRfqPackDeterministic(componentGraph, dfma, supplierGraph, false)
    )
  )
  emit?.('rfq', rfq)

  const scene = await runtime.runAgent('scene_3d_agent', 'Create 3D scene graph', () =>
    runtime.callMcpWithFallback<SceneGraph>(
      'scene_3d_agent',
      'scene.generate_scene_graph',
      { componentGraph },
      () => resolveScene(componentGraph, catalog)
    )
  )
  emit?.('scene', scene)

  const baselineComponentIds =
    options.existing?.baselineComponentIds ?? componentGraph.selected_component_ids
  const baselineBomTotal = options.existing?.baselineBomTotal ?? bom.total_cost_usd

  const state: PipelineState = {
    prompt,
    deploymentContext,
    compliance,
    componentGraph,
    assembly,
    bom,
    dfma,
    rfq,
    scene,
    fixApplied: options.existing?.fixApplied ?? false,
    appliedWarningId: options.existing?.appliedWarningId ?? null,
    usedDeterministic: !options.useLlm,
    baselineComponentIds,
    baselineBomTotal,
    gbaRouteDisplay: gbaRouteToUI(rfq, supplierGraph),
    mcpToolCalls: runtime.mcpToolCalls,
    agentTrace: runtime.trace,
  }

  emit?.('complete', state)
  return state
}

export async function runDeterministicPipeline(
  prompt: string,
  emit?: StageEmitter
): Promise<PipelineState> {
  const catalog = loadCatalog()
  const supplierGraph = loadSupplierGraph()
  return runPipelineStages(prompt, catalog, supplierGraph, emit, { useLlm: false })
}

export async function runPipeline(
  prompt: string,
  emit?: StageEmitter
): Promise<PipelineState> {
  const catalog = loadCatalog()
  const supplierGraph = loadSupplierGraph()

  try {
    return await runPipelineStages(prompt, catalog, supplierGraph, emit, { useLlm: true })
  } catch (err) {
    console.error('[pipeline] LLM failed, using deterministic path:', err)
    const state = await runDeterministicPipeline(prompt, emit)
    emit?.('fallback', { reason: String(err) })
    return { ...state, usedDeterministic: true }
  }
}

export async function applyPipelineFix(
  state: PipelineState,
  warningId: string,
  emit?: StageEmitter
): Promise<PipelineState> {
  const catalog = loadCatalog()
  const supplierGraph = loadSupplierGraph()
  const runtime = createAgentRuntime()

  const componentGraph = await runtime.runAgent('component_agent', 'Apply selected DfMA fix', () =>
    applyFixToGraph(state.componentGraph, warningId, state)
  )
  emit?.('components', componentGraph)

  const assembly = await runtime.runAgent('hardware_expert_agent', 'Revalidate assembly pattern', () =>
    runtime.callMcpWithFallback<AssemblyPatternResult>(
      'hardware_expert_agent',
      'hardware.match_assembly_pattern',
      { deploymentContext: state.deploymentContext, componentGraph },
      () => resolveAssemblyPattern(state.deploymentContext, componentGraph)
    )
  )
  emit?.('assembly', assembly)

  const bom = await runtime.runAgent('bom_agent', 'Rebuild priced BOM', () =>
    resolveBOM(componentGraph, catalog)
  )
  emit?.('bom', bom)

  const dfma = await runtime.runAgent('dfma_agent', 'Recheck manufacturability risks', () =>
    runDfmaEngine(state.deploymentContext, componentGraph, bom, catalog)
  )
  emit?.('dfma', dfma)

  const rfq = await runtime.runAgent('supplier_gba_agent', 'Regenerate GBA supplier route', () =>
    runtime.callMcpWithFallback<RfqPack>(
      'supplier_gba_agent',
      'supplier.route_bom_to_gba',
      {
        componentGraph,
        dfmaWarnings: dfma.warnings.map((w) => ({
          id: w.id,
          rfq_topic_tags: w.fix.rfq_topic_tags,
        })),
        fixApplied: true,
      },
      () => runRfqAgent(state.deploymentContext, componentGraph, dfma, supplierGraph, true)
    )
  )
  emit?.('rfq', rfq)

  const scene = await runtime.runAgent('scene_3d_agent', 'Regenerate 3D scene graph', () =>
    runtime.callMcpWithFallback<SceneGraph>(
      'scene_3d_agent',
      'scene.generate_scene_graph',
      { componentGraph },
      () => resolveScene(componentGraph, catalog)
    )
  )
  emit?.('scene', scene)

  const updated: PipelineState = {
    ...state,
    componentGraph,
    assembly,
    bom,
    dfma,
    rfq,
    scene,
    fixApplied: true,
    appliedWarningId: warningId,
    gbaRouteDisplay: gbaRouteToUI(rfq, supplierGraph),
    mcpToolCalls: [...(state.mcpToolCalls ?? []), ...runtime.mcpToolCalls],
    agentTrace: [...(state.agentTrace ?? []), ...runtime.trace],
  }

  emit?.('complete', updated)
  return updated
}
