import { describe, expect, it } from 'vitest'
import { loadCatalog } from '../lib/pipeline/load-data'
import { resolveScene } from '../lib/pipeline/scene-resolver'
import { sceneToUI } from '../lib/pipeline/to-ui'

const COMPONENTS = [
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

function sceneById() {
  const scene = resolveScene(
    {
      node_type: 'outdoor-facade-node',
      selected_component_ids: COMPONENTS,
    },
    loadCatalog()
  )
  return new Map(scene.nodes.map((node) => [node.scene_id, node]))
}

describe('scene assembly metadata', () => {
  it('annotates every visible node with physical assembly metadata', () => {
    const nodes = [...sceneById().values()]

    expect(nodes.length).toBeGreaterThan(0)
    for (const node of nodes) {
      expect(node.assembly).toEqual(
        expect.objectContaining({
          placement: expect.any(String),
          anchor_face: expect.any(String),
          contact: expect.any(String),
        })
      )
    }
  })

  it('declares parent and contact rules for core BuildGuard parts', () => {
    const nodes = sceneById()

    expect(nodes.get('enclosure')?.assembly).toEqual(
      expect.objectContaining({
        placement: 'root',
        parent_scene_id: null,
        anchor_face: 'center',
        contact: 'reference-volume',
      })
    )
    expect(nodes.get('compute')?.assembly).toEqual(
      expect.objectContaining({
        placement: 'internal',
        parent_scene_id: 'enclosure',
        anchor_face: 'inside',
        contact: 'standoff-mounted',
      })
    )
    expect(nodes.get('bracket')?.assembly).toEqual(
      expect.objectContaining({
        placement: 'mount',
        parent_scene_id: 'enclosure',
        anchor_face: 'back',
        contact: 'surface-mounted',
      })
    )
    expect(nodes.get('gasket')?.assembly).toEqual(
      expect.objectContaining({
        placement: 'seal',
        parent_scene_id: 'enclosure',
        anchor_face: 'front',
        contact: 'flush-mounted',
      })
    )
  })

  it('preserves assembly metadata when converting scene nodes to UI components', () => {
    const components = sceneToUI([...sceneById().values()])
    const compute = components.find((component) => component.id === 'compute')

    expect(compute?.assembly).toEqual(
      expect.objectContaining({
        placement: 'internal',
        parentSceneId: 'enclosure',
        anchorFace: 'inside',
      })
    )
  })
})
