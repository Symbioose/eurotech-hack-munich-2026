import { describe, it, expect } from 'vitest'
import { resolveBOM } from '../lib/pipeline/bom-resolver'
import { runDfmaEngine } from '../lib/pipeline/dfma-engine'
import { ruleBasedComponentGraph, validateComponentGraph } from '../lib/pipeline/inclusion-rules'
import { resolveScene } from '../lib/pipeline/scene-resolver'
import { parseContextFromPrompt } from '../lib/pipeline/context-agent'
import { loadCatalog } from '../lib/pipeline/load-data'
import { resolveAssemblyPattern } from '../lib/pipeline/assembly-resolver'
import { resolveCompliance } from '../lib/pipeline/compliance-resolver'
import { applyPipelineFix, runDeterministicPipeline } from '../lib/pipeline/orchestrator'
import type { ComponentGraph } from '../lib/pipeline/types'

const BUILDGUARD_PROMPT =
  'A 52-year-old Hong Kong residential building needs a low-maintenance facade sensor node that monitors crack propagation, vibration anomalies, tilt shifts and moisture ingress, and creates early warnings before the next Mandatory Building Inspection.'

const OCCUPANCY_PROMPT =
  'A Singapore underground mall needs a privacy-preserving ceiling node that monitors crowd occupancy without facial recognition and uses mains power.'

describe('pipeline deterministic stages', () => {
  const catalog = loadCatalog()

  it('parses deployment context from prompt text', () => {
    const ctx = parseContextFromPrompt(BUILDGUARD_PROMPT)
    expect(ctx.city).toBe('Hong Kong')
    expect(ctx.surface).toContain('facade')
    expect(ctx.environment).toContain('humidity')
  })

  it('selects components from catalog via rules', () => {
    const ctx = parseContextFromPrompt(BUILDGUARD_PROMPT)
    const graph = ruleBasedComponentGraph(ctx, catalog)
    expect(graph.selected_component_ids).toContain('weatherproof-enclosure')
    expect(graph.selected_component_ids).toContain('crack-displacement-sensor')
    expect(graph.selected_component_ids).not.toContain('camera-module')
  })

  it('BOM resolver reads prices from catalog only', () => {
    const ctx = parseContextFromPrompt(BUILDGUARD_PROMPT)
    const graph = ruleBasedComponentGraph(ctx, catalog)
    const bom = resolveBOM(graph, catalog)
    const expected = graph.selected_component_ids.reduce((sum, id) => {
      const row = catalog.components.find((c) => c.id === id)
      return sum + (row?.cost_usd ?? 0)
    }, 0)
    expect(bom.total_cost_usd).toBe(expected)
  })

  it('DFMA engine flags IP_INSUFFICIENT from rules file + catalog', () => {
    const ctx = parseContextFromPrompt(BUILDGUARD_PROMPT)
    const graph = ruleBasedComponentGraph(ctx, catalog)
    const bom = resolveBOM(graph, catalog)
    const dfma = runDfmaEngine(ctx, graph, bom, catalog)
    expect(dfma.warnings[0]?.id).toBe('IP_INSUFFICIENT')
  })

  it('DFMA treats structured climate humidity as weatherproofing exposure', () => {
    const ctx = {
      ...parseContextFromPrompt(BUILDGUARD_PROMPT),
      environment: ['urban'],
      climate: {
        humidity: 'high',
        rainfall: null,
        wind: null,
      },
    }
    const graph = ruleBasedComponentGraph(ctx, catalog)
    const bom = resolveBOM(graph, catalog)
    const dfma = runDfmaEngine(ctx, graph, bom, catalog)

    expect(dfma.warnings[0]?.id).toBe('IP_INSUFFICIENT')
  })

  it('DFMA treats accented facade text as an outdoor facade surface', () => {
    const ctx = {
      ...parseContextFromPrompt(BUILDGUARD_PROMPT),
      surface: 'façade',
      environment: ['humidity'],
      climate: {
        humidity: 'high',
        rainfall: null,
        wind: null,
      },
    }
    const graph = ruleBasedComponentGraph(ctx, catalog)
    const bom = resolveBOM(graph, catalog)
    const dfma = runDfmaEngine(ctx, graph, bom, catalog)

    expect(dfma.warnings[0]?.id).toBe('IP_INSUFFICIENT')
  })

  it('DFMA passes after fix components from catalog are added', () => {
    const ctx = parseContextFromPrompt(BUILDGUARD_PROMPT)
    const graph: ComponentGraph = {
      node_type: 'outdoor-facade-node',
      selected_component_ids: [
        ...ruleBasedComponentGraph(ctx, catalog).selected_component_ids,
        'ip67-gasket-kit',
        'ptfe-membrane',
        '316l-stainless-fasteners',
      ],
    }
    const bom = resolveBOM(graph, catalog)
    const dfma = runDfmaEngine(ctx, graph, bom, catalog)
    expect(dfma.warnings).toHaveLength(0)
  })

  it('scene resolver maps catalog scene definitions', () => {
    const ctx = parseContextFromPrompt(BUILDGUARD_PROMPT)
    const graph = ruleBasedComponentGraph(ctx, catalog)
    const scene = resolveScene(graph, catalog)
    expect(scene.nodes.length).toBeGreaterThan(0)
    expect(scene.nodes.every((n) => n.scene_id)).toBe(true)
  })

  it('validateComponentGraph enforces inclusion rules on bad LLM output', () => {
    const ctx = parseContextFromPrompt(BUILDGUARD_PROMPT)
    const badGraph = {
      node_type: 'bad',
      selected_component_ids: ['camera-module', 'edge-compute-board'],
    }
    const fixed = validateComponentGraph(badGraph, ctx, catalog)
    expect(fixed.selected_component_ids).not.toContain('camera-module')
    expect(fixed.selected_component_ids).toContain('weatherproof-enclosure')
  })

  it('compliance resolver returns Hong Kong legal constraints with source URLs', () => {
    const ctx = parseContextFromPrompt(BUILDGUARD_PROMPT)
    const compliance = resolveCompliance(ctx)

    expect(compliance.requirements.map((r) => r.id)).toContain('HK_MBIS_REGISTERED_INSPECTOR')
    expect(compliance.requirements.map((r) => r.id)).toContain('HK_OFCA_RADIO_EQUIPMENT')
    expect(compliance.requirements.every((r) => r.source_url.startsWith('https://'))).toBe(true)
    expect(compliance.requirements.every((r) => r.last_checked_at)).toBe(true)
    expect(compliance.requirements.every((r) => r.source_status === 'seeded')).toBe(true)
  })

  it('assembly resolver grounds the node in an outdoor facade IoT pattern', () => {
    const ctx = parseContextFromPrompt(BUILDGUARD_PROMPT)
    const graph = ruleBasedComponentGraph(ctx, catalog)
    const assembly = resolveAssemblyPattern(ctx, graph)

    expect(assembly.pattern_id).toBe('outdoor-battery-facade-iot-node')
    expect(assembly.required_component_ids).toContain('weatherproof-enclosure')
    expect(assembly.required_component_ids).toContain('mounting-bracket')
    expect(assembly.constraints).toContain('Outdoor facade nodes need a sealed enclosure, gasket path and corrosion-resistant mounting hardware.')
  })

  it('selects privacy-preserving occupancy hardware without BuildGuard crack parts', () => {
    const ctx = parseContextFromPrompt(OCCUPANCY_PROMPT)
    const graph = ruleBasedComponentGraph(ctx, catalog)

    expect(ctx.city).toBe('Singapore')
    expect(ctx.surface).toBe('indoor ceiling')
    expect(graph.selected_component_ids).toContain('mmwave-presence')
    expect(graph.selected_component_ids).not.toContain('crack-displacement-sensor')
    expect(graph.selected_component_ids).not.toContain('camera-module')
  })

  it('catalog includes broader smart-city parts with freshness metadata', () => {
    const ids = catalog.components.map((c) => c.id)

    expect(ids).toContain('poe-power-module')
    expect(ids).toContain('air-quality-sensor')
    expect(ids).toContain('solar-trickle-panel')
    expect(catalog.components.every((c) => c.source?.source_status)).toBe(true)
  })

  it('full deterministic pipeline records agent trace and MCP ownership', async () => {
    const state = await runDeterministicPipeline(BUILDGUARD_PROMPT)

    expect(state.agentTrace.map((event) => event.type)).toContain('agent.started')
    expect(state.agentTrace.map((event) => event.agent)).toContain('compliance_hk_agent')
    expect(state.agentTrace.map((event) => event.agent)).toContain('hardware_expert_agent')
    expect(state.mcpToolCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          agent: 'compliance_hk_agent',
          server: 'compliance',
          tool: 'search_requirements',
        }),
        expect.objectContaining({
          agent: 'supplier_gba_agent',
          server: 'supplier',
          tool: 'route_bom_to_gba',
        }),
        expect.objectContaining({
          agent: 'scene_3d_agent',
          server: 'scene',
          tool: 'generate_scene_graph',
        }),
      ])
    )
  })

  it('can interrupt before RFQ and scene when DfMA finds a critical risk', async () => {
    const events: string[] = []
    const state = await runDeterministicPipeline(
      BUILDGUARD_PROMPT,
      (stage) => events.push(stage),
      { interruptOnRisk: true }
    )

    expect(state.pipelineStatus).toBe('awaiting_risk_decision')
    expect(state.interruption?.type).toBe('risk')
    expect(events).toContain('checkpoint:risk')
    expect(events).not.toContain('rfq')
    expect(events).not.toContain('scene')
    expect(state.rfq.gba_route).toEqual([])
    expect(state.scene.nodes).toEqual([])
  })

  it('apply fix regenerates the 3D scene through the scene MCP and shows fix parts', async () => {
    const interrupted = await runDeterministicPipeline(BUILDGUARD_PROMPT, undefined, {
      interruptOnRisk: true,
    })
    const warningId = interrupted.interruption?.warningId
    expect(warningId).toBe('IP_INSUFFICIENT')

    const fixed = await applyPipelineFix(interrupted, warningId!)

    expect(fixed.pipelineStatus).toBe('complete')
    expect(fixed.mcpToolCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          agent: 'scene_3d_agent',
          server: 'scene',
          tool: 'generate_scene_graph',
        }),
      ])
    )

    const sceneIds = fixed.scene.nodes.map((node) => node.scene_id)
    expect(sceneIds).toContain('gasket')
    expect(sceneIds).toContain('membrane')
    expect(sceneIds).toContain('drainage-lip')
    expect(sceneIds).toContain('fasteners')
  })
})
