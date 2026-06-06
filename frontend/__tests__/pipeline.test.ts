import { describe, it, expect } from 'vitest'
import { resolveBOM } from '../lib/pipeline/bom-resolver'
import { runDfmaEngine } from '../lib/pipeline/dfma-engine'
import { ruleBasedComponentGraph, validateComponentGraph } from '../lib/pipeline/inclusion-rules'
import { resolveScene } from '../lib/pipeline/scene-resolver'
import { parseContextFromPrompt } from '../lib/pipeline/context-agent'
import { loadCatalog } from '../lib/pipeline/load-data'
import type { ComponentGraph } from '../lib/pipeline/types'

const BUILDGUARD_PROMPT =
  'A 52-year-old Hong Kong residential building needs a low-maintenance facade sensor node that monitors crack propagation, vibration anomalies, tilt shifts and moisture ingress, and creates early warnings before the next Mandatory Building Inspection.'

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
})
