import { describe, expect, it } from 'vitest'
import { parseContextFromPrompt } from '../lib/pipeline/context-agent'
import { resolveAssemblyPattern } from '../lib/pipeline/assembly-resolver'
import { ruleBasedComponentGraph } from '../lib/pipeline/inclusion-rules'
import { loadCatalog } from '../lib/pipeline/load-data'
import { resolveScene } from '../lib/pipeline/scene-resolver'
import { buildRfqPackDeterministic } from '../lib/pipeline/rfq-agent'
import { getPartDetails } from '../lib/scene/part-details'
import supplierGraph from '../data/supplier-graph.json'

const SOURCE_STATUSES = new Set(['seeded', 'candidate', 'verified', 'not_configured', 'error'])
const catalog = loadCatalog()

describe('smart-city component library', () => {
  it('contains at least 100 grounded smart-city components', () => {
    expect(catalog.components.length).toBeGreaterThanOrEqual(100)
  })

  it('uses unique component ids with source status and tags', () => {
    const ids = catalog.components.map((component) => component.id)
    expect(new Set(ids).size).toBe(ids.length)

    for (const component of catalog.components) {
      expect(component.id).toMatch(/^[a-z0-9-]+$/)
      expect(component.part.length).toBeGreaterThan(2)
      expect(component.category.length).toBeGreaterThan(1)
      expect(component.tags.length).toBeGreaterThan(0)
      expect(component.source?.source_status).toBeTruthy()
      expect(SOURCE_STATUSES.has(component.source!.source_status)).toBe(true)
      expect(component.source?.update_strategy.length).toBeGreaterThan(5)
    }
  })

  it('keeps BuildGuard catalog ids and prices stable', () => {
    const byId = new Map(catalog.components.map((component) => [component.id, component]))

    expect(byId.get('weatherproof-enclosure')?.cost_usd).toBe(28)
    expect(byId.get('crack-displacement-sensor')?.cost_usd).toBe(34)
    expect(byId.get('vibration-sensor')?.cost_usd).toBe(18)
    expect(byId.get('tilt-sensor')?.cost_usd).toBe(22)
    expect(byId.get('moisture-sensor')?.cost_usd).toBe(16)
    expect(byId.get('edge-compute-board')?.cost_usd).toBe(44)
    expect(byId.get('lora-nbiot-module')?.cost_usd).toBe(19)
    expect(byId.get('battery-pack')?.cost_usd).toBe(24)
    expect(byId.get('mounting-bracket')?.cost_usd).toBe(8)
  })

  it('has enough parts across smart-city families for the agent to choose from', () => {
    const tags = new Set(catalog.components.flatMap((component) => component.tags))

    for (const required of [
      'air-quality',
      'noise',
      'flood',
      'drainage',
      'traffic',
      'parking',
      'occupancy',
      'waste',
      'energy',
      'structural',
      'weather',
      'utility-cabinet',
      'water-contact',
      'privacy-safe',
    ]) {
      expect(tags.has(required), `${required} tag missing`).toBe(true)
    }
  })
})

const graphFor = (prompt: string) => {
  const ctx = parseContextFromPrompt(prompt)
  return ruleBasedComponentGraph(ctx, catalog).selected_component_ids
}

describe('smart-city deterministic component selection', () => {
  it('selects roadside flood monitoring hardware', () => {
    const ids = graphFor(
      'A Hong Kong roadside drainage channel needs an outdoor flood monitoring node that detects water level, rain intensity and conductivity, powered by solar battery and LoRa.'
    )

    expect(ids).toContain('water-level-ultrasonic')
    expect(ids).toContain('rain-gauge')
    expect(ids).toContain('conductivity-sensor')
    expect(ids).toContain('outdoor-pole-enclosure')
    expect(ids).toContain('solar-charge-controller')
  })

  it('selects privacy-safe underground mall occupancy hardware', () => {
    const ids = graphFor(
      'A Singapore underground mall needs a privacy-preserving ceiling node that monitors crowd occupancy, CO2 and pedestrian presence without facial recognition using PoE.'
    )

    expect(ids).toContain('mmwave-presence')
    expect(ids).toContain('co2-sensor')
    expect(ids).toContain('ceiling-mount-plate')
    expect(ids).toContain('ethernet-poe-module')
    expect(ids).not.toContain('camera-module')
  })

  it('selects smart bin monitoring hardware', () => {
    const ids = graphFor(
      'A Hong Kong public waste bin needs a smart sanitation node for fill level, load weight, odor and lid-open events with battery power.'
    )

    expect(ids).toContain('smart-bin-housing')
    expect(ids).toContain('ultrasonic-bin-level-sensor')
    expect(ids).toContain('bin-load-cell')
    expect(ids).toContain('odor-voc-sensor')
    expect(ids).toContain('bin-lid-open-switch')
  })

  it('selects curbside parking and traffic hardware', () => {
    const ids = graphFor(
      'A Shenzhen curbside parking pilot needs a roadside pole node that detects parking occupancy, vehicle counts and traffic speed using radar and magnetometer.'
    )

    expect(ids).toContain('traffic-mmwave-radar')
    expect(ids).toContain('parking-occupancy-magnetometer')
    expect(ids).toContain('vehicle-magnetometer')
    expect(ids).toContain('outdoor-pole-enclosure')
  })

  it('selects utility cabinet energy monitoring hardware', () => {
    const ids = graphFor(
      'A Hong Kong utility cabinet needs a monitoring node for current, voltage, cabinet temperature and door tamper events with mains power.'
    )

    expect(ids).toContain('din-rail-industrial-enclosure')
    expect(ids).toContain('current-transformer-clamp')
    expect(ids).toContain('voltage-monitor-module')
    expect(ids).toContain('cabinet-temperature-sensor')
    expect(ids).toContain('cabinet-door-tamper-switch')
  })
})

describe('smart-city assembly patterns', () => {
  it('matches drainage, waste and utility patterns from selected components', () => {
    const floodPrompt = 'A roadside drainage channel needs flood water level and rain monitoring with solar battery.'
    const floodCtx = parseContextFromPrompt(floodPrompt)
    const floodGraph = {
      node_type: 'roadside-drainage-node',
      selected_component_ids: graphFor(floodPrompt),
    }
    expect(resolveAssemblyPattern(floodCtx, floodGraph).pattern_id).toBe('drainage-water-monitor-node')

    const wastePrompt = 'A public waste bin needs fill level, load, odor and lid-open monitoring.'
    const wasteCtx = parseContextFromPrompt(wastePrompt)
    const wasteGraph = {
      node_type: 'smart-bin-node',
      selected_component_ids: graphFor(wastePrompt),
    }
    expect(resolveAssemblyPattern(wasteCtx, wasteGraph).pattern_id).toBe('waste-bin-monitor-node')

    const utilityPrompt = 'A utility cabinet needs current voltage cabinet temperature and door tamper monitoring.'
    const utilityCtx = parseContextFromPrompt(utilityPrompt)
    const utilityGraph = {
      node_type: 'utility-cabinet-node',
      selected_component_ids: graphFor(utilityPrompt),
    }
    expect(resolveAssemblyPattern(utilityCtx, utilityGraph).pattern_id).toBe('utility-cabinet-monitor-node')
  })
})

describe('smart-city scene rendering metadata', () => {
  it('preserves category and tags on scene nodes', () => {
    const graph = {
      node_type: 'drainage-water-node',
      selected_component_ids: ['outdoor-pole-enclosure', 'water-level-ultrasonic', 'rain-gauge'],
    }
    const scene = resolveScene(graph, catalog)
    const water = scene.nodes.find((node) => node.component_id === 'water-level-ultrasonic')

    expect(water?.category).toBe('sensor')
    expect(water?.tags).toContain('water-contact')
  })

  it('generates visual details from tags for non-BuildGuard parts', () => {
    const details = getPartDetails(
      {
        id: 'water-level-ultrasonic',
        category: 'sensor',
        tags: ['sensor', 'flood', 'water-contact'],
      },
      [0.18, 0.16, 0.12]
    )

    expect(details.map((detail) => detail.role)).toContain('probe-tip')
  })
})

describe('smart-city RFQ questions', () => {
  it('adds water-contact and battery/solar RFQ questions for flood nodes', () => {
    const prompt = 'A roadside drainage channel needs flood water level and rain monitoring with solar battery.'
    const ctx = parseContextFromPrompt(prompt)
    const graph = {
      node_type: 'drainage-water-node',
      selected_component_ids: graphFor(prompt),
    }
    const rfq = buildRfqPackDeterministic(
      graph,
      { warnings: [], passed_checks: [] },
      supplierGraph,
      false,
      ctx
    )
    const text = rfq.supplier_questions.map((q) => q.question).join(' ')

    expect(text).toContain('probe material')
    expect(text).toContain('battery runtime')
  })
})
