#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import * as z from 'zod/v4'
import { readData, scoreKeywords, toolResult } from './shared.mjs'
import { candidateUpdatePolicy, tavilySearch } from './tavily.mjs'

function selectedTags(componentGraph) {
  const catalog = readData('component-catalog.json')
  const byId = new Map(catalog.components.map((component) => [component.id, component]))
  return new Set((componentGraph.selected_component_ids ?? []).flatMap((id) => byId.get(id)?.tags ?? []))
}

function scoreTagOverlap(tags, pattern) {
  const keywords = [
    ...(pattern.applies_when.surface_keywords ?? []),
    ...(pattern.applies_when.power_keywords ?? []),
    ...(pattern.applies_when.privacy_keywords ?? []),
    ...(pattern.applies_when.goal_keywords ?? []),
  ]
  return keywords.filter((keyword) => tags.has(keyword)).length * 2
}

function scorePattern(ctx, componentGraph, pattern) {
  return (
    scoreKeywords(ctx.surface, pattern.applies_when.surface_keywords) +
    scoreKeywords((ctx.power ?? []).join(' '), pattern.applies_when.power_keywords) +
    scoreKeywords((ctx.privacy ?? []).join(' '), pattern.applies_when.privacy_keywords) +
    scoreKeywords(ctx.goal, pattern.applies_when.goal_keywords) +
    scoreTagOverlap(selectedTags(componentGraph), pattern)
  )
}

function matchAssemblyPattern(deploymentContext, componentGraph) {
  const { patterns } = readData('assembly-patterns.json')
  const pattern = [...patterns].sort(
    (a, b) =>
      scorePattern(deploymentContext, componentGraph, b) -
      scorePattern(deploymentContext, componentGraph, a)
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

function componentText(component) {
  return `${component.id} ${component.part} ${component.category} ${(component.tags ?? []).join(' ')}`.toLowerCase()
}

function searchComponents({ query = '', tags = [], category = '', limit = 20 }) {
  const catalog = readData('component-catalog.json')
  const q = query.toLowerCase().trim()
  const wantedTags = new Set(tags)
  const results = catalog.components
    .map((component) => {
      const text = componentText(component)
      const queryScore = q && text.includes(q) ? 4 : 0
      const tagScore = (component.tags ?? []).filter((tag) => wantedTags.has(tag)).length * 3
      const categoryScore = category && component.category === category ? 2 : 0
      const keep =
        (!q || queryScore > 0) &&
        (wantedTags.size === 0 || tagScore > 0) &&
        (!category || component.category === category)
      return { component, score: keep ? queryScore + tagScore + categoryScore : -1 }
    })
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => b.score - a.score || a.component.id.localeCompare(b.component.id))
    .slice(0, Math.max(1, Math.min(50, limit)))
    .map((entry) => entry.component)

  return { components: results }
}

function recommendComponents({ deploymentContext, limit = 20 }) {
  const catalog = readData('component-catalog.json')
  const rules = readData('component-selection-rules.json')
  const text = [
    deploymentContext.surface,
    deploymentContext.goal,
    deploymentContext.site,
    ...(deploymentContext.environment ?? []),
    ...(deploymentContext.mounting ?? []),
    ...(deploymentContext.power ?? []),
    ...(deploymentContext.connectivity ?? []),
    ...(deploymentContext.privacy ?? []),
  ]
    .join(' ')
    .toLowerCase()

  const byId = new Map(catalog.components.map((component) => [component.id, component]))
  const selected = new Map()
  for (const rule of rules.rules ?? []) {
    if (!rule.keywords?.some((keyword) => text.includes(String(keyword).toLowerCase()))) continue
    for (const id of rule.component_ids ?? []) {
      const component = byId.get(id)
      if (component) selected.set(id, component)
    }
    for (const tag of rule.select_tags ?? []) {
      for (const component of catalog.components) {
        if (component.tags?.includes(tag) && component.category !== 'fix') {
          selected.set(component.id, component)
        }
      }
    }
  }

  return { components: [...selected.values()].slice(0, Math.max(1, Math.min(50, limit))) }
}

function getComponent({ id }) {
  const catalog = readData('component-catalog.json')
  const component = catalog.components.find((entry) => entry.id === id)
  if (!component) return { error: `Component not found: ${id}` }
  return component
}

function listComponentFamilies() {
  const catalog = readData('component-catalog.json')
  const rules = readData('component-selection-rules.json')
  const families = [...new Set(catalog.components.map((component) => component.category))].sort()
  const ruleWords = new Set(
    (rules.rules ?? []).flatMap((rule) => [
      ...(rule.keywords ?? []),
      ...(rule.select_tags ?? []),
    ])
  )
  const tags = [...new Set(catalog.components.flatMap((component) => component.tags ?? []))]
  const intentTags = tags
    .filter((tag) => ruleWords.has(tag) || ruleWords.has(tag.replace(/-/g, ' ')))
    .sort()

  return { families, intent_tags: intentTags }
}

const server = new McpServer({ name: 'physical-cursor-hardware-mcp', version: '1.0.0' })

server.registerTool(
  'search_components',
  {
    title: 'Search Smart-City Components',
    description: 'Search the grounded smart-city hardware catalog by query, tag or category.',
    inputSchema: {
      query: z.string().optional(),
      tags: z.array(z.string()).optional(),
      category: z.string().optional(),
      limit: z.number().min(1).max(50).default(20),
    },
  },
  async (input) => toolResult(searchComponents(input))
)

server.registerTool(
  'recommend_components',
  {
    title: 'Recommend Smart-City Components',
    description: 'Recommend catalog components from a deployment context.',
    inputSchema: {
      deploymentContext: z.record(z.string(), z.any()),
      limit: z.number().min(1).max(50).default(20),
    },
  },
  async (input) => toolResult(recommendComponents(input))
)

server.registerTool(
  'get_component',
  {
    title: 'Get Component',
    description: 'Return one catalog component by id.',
    inputSchema: { id: z.string() },
  },
  async (input) => toolResult(getComponent(input))
)

server.registerTool(
  'list_component_families',
  {
    title: 'List Component Families',
    description: 'List available catalog categories and primary smart-city intent tags.',
    inputSchema: {},
  },
  async () => toolResult(listComponentFamilies())
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
