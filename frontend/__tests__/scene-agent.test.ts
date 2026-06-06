import { describe, it, expect } from 'vitest'
import { validateSceneGraph, runSceneAgent } from '../lib/pipeline/scene-agent'
import { parseContextFromPrompt } from '../lib/pipeline/context-agent'
import { ruleBasedComponentGraph } from '../lib/pipeline/inclusion-rules'
import { resolveBOM } from '../lib/pipeline/bom-resolver'
import { runDfmaEngine } from '../lib/pipeline/dfma-engine'
import { loadCatalog } from '../lib/pipeline/load-data'

const BUILDGUARD_PROMPT =
  'A 52-year-old Hong Kong residential building needs a low-maintenance facade sensor node that monitors crack propagation, vibration anomalies, tilt shifts and moisture ingress, and creates early warnings before the next Mandatory Building Inspection.'

describe('scene-agent: validateSceneGraph', () => {
  const catalog = loadCatalog()

  it('accepts a valid LLM scene graph and preserves all fields', () => {
    const graph = {
      node_type: 'outdoor-facade-node',
      selected_component_ids: ['weatherproof-enclosure', 'battery-pack'],
    }
    const raw = {
      nodes: [
        {
          component_id: 'weatherproof-enclosure',
          scene_id: 'enclosure',
          label: 'Weatherproof Enclosure',
          position: [0, 0, 0],
          explodeOffset: [0, 0, 0],
          color: '#334155',
          geometry: 'box',
          scale: [1.2, 1.6, 0.8],
        },
        {
          component_id: 'battery-pack',
          scene_id: 'battery',
          label: 'Battery Module',
          position: [0, -0.5, 0],
          explodeOffset: [0, -1.8, 0.5],
          color: '#4d7c0f',
          geometry: 'box',
          scale: [0.8, 0.4, 0.3],
        },
      ],
    }
    const scene = validateSceneGraph(raw, graph, catalog)
    expect(scene.nodes).toHaveLength(2)
    expect(scene.nodes[0].scene_id).toBe('enclosure')
    expect(scene.nodes[0].color).toBe('#334155')
    expect(scene.nodes[1].scene_id).toBe('battery')
  })

  it('rejects nodes whose component_id is not in the graph', () => {
    const graph = {
      node_type: 'test',
      selected_component_ids: ['weatherproof-enclosure'],
    }
    const raw = {
      nodes: [
        {
          component_id: 'camera-module', // not selected
          scene_id: 'camera',
          label: 'Camera',
          position: [0, 0, 0],
          explodeOffset: [0, 0, 0],
          color: '#dc2626',
          geometry: 'box',
          scale: [0.2, 0.15, 0.15],
        },
        {
          component_id: 'weatherproof-enclosure',
          scene_id: 'enclosure',
          label: 'Enclosure',
          position: [0, 0, 0],
          explodeOffset: [0, 0, 0],
          color: '#334155',
          geometry: 'box',
          scale: [1.2, 1.6, 0.8],
        },
      ],
    }
    const scene = validateSceneGraph(raw, graph, catalog)
    expect(scene.nodes).toHaveLength(1)
    expect(scene.nodes[0].component_id).toBe('weatherproof-enclosure')
  })

  it('fills missing components from catalog fallback', () => {
    const graph = {
      node_type: 'test',
      selected_component_ids: ['weatherproof-enclosure', 'battery-pack'],
    }
    // LLM only returned one of the two components
    const raw = {
      nodes: [
        {
          component_id: 'weatherproof-enclosure',
          scene_id: 'enclosure',
          label: 'Enclosure',
          position: [0, 0, 0],
          explodeOffset: [0, 0, 0],
          color: '#334155',
          geometry: 'box',
          scale: [1.2, 1.6, 0.8],
        },
      ],
    }
    const scene = validateSceneGraph(raw, graph, catalog)
    // battery-pack should be filled from catalog
    expect(scene.nodes).toHaveLength(2)
    const battery = scene.nodes.find((n) => n.component_id === 'battery-pack')
    expect(battery).toBeDefined()
    expect(battery?.scene_id).toBe('battery')
  })

  it('coerces invalid geometry to box', () => {
    const graph = {
      node_type: 'test',
      selected_component_ids: ['weatherproof-enclosure'],
    }
    const raw = {
      nodes: [
        {
          component_id: 'weatherproof-enclosure',
          scene_id: 'enclosure',
          label: 'Enclosure',
          position: [0, 0, 0],
          explodeOffset: [0, 0, 0],
          color: '#334155',
          geometry: 'hexagon', // invalid
          scale: [1.2, 1.6, 0.8],
        },
      ],
    }
    const scene = validateSceneGraph(raw, graph, catalog)
    expect(scene.nodes[0].geometry).toBe('box')
  })

  it('clamps out-of-range positions', () => {
    const graph = {
      node_type: 'test',
      selected_component_ids: ['weatherproof-enclosure'],
    }
    const raw = {
      nodes: [
        {
          component_id: 'weatherproof-enclosure',
          scene_id: 'enclosure',
          label: 'Enclosure',
          position: [999, -999, 0],
          explodeOffset: [0, 0, 0],
          color: '#334155',
          geometry: 'box',
          scale: [1.2, 1.6, 0.8],
        },
      ],
    }
    const scene = validateSceneGraph(raw, graph, catalog)
    expect(scene.nodes[0].position[0]).toBeLessThanOrEqual(5)
    expect(scene.nodes[0].position[1]).toBeGreaterThanOrEqual(-5)
  })

  it('defaults invalid hex colors to #64748b', () => {
    const graph = {
      node_type: 'test',
      selected_component_ids: ['weatherproof-enclosure'],
    }
    const raw = {
      nodes: [
        {
          component_id: 'weatherproof-enclosure',
          scene_id: 'enclosure',
          label: 'Enclosure',
          position: [0, 0, 0],
          explodeOffset: [0, 0, 0],
          color: 'dark-grey', // not a valid hex
          geometry: 'box',
          scale: [1.2, 1.6, 0.8],
        },
      ],
    }
    const scene = validateSceneGraph(raw, graph, catalog)
    expect(scene.nodes[0].color).toBe('#64748b')
  })

  it('deduplicates repeated component_ids, keeping first occurrence', () => {
    const graph = {
      node_type: 'test',
      selected_component_ids: ['weatherproof-enclosure'],
    }
    const raw = {
      nodes: [
        {
          component_id: 'weatherproof-enclosure',
          scene_id: 'enclosure',
          label: 'First',
          position: [0, 0, 0],
          explodeOffset: [0, 0, 0],
          color: '#334155',
          geometry: 'box',
          scale: [1.2, 1.6, 0.8],
        },
        {
          component_id: 'weatherproof-enclosure', // duplicate
          scene_id: 'enclosure-2',
          label: 'Duplicate',
          position: [1, 1, 1],
          explodeOffset: [0, 0, 0],
          color: '#ff0000',
          geometry: 'box',
          scale: [1.0, 1.0, 1.0],
        },
      ],
    }
    const scene = validateSceneGraph(raw, graph, catalog)
    expect(scene.nodes).toHaveLength(1)
    expect(scene.nodes[0].label).toBe('First')
  })

  it('handles null or malformed raw input gracefully', () => {
    const graph = {
      node_type: 'test',
      selected_component_ids: ['weatherproof-enclosure'],
    }
    const scene = validateSceneGraph(null, graph, catalog)
    // falls back entirely to catalog
    expect(scene.nodes.length).toBeGreaterThan(0)
  })
})

describe('scene-agent: runSceneAgent', () => {
  const catalog = loadCatalog()

  it('falls back to catalog scene when no LLM key is configured', async () => {
    const ctx = parseContextFromPrompt(BUILDGUARD_PROMPT)
    const graph = ruleBasedComponentGraph(ctx, catalog)
    const bom = resolveBOM(graph, catalog)
    const dfma = runDfmaEngine(ctx, graph, bom, catalog)

    const scene = await runSceneAgent(ctx, graph, bom, dfma, catalog)
    expect(scene.nodes.length).toBeGreaterThan(0)
    expect(scene.nodes.every((n) => n.scene_id)).toBe(true)
    expect(scene.nodes.every((n) => Array.isArray(n.position))).toBe(true)
  })

  it('fallback output scene_ids match catalog values', async () => {
    const ctx = parseContextFromPrompt(BUILDGUARD_PROMPT)
    const graph = ruleBasedComponentGraph(ctx, catalog)
    const bom = resolveBOM(graph, catalog)
    const dfma = runDfmaEngine(ctx, graph, bom, catalog)

    const scene = await runSceneAgent(ctx, graph, bom, dfma, catalog)
    const enclosureNode = scene.nodes.find((n) => n.component_id === 'weatherproof-enclosure')
    expect(enclosureNode?.scene_id).toBe('enclosure')

    const bracketNode = scene.nodes.find((n) => n.component_id === 'mounting-bracket')
    expect(bracketNode?.scene_id).toBe('bracket')
  })

  it('returns a node for every selected component', async () => {
    const ctx = parseContextFromPrompt(BUILDGUARD_PROMPT)
    const graph = ruleBasedComponentGraph(ctx, catalog)
    const bom = resolveBOM(graph, catalog)
    const dfma = runDfmaEngine(ctx, graph, bom, catalog)

    const scene = await runSceneAgent(ctx, graph, bom, dfma, catalog)
    const returnedIds = new Set(scene.nodes.map((n) => n.component_id))
    for (const id of graph.selected_component_ids) {
      const entry = catalog.components.find((c) => c.id === id)
      if (entry?.scene) {
        expect(returnedIds.has(id)).toBe(true)
      }
    }
  })
})
