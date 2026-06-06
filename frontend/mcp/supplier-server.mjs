#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import * as z from 'zod/v4'
import { readData, toolResult } from './shared.mjs'

const GBA_REGION_KEYWORDS = [
  'hong kong',
  'hongkong',
  'hk',
  'shenzhen',
  'dongguan',
  'guangzhou',
  'macau',
  'macao',
  'zhuhai',
  'foshan',
  'greater bay',
]

function selectRoute(supplierGraph, deploymentContext) {
  if (!deploymentContext || !supplierGraph.generic_route?.length) return supplierGraph.gba_route
  const haystack = `${deploymentContext.city ?? ''} ${deploymentContext.site ?? ''}`.toLowerCase()
  const isGba = GBA_REGION_KEYWORDS.some((keyword) => haystack.includes(keyword))
  return isGba ? supplierGraph.gba_route : supplierGraph.generic_route
}

function routeBomToGba(componentGraph, dfmaWarnings = [], fixApplied = false, deploymentContext = null) {
  const supplierGraph = readData('supplier-graph.json')
  const graphIds = new Set(componentGraph.selected_component_ids ?? [])
  const questions = supplierGraph.base_rfq_questions.filter((question) =>
    question.related_component_ids.some((id) => graphIds.has(id))
  )

  for (const warning of dfmaWarnings) {
    for (const tag of warning.rfq_topic_tags ?? []) {
      const template = supplierGraph.topic_rfq_templates[tag]
      if (template) {
        questions.push({
          topic: tag,
          question: template.question,
          related_component_ids: template.related_component_ids.filter((id) => graphIds.has(id)),
        })
      }
    }
  }

  if (fixApplied) {
    questions.push({
      topic: 'gasket',
      question: 'Gasket material and compression specification for IP67 facade seal?',
      related_component_ids: ['ip67-gasket-kit', 'weatherproof-enclosure'],
    })
    questions.push({
      topic: 'drainage',
      question: 'Drainage channel dimensions and slope for typhoon rain runoff?',
      related_component_ids: ['weatherproof-enclosure', 'drainage-lip'],
    })
  }

  const seen = new Set()
  const supplier_questions = questions.filter((question) => {
    if (seen.has(question.question)) return false
    seen.add(question.question)
    return true
  })

  return {
    supplier_questions,
    gba_route: selectRoute(supplierGraph, deploymentContext),
  }
}

const server = new McpServer({ name: 'physical-cursor-supplier-mcp', version: '1.0.0' })

server.registerTool(
  'route_bom_to_gba',
  {
    title: 'Route BOM To GBA Suppliers',
    description: 'Map a component graph and risks to a Hong Kong / Greater Bay Area supplier route.',
    inputSchema: {
      componentGraph: z.object({
        node_type: z.string(),
        selected_component_ids: z.array(z.string()),
      }),
      deploymentContext: z.record(z.string(), z.any()).optional(),
      dfmaWarnings: z.array(z.record(z.string(), z.any())).optional(),
      fixApplied: z.boolean().optional(),
    },
  },
  async ({ componentGraph, dfmaWarnings = [], fixApplied = false, deploymentContext = null }) =>
    toolResult(routeBomToGba(componentGraph, dfmaWarnings, fixApplied, deploymentContext))
)

server.registerTool(
  'generate_rfq_questions',
  {
    title: 'Generate Supplier RFQ Questions',
    description: 'Generate RFQ questions from component IDs and risk tags.',
    inputSchema: {
      componentGraph: z.object({
        node_type: z.string(),
        selected_component_ids: z.array(z.string()),
      }),
      dfmaWarnings: z.array(z.record(z.string(), z.any())).optional(),
    },
  },
  async ({ componentGraph, dfmaWarnings = [] }) =>
    toolResult({
      supplier_questions: routeBomToGba(componentGraph, dfmaWarnings, false).supplier_questions,
    })
)

const transport = new StdioServerTransport()
await server.connect(transport)
console.error('physical-cursor-supplier-mcp running on stdio')
