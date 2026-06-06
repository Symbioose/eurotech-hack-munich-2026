import type { ContextField, BOMRow, Component3D, SimulationWarning } from './types'

export const DEPLOYMENT_CONTEXT: ContextField[] = [
  { label: 'City', value: 'Hong Kong' },
  { label: 'Site', value: '52-year-old residential building' },
  { label: 'Surface', value: 'Outdoor facade' },
  { label: 'Regulation', value: 'Mandatory Building Inspection Scheme' },
  { label: 'Environment', value: 'Humidity, rain, typhoon wind, pollution' },
  { label: 'Mounting', value: 'Facade-mounted, low-maintenance, limited access' },
  { label: 'Power', value: 'Battery-powered, no mains assumed' },
  { label: 'Connectivity', value: 'LoRa / NB-IoT' },
  { label: 'Privacy', value: 'No camera, no audio — structural data only' },
]

export const BOM_BEFORE_FIX: BOMRow[] = [
  { id: 'enclosure', part: 'Weatherproof enclosure', supplierRoute: 'Dongguan enclosure/plastics', cost: 28, componentId: 'enclosure' },
  { id: 'crack', part: 'Crack displacement sensor', supplierRoute: 'Shenzhen sensor EMS', cost: 34, componentId: 'crack-sensor' },
  { id: 'vibration', part: 'Vibration / IMU sensor', supplierRoute: 'Shenzhen distributor', cost: 18, componentId: 'vibration-sensor' },
  { id: 'tilt', part: 'Tilt sensor', supplierRoute: 'Shenzhen distributor', cost: 22, componentId: 'tilt-sensor' },
  { id: 'moisture', part: 'Moisture / humidity sensor', supplierRoute: 'Shenzhen distributor', cost: 16, componentId: 'moisture-sensor' },
  { id: 'compute', part: 'Edge compute board', supplierRoute: 'Shenzhen EMS', cost: 44, componentId: 'compute' },
  { id: 'radio', part: 'LoRa / NB-IoT module', supplierRoute: 'Shenzhen electronics', cost: 19, componentId: 'radio' },
  { id: 'battery', part: 'Battery module', supplierRoute: 'HK/GZ distributor', cost: 24, componentId: 'battery' },
  { id: 'bracket', part: 'Mounting bracket', supplierRoute: 'Dongguan metal fab', cost: 8, componentId: 'bracket' },
]

export const BOM_FIX_ADDITIONS: BOMRow[] = [
  { id: 'gasket', part: 'IP67 gasket kit', supplierRoute: 'Dongguan enclosure supplier', cost: 8, isNew: true },
  { id: 'membrane', part: 'PTFE membrane', supplierRoute: 'Shenzhen distributor', cost: 4, isNew: true },
  { id: 'fasteners', part: '316L stainless fasteners', supplierRoute: 'Dongguan metal fab', cost: 2, isNew: true },
]

export const COST_BEFORE = 213
export const COST_AFTER = 227

export const COMPONENTS_3D: Component3D[] = [
  { id: 'enclosure', label: 'Weatherproof Enclosure', position: [0, 0, 0], explodeOffset: [0, 0, 0], color: '#334155', geometry: 'box', scale: [1.2, 1.6, 0.8] },
  { id: 'crack-sensor', label: 'Crack Sensor', position: [0.7, -0.4, 0.5], explodeOffset: [1.5, -0.8, 1.0], color: '#1d4ed8', geometry: 'box', scale: [0.15, 0.5, 0.1] },
  { id: 'vibration-sensor', label: 'Vibration / IMU', position: [-0.3, 0.2, 0.3], explodeOffset: [-1.2, 0.8, 1.0], color: '#7c3aed', geometry: 'box', scale: [0.25, 0.15, 0.25] },
  { id: 'tilt-sensor', label: 'Tilt Sensor', position: [0.2, 0.5, 0.3], explodeOffset: [1.0, 1.5, 1.0], color: '#0891b2', geometry: 'cylinder', scale: [0.12, 0.25, 0.12] },
  { id: 'moisture-sensor', label: 'Moisture Sensor', position: [-0.4, -0.3, 0.3], explodeOffset: [-1.0, -1.2, 1.0], color: '#059669', geometry: 'cylinder', scale: [0.1, 0.2, 0.1] },
  { id: 'compute', label: 'Edge Compute Board', position: [0, 0, 0.1], explodeOffset: [0, 0, 1.5], color: '#b45309', geometry: 'box', scale: [0.7, 0.5, 0.05] },
  { id: 'radio', label: 'LoRa / NB-IoT', position: [0.3, -0.2, 0.2], explodeOffset: [1.2, -0.5, 1.2], color: '#be123c', geometry: 'box', scale: [0.3, 0.15, 0.08] },
  { id: 'battery', label: 'Battery Module', position: [0, -0.5, 0], explodeOffset: [0, -1.8, 0.5], color: '#4d7c0f', geometry: 'box', scale: [0.8, 0.4, 0.3] },
  { id: 'bracket', label: 'Mounting Bracket', position: [0, 0, -0.5], explodeOffset: [0, 0, -2.0], color: '#6b7280', geometry: 'box', scale: [1.4, 0.1, 0.6] },
]

export const MOCK_WARNING: SimulationWarning = {
  id: 'IP_INSUFFICIENT',
  category: 'environmental',
  severity: 'critical',
  title: 'Weatherproofing Risk',
  explanation: 'Moisture sensor and crack gauge exposed to Hong Kong humidity and typhoon rain — no IP-rated gasket, drainage path or protected sensor membrane detected.',
  affectedComponents: ['enclosure', 'moisture-sensor', 'crack-sensor'],
  fix: {
    label: 'Add IP67 gasket + PTFE membrane + drainage lip',
    componentChanges: [{ id: 'enclosure', note: 'add gasket seal + drainage channel' }],
    bomChanges: [
      { part: 'IP67 gasket kit', supplierRoute: 'Dongguan enclosure supplier', cost: 8, isNew: true },
      { part: 'PTFE membrane', supplierRoute: 'Shenzhen distributor', cost: 4, isNew: true },
      { part: '316L stainless fasteners', supplierRoute: 'Dongguan metal fab', cost: 2, isNew: true },
    ],
    costDelta: 14,
    rfqQuestionsAdded: [
      'IP rating and test method for the enclosure?',
      'Gasket material and compression specification?',
      'Drainage channel dimensions and slope?',
    ],
  },
}

export const RFQ_QUESTIONS_BASE = [
  'What is the minimum order quantity for the crack displacement sensor?',
  'Does the LoRa module carry CE/FCC certification?',
  'What is the enclosure operating temperature range?',
  'Can the battery module be replaced in the field without tools?',
  'What is the lead time for the edge compute board at 50 units?',
]

export const GBA_ROUTE_STOPS = [
  { stop: 'hk-integrator' as const, label: 'HK Pilot Integrator', desc: 'Property manager / OC / Registered Inspector coordination' },
  { stop: 'sz-ems' as const, label: 'Shenzhen EMS', desc: 'PCB, sensors, MCU, radio module assembly' },
  { stop: 'dg-enclosure' as const, label: 'Dongguan Partner', desc: 'Weatherproof housing, bracket, gasket, fasteners' },
  { stop: 'hk-compliance' as const, label: 'HK / GZ Compliance', desc: 'RF certification, battery shipping, pilot documentation' },
]
