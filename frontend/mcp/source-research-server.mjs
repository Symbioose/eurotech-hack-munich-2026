#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import * as z from 'zod/v4'
import { toolResult } from './shared.mjs'
import { candidateUpdatePolicy, tavilySearch } from './tavily.mjs'

const server = new McpServer({ name: 'physical-cursor-source-research-mcp', version: '1.0.0' })

server.registerTool(
  'search_official_sources',
  {
    title: 'Search Official Sources',
    description: 'Use Tavily to search official or allowlisted sources for regulatory or technical updates.',
    inputSchema: {
      query: z.string(),
      allowed_domains: z.array(z.string()).default([]),
      max_results: z.number().min(1).max(10).default(5),
    },
  },
  async ({ query, allowed_domains, max_results }) => {
    const search = await tavilySearch({
      query,
      allowed_domains,
      max_results,
      search_depth: 'basic',
      include_raw_content: false,
    })
    return toolResult({
      ...search,
      update_policy: candidateUpdatePolicy('source'),
    })
  }
)

server.registerTool(
  'research_component_availability',
  {
    title: 'Research Component Availability',
    description: 'Use Tavily to find candidate distributor/datasheet sources for component availability.',
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

server.registerTool(
  'research_regulatory_update',
  {
    title: 'Research Regulatory Update',
    description: 'Use Tavily to find candidate official regulatory updates for a jurisdiction and device type.',
    inputSchema: {
      jurisdiction: z.string(),
      device_type: z.string(),
      allowed_domains: z.array(z.string()).default([]),
    },
  },
  async ({ jurisdiction, device_type, allowed_domains }) => {
    const query = `${jurisdiction} official requirements ${device_type} certification regulation`
    const search = await tavilySearch({ query, allowed_domains, max_results: 5 })
    return toolResult({
      ...search,
      jurisdiction,
      device_type,
      update_policy: candidateUpdatePolicy('compliance'),
    })
  }
)

const transport = new StdioServerTransport()
await server.connect(transport)
console.error('physical-cursor-source-research-mcp running on stdio')
