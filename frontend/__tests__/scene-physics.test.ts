import { describe, expect, it } from 'vitest'
import { loadCatalog } from '../lib/pipeline/load-data'
import { resolveScene } from '../lib/pipeline/scene-resolver'

const BUILDGUARD_COMPONENTS = [
  'weatherproof-enclosure',
  'crack-displacement-sensor',
  'vibration-sensor',
  'tilt-sensor',
  'moisture-sensor',
  'edge-compute-board',
  'lora-nbiot-module',
  'battery-pack',
  'mounting-bracket',
  'solar-trickle-panel',
  'ip67-gasket-kit',
  'ptfe-membrane',
  '316l-stainless-fasteners',
  'drainage-lip',
]

function bySceneId() {
  const catalog = loadCatalog()
  const scene = resolveScene(
    {
      node_type: 'outdoor-facade-node',
      selected_component_ids: BUILDGUARD_COMPONENTS,
    },
    catalog
  )
  return new Map(scene.nodes.map((node) => [node.scene_id, node]))
}

describe('scene physical plausibility', () => {
  it('mounts the bracket as a vertical back plate behind the enclosure', () => {
    const nodes = bySceneId()
    const enclosure = nodes.get('enclosure')!
    const bracket = nodes.get('bracket')!

    expect(bracket.position[2]).toBeLessThan(enclosure.position[2] - enclosure.scale[2] / 2)
    expect(bracket.scale[1]).toBeGreaterThan(enclosure.scale[1] * 0.7)
    expect(bracket.scale[2]).toBeLessThan(0.16)
  })

  it('keeps internal electronics inside the enclosure volume', () => {
    const nodes = bySceneId()
    const enclosure = nodes.get('enclosure')!
    const internalIds = ['compute', 'battery', 'radio', 'vibration-sensor', 'tilt-sensor']

    for (const id of internalIds) {
      const node = nodes.get(id)!
      expect(Math.abs(node.position[0]) + node.scale[0] / 2).toBeLessThanOrEqual(enclosure.scale[0] / 2)
      expect(Math.abs(node.position[1]) + node.scale[1] / 2).toBeLessThanOrEqual(enclosure.scale[1] / 2)
      expect(Math.abs(node.position[2]) + node.scale[2] / 2).toBeLessThanOrEqual(enclosure.scale[2] / 2)
    }
  })

  it('places environmental ports and weatherproofing fixes on the front face', () => {
    const nodes = bySceneId()
    const enclosure = nodes.get('enclosure')!
    const frontFace = enclosure.position[2] + enclosure.scale[2] / 2

    for (const id of ['crack-sensor', 'moisture-sensor', 'gasket', 'membrane', 'drainage-lip', 'fasteners']) {
      const node = nodes.get(id)!
      expect(node.position[2]).toBeGreaterThanOrEqual(frontFace - 0.04)
    }
  })

  it('places drainage at the lower edge and solar on the top edge', () => {
    const nodes = bySceneId()
    const enclosure = nodes.get('enclosure')!
    const drainage = nodes.get('drainage-lip')!
    const solar = nodes.get('solar')!

    expect(drainage.position[1]).toBeLessThanOrEqual(enclosure.position[1] - enclosure.scale[1] / 2 + 0.08)
    expect(solar.position[1]).toBeGreaterThan(enclosure.position[1] + enclosure.scale[1] / 2)
  })
})
