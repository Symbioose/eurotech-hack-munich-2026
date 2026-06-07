#!/usr/bin/env node
/**
 * Export the canonical demo object (BuildGuard Node) to a single, self-contained
 * file the World Model team can load directly: components + 3D geometry + BOM +
 * the mapping from each component to the world-model degradation state space.
 *
 * Catalog-derived fields (part, cost, geometry, source) are read from the real
 * frontend catalog so this never drifts. The world_model_state wiring is the
 * domain spec from docs/worldmodel.md.
 *
 *   node frontend/scripts/export-demo-object.mjs   # writes ./demo-object.json
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FRONTEND = path.resolve(__dirname, '..')
const REPO_ROOT = path.resolve(FRONTEND, '..')

const catalog = JSON.parse(
  fs.readFileSync(path.join(FRONTEND, 'data', 'component-catalog.json'), 'utf-8')
)
const byId = new Map(catalog.components.map((c) => [c.id, c]))

function pick(id) {
  const c = byId.get(id)
  if (!c) throw new Error(`Component '${id}' missing from catalog`)
  return {
    id: c.id,
    part: c.part,
    category: c.category,
    supplier_route: c.supplier_route,
    cost_usd: c.cost_usd,
    tags: c.tags,
    source: c.source,
    scene: c.scene, // position / scale / geometry / color (assembly is inferred at runtime)
  }
}

// Canonical BuildGuard node selection (see docs/buildguard-node.md).
const BASE_IDS = [
  'weatherproof-enclosure',
  'crack-displacement-sensor',
  'vibration-sensor',
  'tilt-sensor',
  'moisture-sensor',
  'edge-compute-board',
  'lora-nbiot-module',
  'battery-pack',
  'mounting-bracket',
]

// Added by the DfMA / world-model fix (weatherproofing correction).
const FIX_IDS = ['ip67-gasket-kit', 'ptfe-membrane', '316l-stainless-fasteners', 'drainage-lip']

const baseComponents = BASE_IDS.map(pick)
const fixComponents = FIX_IDS.map(pick)

const sum = (rows) => rows.reduce((t, c) => t + c.cost_usd, 0)
const bomRows = (rows) =>
  rows.map((c) => ({
    component_id: c.id,
    part: c.part,
    supplier_route: c.supplier_route,
    cost_usd: c.cost_usd,
    source_status: c.source?.source_status ?? 'seeded',
  }))

const baseTotal = sum(baseComponents)
const fixedTotal = sum([...baseComponents, ...fixComponents])

/**
 * World-model state space (docs/worldmodel.md). Each component-state variable is
 * wired to the physical component(s) it represents, the stressors that degrade
 * it, and the fix components that improve it. Baselines start healthy (1.0) for
 * integrity/health variables and at 0.0 for drift/corrosion variables.
 */
const worldModelState = {
  environment_variables: {
    temperature_c: { unit: 'C', hk_range: [15, 38] },
    humidity_rh: { unit: '0-1', hk_range: [0.55, 0.97] },
    rainfall_intensity: { unit: 'mm/hr', hk_range: [0, 150] },
    wind_speed_ms: { unit: 'm/s', hk_range: [0, 45] },
    UV_index: { unit: '0-11', hk_range: [0, 11] },
    vibration_g: { unit: 'g', hk_range: [0, 2.5] },
  },
  stress_actions: ['typhoon_load', 'heat_cycle', 'humidity_soak', 'vibration_burst', 'UV_exposure'],
  component_state: {
    enclosure_seal_integrity: {
      baseline: 1.0,
      direction: 'degrades',
      components: ['weatherproof-enclosure'],
      driven_by: ['humidity_rh', 'UV_index'],
      improved_by: ['ip67-gasket-kit', 'ptfe-membrane', 'drainage-lip'],
    },
    pcb_health: {
      baseline: 1.0,
      direction: 'degrades',
      components: ['edge-compute-board', 'lora-nbiot-module'],
      driven_by: ['humidity_rh', 'temperature_c'],
      improved_by: ['ip67-gasket-kit', 'ptfe-membrane'],
    },
    battery_soc: {
      baseline: 1.0,
      direction: 'degrades',
      components: ['battery-pack'],
      driven_by: ['temperature_c'],
      improved_by: [],
    },
    bracket_corrosion: {
      baseline: 0.0,
      direction: 'increases',
      components: ['mounting-bracket'],
      driven_by: ['humidity_rh'],
      improved_by: ['316l-stainless-fasteners'],
    },
    moisture_sensor_drift: {
      baseline: 0.0,
      direction: 'increases',
      components: ['moisture-sensor'],
      driven_by: ['humidity_rh', 'rainfall_intensity'],
      improved_by: ['ptfe-membrane'],
    },
    crack_sensor_drift: {
      baseline: 0.0,
      direction: 'increases',
      components: ['crack-displacement-sensor', 'vibration-sensor'],
      driven_by: ['vibration_g'],
      improved_by: [],
    },
    tilt_sensor_drift: {
      baseline: 0.0,
      direction: 'increases',
      components: ['tilt-sensor'],
      driven_by: ['vibration_g', 'wind_speed_ms'],
      improved_by: [],
    },
  },
  failure_probabilities: [
    'moisture_ingress_prob',
    'thermal_runaway_prob',
    'seal_failure_prob',
    'bracket_failure_prob',
  ],
  device_failure_formula: 'device_failure = 1 - prod(1 - component_failure_i)',
  hidden_failure_interaction: {
    description:
      'Each stressor alone causes moderate degradation. The compound below triggers catastrophic joint failure (moisture ingress spike + non-linear PCB collapse) that single-variable tests miss.',
    condition: 'humidity_rh > 0.85 AND enclosure_seal_integrity < 0.4 AND vibration_g > 0.3',
  },
}

const demoObject = {
  _readme:
    'Canonical Manu demo object (BuildGuard Node) for World Model integration. ' +
    'Catalog fields are generated from frontend/data/component-catalog.json; world_model_state is the spec from docs/worldmodel.md. ' +
    'Regenerate with: node frontend/scripts/export-demo-object.mjs',
  object_id: 'buildguard-node',
  name: 'BuildGuard Node',
  description:
    'Low-maintenance facade sensor node for aging Hong Kong residential buildings; monitors crack propagation, vibration, tilt, moisture ingress and enclosure health between Mandatory Building Inspection cycles.',
  demo_prompt:
    'A 52-year-old Hong Kong residential building needs a low-maintenance facade sensor node that monitors crack propagation, vibration anomalies, tilt shifts and moisture ingress, and creates early warnings before the next Mandatory Building Inspection.',
  deployment_context: {
    city: 'Hong Kong',
    site: '52-year-old residential building',
    surface: 'outdoor facade',
    regulation: 'Mandatory Building Inspection Scheme',
    environment: ['humidity', 'rain', 'typhoon wind', 'pollution'],
    climate: { humidity: 'high', rainfall: 'heavy', wind: 'typhoon-exposed' },
    mounting: ['facade-mounted', 'low-maintenance', 'limited access'],
    power: ['battery-powered', 'no mains assumed'],
    connectivity: ['LoRa', 'NB-IoT'],
    privacy: ['no camera', 'no audio', 'structural data only'],
    goal: 'early warning between inspections',
  },
  component_graph: {
    node_type: 'facade-sensor-node',
    base_component_ids: BASE_IDS,
    fix_component_ids: FIX_IDS,
  },
  components: baseComponents,
  fix_components: fixComponents,
  bom: {
    base: { rows: bomRows(baseComponents), total_cost_usd: baseTotal },
    after_fix: {
      rows: bomRows([...baseComponents, ...fixComponents]),
      total_cost_usd: fixedTotal,
    },
    cost_path_usd: { before_fix: baseTotal, after_fix: fixedTotal },
  },
  scene_graph: {
    note: 'Geometry from catalog. assembly metadata (placement/parent/anchor/contact) is inferred at runtime by the Scene resolver.',
    nodes: baseComponents.map((c) => ({ component_id: c.id, ...c.scene })),
  },
  world_model_state: worldModelState,
}

const outPath = path.join(REPO_ROOT, 'demo-object.json')
fs.writeFileSync(outPath, JSON.stringify(demoObject, null, 2) + '\n')
console.log(`Wrote ${outPath}`)
console.log(`Base BOM: $${baseTotal}  |  After fix: $${fixedTotal}`)
