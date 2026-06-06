#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import * as z from 'zod/v4'
import { readData, toolResult } from './shared.mjs'

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
