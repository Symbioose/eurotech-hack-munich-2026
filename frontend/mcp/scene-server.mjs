#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import * as z from 'zod/v4'
import { readData, toolResult } from './shared.mjs'

function inferSceneAssembly(component) {
  const sceneId = component.scene?.scene_id ?? component.id
  const tags = new Set(component.tags ?? [])

  if (sceneId === 'enclosure') {
    return {
      placement: 'root',
      parent_scene_id: null,
      anchor_face: 'center',
      contact: 'reference-volume',
    }
  }

  if (sceneId === 'bracket') {
    return {
      placement: 'mount',
      parent_scene_id: 'enclosure',
      anchor_face: 'back',
      contact: 'surface-mounted',
    }
  }

  if (sceneId === 'solar') {
    return {
      placement: 'power-surface',
      parent_scene_id: 'enclosure',
      anchor_face: 'top',
      contact: 'surface-mounted',
    }
  }

  if (sceneId === 'gasket') {
    return {
      placement: 'seal',
      parent_scene_id: 'enclosure',
      anchor_face: 'front',
      contact: 'flush-mounted',
    }
  }

  if (sceneId === 'membrane') {
    return {
      placement: 'seal',
      parent_scene_id: 'moisture-sensor',
      anchor_face: 'front',
      contact: 'flush-mounted',
    }
  }

  if (sceneId === 'fasteners') {
    return {
      placement: 'fastener',
      parent_scene_id: 'bracket',
      anchor_face: 'front',
      contact: 'surface-mounted',
    }
  }

  if (sceneId === 'drainage-lip') {
    return {
      placement: 'drainage',
      parent_scene_id: 'enclosure',
      anchor_face: 'bottom',
      contact: 'edge-mounted',
    }
  }

  if (sceneId === 'cable-gland') {
    return {
      placement: 'external',
      parent_scene_id: 'enclosure',
      anchor_face: 'front',
      contact: 'pass-through',
    }
  }

  if (tags.has('crack') || tags.has('moisture') || tags.has('air-quality')) {
    return {
      placement: 'external',
      parent_scene_id: 'enclosure',
      anchor_face: 'front',
      contact: tags.has('crack') ? 'probe-mounted' : 'flush-mounted',
    }
  }

  if (tags.has('presence')) {
    return {
      placement: 'external',
      parent_scene_id: 'enclosure',
      anchor_face: 'front',
      contact: 'flush-mounted',
    }
  }

  if (component.category === 'power' && tags.has('battery')) {
    return {
      placement: 'internal',
      parent_scene_id: 'enclosure',
      anchor_face: 'inside',
      contact: 'tray-mounted',
    }
  }

  return {
    placement: 'internal',
    parent_scene_id: 'enclosure',
    anchor_face: 'inside',
    contact: 'standoff-mounted',
  }
}

function generateSceneGraph(componentGraph) {
  const catalog = readData('component-catalog.json')
  const byId = new Map(catalog.components.map((component) => [component.id, component]))
  const nodes = (componentGraph.selected_component_ids ?? [])
    .map((id) => byId.get(id))
    .filter((component) => component?.scene)
    .map((component) => ({
      component_id: component.id,
      scene_id: component.scene.scene_id,
      label: component.scene.label,
      position: component.scene.position,
      explodeOffset: component.scene.explodeOffset,
      color: component.scene.color,
      geometry: component.scene.geometry,
      scale: component.scene.scale,
      assembly: component.scene.assembly ?? inferSceneAssembly(component),
    }))

  return { nodes }
}

const server = new McpServer({ name: 'physical-cursor-scene-mcp', version: '1.0.0' })

server.registerTool(
  'generate_scene_graph',
  {
    title: 'Generate 3D Scene Graph',
    description: 'Map catalog component IDs to the parametric 3D smart-city node scene graph.',
    inputSchema: {
      componentGraph: z.object({
        node_type: z.string(),
        selected_component_ids: z.array(z.string()),
      }),
    },
  },
  async ({ componentGraph }) => toolResult(generateSceneGraph(componentGraph))
)

const transport = new StdioServerTransport()
await server.connect(transport)
console.error('physical-cursor-scene-mcp running on stdio')
