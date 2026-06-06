#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import * as z from 'zod/v4'
import { includesAny, readData, toolResult } from './shared.mjs'
import { candidateUpdatePolicy, tavilySearch } from './tavily.mjs'

const HK_OFFICIAL_DOMAINS = ['bd.gov.hk', 'ofca.gov.hk', 'pcpd.org.hk', 'emsd.gov.hk']

function requirementApplies(ctx, appliesWhen) {
  const checks = [
    appliesWhen.site_keywords ? includesAny(ctx.site, appliesWhen.site_keywords) : true,
    appliesWhen.surface_keywords ? includesAny(ctx.surface, appliesWhen.surface_keywords) : true,
    appliesWhen.regulation_keywords
      ? includesAny(ctx.regulation ?? '', appliesWhen.regulation_keywords)
      : true,
    appliesWhen.connectivity_keywords
      ? includesAny((ctx.connectivity ?? []).join(' '), appliesWhen.connectivity_keywords)
      : true,
    appliesWhen.privacy_keywords
      ? includesAny((ctx.privacy ?? []).join(' '), appliesWhen.privacy_keywords)
      : true,
  ]
  return checks.every(Boolean)
}

function searchRequirements(deploymentContext) {
  const rules = readData('compliance-rules.json')
  const requirements = rules.requirements
    .filter((rule) => rule.city.toLowerCase() === deploymentContext.city.toLowerCase())
    .filter((rule) => requirementApplies(deploymentContext, rule.applies_when))
    .map((rule) => ({
      id: rule.id,
      city: rule.city,
      title: rule.title,
      constraint: rule.constraint,
      authority: rule.authority,
      source_url: rule.source_url,
      source_status: rule.source_status,
      last_checked_at: rule.last_checked_at,
      update_strategy: rule.update_strategy,
      risk_tags: rule.risk_tags,
    }))

  return { requirements }
}

const server = new McpServer({ name: 'physical-cursor-compliance-mcp', version: '1.0.0' })

server.registerTool(
  'search_requirements',
  {
    title: 'Search City Compliance Requirements',
    description: 'Return city-specific legal, certification and claim constraints for a smart-city node.',
    inputSchema: { deploymentContext: z.record(z.string(), z.any()) },
  },
  async ({ deploymentContext }) => toolResult(searchRequirements(deploymentContext))
)

server.registerTool(
  'check_claims',
  {
    title: 'Check Product Claims',
    description: 'Flag claims that overstate what the smart-city node can legally or safely promise.',
    inputSchema: {
      deploymentContext: z.record(z.string(), z.any()),
      claims: z.array(z.string()),
    },
  },
  async ({ deploymentContext, claims }) => {
    const requirements = searchRequirements(deploymentContext).requirements
    const riskyClaims = claims.filter((claim) => {
      const lower = claim.toLowerCase()
      return lower.includes('replace') || lower.includes('certified safe') || lower.includes('guarantee')
    })

    return toolResult({
      requirements,
      risky_claims: riskyClaims,
      safe_positioning:
        'Position Physical Cursor outputs as reviewable hardware briefs and early-warning aids, not certified engineering decisions.',
    })
  }
)

server.registerTool(
  'refresh_sources',
  {
    title: 'Refresh Compliance Sources',
    description: 'Use Tavily against official allowlisted domains to find candidate compliance updates.',
    inputSchema: {
      jurisdiction: z.string(),
      device_type: z.string(),
      allowed_domains: z.array(z.string()).optional(),
      max_results: z.number().min(1).max(10).default(5),
    },
  },
  async ({ jurisdiction, device_type, allowed_domains, max_results }) => {
    const domains =
      allowed_domains && allowed_domains.length > 0
        ? allowed_domains
        : jurisdiction.toLowerCase().includes('hong kong')
          ? HK_OFFICIAL_DOMAINS
          : []
    const query = `${jurisdiction} official requirements ${device_type} certification regulation`
    const search = await tavilySearch({
      query,
      allowed_domains: domains,
      max_results,
      search_depth: 'basic',
    })

    return toolResult({
      ...search,
      jurisdiction,
      device_type,
      allowed_domains: domains,
      update_policy: candidateUpdatePolicy('compliance'),
    })
  }
)

const transport = new StdioServerTransport()
await server.connect(transport)
console.error('physical-cursor-compliance-mcp running on stdio')
