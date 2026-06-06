import { runContextAgent } from './context-agent'
import { parseContextFromPrompt } from './parse-context'
import { runComponentAgent } from './component-agent'
import { ruleBasedComponentGraph } from './inclusion-rules'
import { resolveBOM } from './bom-resolver'
import { runDfmaEngine } from './dfma-engine'
import { buildRfqPackDeterministic, runRfqAgent } from './rfq-agent'
import { loadCatalog, loadSupplierGraph } from './load-data'
import { gbaRouteToUI } from './to-ui'
import { resolveCompliance } from './compliance-resolver'
import { resolveAssemblyPattern } from './assembly-resolver'
import { resolveScene } from './scene-resolver'
import { resolveEditOps, type EditOp } from './edit-resolver'
import { createAgentRuntime } from './agent-runtime'
import type {
  AssemblyPatternResult,
  CatalogComponent,
  ComponentCatalog,
  ComponentGraph,
  ComplianceResult,
  PipelineState,
  RfqPack,
  SceneGraph,
} from './types'

function mergeCatalog(base: ComponentCatalog, extra: CatalogComponent[]): ComponentCatalog {
  const byId = new Map(base.components.map((component) => [component.id, component]))
  for (const component of extra) byId.set(component.id, component)
  return { components: [...byId.values()] }
}

export type StageEmitter = (stage: string, data: unknown) => void
export type PipelineRunOptions = {
  interruptOnRisk?: boolean
}

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
  } & PipelineRunOptions
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

  const componentSelection = await runtime.runAgent('component_agent', 'Select components', () =>
    options.useLlm
      ? runComponentAgent(deploymentContext, catalog)
      : Promise.resolve({
          graph: ruleBasedComponentGraph(deploymentContext, catalog),
          extraComponents: [] as CatalogComponent[],
        })
  )
  const componentGraph = componentSelection.graph
  const extraComponents = componentSelection.extraComponents
  // Catalog augmented with any unverified, LLM-proposed parts so they flow
  // through the BOM, DfMA check and 3D scene for non-catalog products.
  const workingCatalog = extraComponents.length ? mergeCatalog(catalog, extraComponents) : catalog
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
    resolveBOM(componentGraph, workingCatalog)
  )
  emit?.('bom', bom)

  const dfma = await runtime.runAgent('dfma_agent', 'Check manufacturability risks', () =>
    runDfmaEngine(deploymentContext, componentGraph, bom, workingCatalog)
  )
  emit?.('dfma', dfma)

  const blockingWarning = dfma.warnings.find((warning) => warning.severity === 'critical')
  if (options.interruptOnRisk && blockingWarning) {
    const baselineComponentIds =
      options.existing?.baselineComponentIds ?? componentGraph.selected_component_ids
    const baselineBomTotal = options.existing?.baselineBomTotal ?? bom.total_cost_usd
    const interrupted: PipelineState = {
      prompt,
      deploymentContext,
      compliance,
      componentGraph,
      assembly,
      bom,
      dfma,
      rfq: { supplier_questions: [], gba_route: [] },
      scene: { nodes: [] },
      fixApplied: options.existing?.fixApplied ?? false,
      appliedWarningId: options.existing?.appliedWarningId ?? null,
      usedDeterministic: !options.useLlm,
      baselineComponentIds,
      baselineBomTotal,
      extraComponents,
      gbaRouteDisplay: [],
      mcpToolCalls: runtime.mcpToolCalls,
      agentTrace: runtime.trace,
      pipelineStatus: 'awaiting_risk_decision',
      interruption: {
        type: 'risk',
        warningId: blockingWarning.id,
        message: blockingWarning.title,
      },
    }
    emit?.('checkpoint:risk', interrupted)
    return interrupted
  }

  const rfq = await runtime.runAgent('supplier_gba_agent', 'Create GBA supplier route', () =>
    runtime.callMcpWithFallback<RfqPack>(
      'supplier_gba_agent',
      'supplier.route_bom_to_gba',
      {
        componentGraph,
        deploymentContext,
        dfmaWarnings: dfma.warnings.map((w) => ({
          id: w.id,
          rfq_topic_tags: w.fix.rfq_topic_tags,
        })),
        fixApplied: false,
      },
      () =>
        options.useLlm
          ? runRfqAgent(deploymentContext, componentGraph, dfma, supplierGraph, false)
          : buildRfqPackDeterministic(componentGraph, dfma, supplierGraph, false, deploymentContext)
    )
  )
  emit?.('rfq', rfq)

  const scene = await runtime.runAgent('scene_3d_agent', 'Design 3D scene layout', () =>
    // Catalog-only designs (e.g. the demo node) use the Scene MCP server.
    // Designs with unverified extras resolve in-process so those parts render.
    extraComponents.length === 0
      ? runtime.callMcpRequired<SceneGraph>('scene_3d_agent', 'scene.generate_scene_graph', {
          componentGraph,
        })
      : Promise.resolve(resolveScene(componentGraph, workingCatalog))
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
    extraComponents,
    gbaRouteDisplay: gbaRouteToUI(rfq, supplierGraph),
    mcpToolCalls: runtime.mcpToolCalls,
    agentTrace: runtime.trace,
    pipelineStatus: 'complete',
    interruption: null,
  }

  emit?.('complete', state)
  return state
}

export async function runDeterministicPipeline(
  prompt: string,
  emit?: StageEmitter,
  options: PipelineRunOptions = {}
): Promise<PipelineState> {
  const catalog = loadCatalog()
  const supplierGraph = loadSupplierGraph()
  return runPipelineStages(prompt, catalog, supplierGraph, emit, { useLlm: false, ...options })
}

export async function runPipeline(
  prompt: string,
  emit?: StageEmitter,
  options: PipelineRunOptions = {}
): Promise<PipelineState> {
  const catalog = loadCatalog()
  const supplierGraph = loadSupplierGraph()

  try {
    return await runPipelineStages(prompt, catalog, supplierGraph, emit, { useLlm: true, ...options })
  } catch (err) {
    console.error('[pipeline] LLM failed, using deterministic path:', err)
    const state = await runDeterministicPipeline(prompt, emit, options)
    emit?.('fallback', { reason: String(err) })
    return { ...state, usedDeterministic: true }
  }
}

export async function applyPipelineFix(
  state: PipelineState,
  warningId: string,
  emit?: StageEmitter
): Promise<PipelineState> {
  const catalog = mergeCatalog(loadCatalog(), state.extraComponents ?? [])
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
        deploymentContext: state.deploymentContext,
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

  const scene = await runtime.runAgent('scene_3d_agent', 'Redesign 3D scene with fix components', () =>
    (state.extraComponents?.length ?? 0) === 0
      ? runtime.callMcpRequired<SceneGraph>('scene_3d_agent', 'scene.generate_scene_graph', {
          componentGraph,
        })
      : Promise.resolve(resolveScene(componentGraph, catalog))
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
    pipelineStatus: 'complete',
    interruption: null,
  }

  emit?.('complete', updated)
  return updated
}

/**
 * Apply conversational edits (add / remove / replace components) to an existing
 * design and re-resolve the downstream stages. Unlike a fresh run this works
 * fully in-process with a catalog merged from the checked-in catalog plus any
 * unverified, LLM-proposed components, so arbitrary parts flow through the BOM,
 * DfMA check and 3D scene.
 */
export async function applyComponentEdit(
  state: PipelineState,
  edits: EditOp[],
  emit?: StageEmitter
): Promise<PipelineState> {
  const baseCatalog = loadCatalog()
  const supplierGraph = loadSupplierGraph()
  const runtime = createAgentRuntime()

  const resolved = resolveEditOps(
    edits,
    state.componentGraph.selected_component_ids,
    baseCatalog,
    state.extraComponents ?? []
  )
  const catalog = mergeCatalog(baseCatalog, resolved.extraComponents)

  const componentGraph: ComponentGraph = {
    node_type: state.componentGraph.node_type,
    selected_component_ids: resolved.selectedComponentIds,
  }
  emit?.('components', componentGraph)

  const assembly = await runtime.runAgent('hardware_expert_agent', 'Revalidate assembly pattern', () =>
    resolveAssemblyPattern(state.deploymentContext, componentGraph)
  )
  emit?.('assembly', assembly)

  const bom = await runtime.runAgent('bom_agent', 'Rebuild priced BOM after edit', () =>
    resolveBOM(componentGraph, catalog)
  )
  emit?.('bom', bom)

  const dfma = await runtime.runAgent('dfma_agent', 'Recheck manufacturability after edit', () =>
    runDfmaEngine(state.deploymentContext, componentGraph, bom, catalog)
  )
  emit?.('dfma', dfma)

  const rfq = await runtime.runAgent('supplier_gba_agent', 'Re-route BOM to suppliers', () =>
    buildRfqPackDeterministic(componentGraph, dfma, supplierGraph, state.fixApplied, state.deploymentContext)
  )
  emit?.('rfq', rfq)

  const scene = await runtime.runAgent('scene_3d_agent', 'Redesign 3D scene after edit', () =>
    resolveScene(componentGraph, catalog)
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
    extraComponents: resolved.extraComponents,
    gbaRouteDisplay: gbaRouteToUI(rfq, supplierGraph),
    mcpToolCalls: state.mcpToolCalls ?? [],
    agentTrace: [...(state.agentTrace ?? []), ...runtime.trace],
    pipelineStatus: 'complete',
    interruption: null,
  }

  emit?.('complete', updated)
  return updated
}
