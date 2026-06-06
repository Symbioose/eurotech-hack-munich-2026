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
import type { ComponentGraph, PipelineState } from './types'

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
  const deploymentContext = options.useLlm
    ? await runContextAgent(prompt)
    : parseContextFromPrompt(prompt)
  emit?.('context', deploymentContext)

  const componentGraph = options.useLlm
    ? await runComponentAgent(deploymentContext, catalog)
    : ruleBasedComponentGraph(deploymentContext, catalog)
  emit?.('components', componentGraph)

  const bom = resolveBOM(componentGraph, catalog)
  emit?.('bom', bom)

  const dfma = runDfmaEngine(deploymentContext, componentGraph, bom, catalog)
  emit?.('dfma', dfma)

  const rfq = options.useLlm
    ? await runRfqAgent(deploymentContext, componentGraph, dfma, supplierGraph, false)
    : buildRfqPackDeterministic(componentGraph, dfma, supplierGraph, false)
  emit?.('rfq', rfq)

  const scene = resolveScene(componentGraph, catalog)
  emit?.('scene', scene)

  const baselineComponentIds =
    options.existing?.baselineComponentIds ?? componentGraph.selected_component_ids
  const baselineBomTotal = options.existing?.baselineBomTotal ?? bom.total_cost_usd

  const state: PipelineState = {
    prompt,
    deploymentContext,
    componentGraph,
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

  const componentGraph = applyFixToGraph(state.componentGraph, warningId, state)
  emit?.('components', componentGraph)

  const bom = resolveBOM(componentGraph, catalog)
  emit?.('bom', bom)

  const dfma = runDfmaEngine(state.deploymentContext, componentGraph, bom, catalog)
  emit?.('dfma', dfma)

  const rfq = await runRfqAgent(
    state.deploymentContext,
    componentGraph,
    dfma,
    supplierGraph,
    true
  )
  emit?.('rfq', rfq)

  const scene = resolveScene(componentGraph, catalog)
  emit?.('scene', scene)

  const updated: PipelineState = {
    ...state,
    componentGraph,
    bom,
    dfma,
    rfq,
    scene,
    fixApplied: true,
    appliedWarningId: warningId,
    gbaRouteDisplay: gbaRouteToUI(rfq, supplierGraph),
  }

  emit?.('complete', updated)
  return updated
}
