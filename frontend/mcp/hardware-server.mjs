#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import * as z from 'zod/v4'
import { includesAny, readData, scoreKeywords, toolResult } from './shared.mjs'
import { candidateUpdatePolicy, tavilySearch } from './tavily.mjs'

function scorePattern(ctx, pattern) {
  return (
    scoreKeywords(ctx.surface, pattern.applies_when.surface_keywords) +
    scoreKeywords((ctx.power ?? []).join(' '), pattern.applies_when.power_keywords) +
    scoreKeywords((ctx.privacy ?? []).join(' '), pattern.applies_when.privacy_keywords) +
    scoreKeywords(ctx.goal, pattern.applies_when.goal_keywords)
  )
}

function matchAssemblyPattern(deploymentContext, componentGraph) {
  const { patterns } = readData('assembly-patterns.json')
  const pattern = [...patterns].sort(
    (a, b) => scorePattern(deploymentContext, b) - scorePattern(deploymentContext, a)
  )[0]
  const selected = new Set(componentGraph.selected_component_ids ?? [])

  return {
    pattern_id: pattern.id,
    label: pattern.label,
    required_component_ids: pattern.required_component_ids,
    recommended_component_ids: pattern.recommended_component_ids,
    missing_required_component_ids: pattern.required_component_ids.filter((id) => !selected.has(id)),
    constraints: pattern.constraints,
    assembly_steps: pattern.assembly_steps,
  }
}

const server = new McpServer({ name: 'physical-cursor-hardware-mcp', version: '1.0.0' })

server.registerTool(
  'search_components',
  {
    title: 'Search Electronic Components',
    description: 'Search the grounded hardware catalog by query, tag or category.',
    inputSchema: {
      query: z.string().optional(),
      tags: z.array(z.string()).optional(),
      category: z.string().optional(),
    },
  },
  async ({ query = '', tags = [], category = '' }) => {
    const catalog = readData('component-catalog.json')
    const components = catalog.components.filter((component) => {
      const queryOk =
        !query ||
        includesAny(`${component.id} ${component.part} ${component.tags.join(' ')}`, [query])
      const tagsOk = tags.length === 0 || tags.some((tag) => component.tags.includes(tag))
      const categoryOk = !category || component.category === category
      return queryOk && tagsOk && categoryOk
    })
    return toolResult({ components })
  }
)

server.registerTool(
  'match_assembly_pattern',
  {
    title: 'Match Assembly Pattern',
    description: 'Match a deployment context and component graph to a known hardware assembly pattern.',
    inputSchema: {
      deploymentContext: z.record(z.string(), z.any()),
      componentGraph: z.object({
        node_type: z.string(),
        selected_component_ids: z.array(z.string()),
      }),
    },
  },
  async ({ deploymentContext, componentGraph }) =>
    toolResult(matchAssemblyPattern(deploymentContext, componentGraph))
)

server.registerTool(
  'check_compatibility',
  {
    title: 'Check Component Compatibility',
    description: 'Check whether a component graph satisfies the selected assembly pattern.',
    inputSchema: {
      deploymentContext: z.record(z.string(), z.any()),
      componentGraph: z.object({
        node_type: z.string(),
        selected_component_ids: z.array(z.string()),
      }),
    },
  },
  async ({ deploymentContext, componentGraph }) => {
    const assembly = matchAssemblyPattern(deploymentContext, componentGraph)
    return toolResult({
      assembly,
      compatible: assembly.missing_required_component_ids.length === 0,
      blocking_issues: assembly.missing_required_component_ids.map(
        (id) => `Missing required component: ${id}`
      ),
    })
  }
)

server.registerTool(
  'research_component_availability',
  {
    title: 'Research Component Availability',
    description: 'Use Tavily to find candidate distributor and datasheet sources for component availability updates.',
    inputSchema: {
      query: z.string(),
      allowed_domains: z.array(z.string()).default(['digikey.com', 'mouser.com', 'lcsc.com']),
      max_results: z.number().min(1).max(10).default(5),
    },
  },
  async ({ query, allowed_domains, max_results }) => {
    const search = await tavilySearch({ query, allowed_domains, max_results })
    return toolResult({
      ...search,
      update_policy: candidateUpdatePolicy('hardware'),
    })
  }
)

const transport = new StdioServerTransport()
await server.connect(transport)
console.error('physical-cursor-hardware-mcp running on stdio')
