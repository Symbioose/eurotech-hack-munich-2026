import { describe, expect, it } from 'vitest'
import { callMcpTool } from '../lib/mcp/client'

const DEPLOYMENT_CONTEXT = {
  city: 'Hong Kong',
  site: '52-year-old residential building',
  surface: 'outdoor facade',
  regulation: 'Mandatory Building Inspection Scheme',
  environment: ['humidity', 'rain', 'typhoon wind'],
  climate: { humidity: 'high', rainfall: 'heavy', wind: 'typhoon-exposed' },
  mounting: ['facade-mounted', 'limited access'],
  power: ['battery-powered'],
  connectivity: ['LoRa', 'NB-IoT'],
  privacy: ['no camera', 'structural data only'],
  goal: 'early warning between inspections for crack, vibration, tilt and moisture',
}

describe('MCP expert servers', () => {
  it('calls compliance_mcp.search_requirements over stdio', async () => {
    const result = await callMcpTool('compliance', 'search_requirements', {
      deploymentContext: DEPLOYMENT_CONTEXT,
    })

    expect(result.requirements.map((r: { id: string }) => r.id)).toContain(
      'HK_MBIS_REGISTERED_INSPECTOR'
    )
    expect(result.requirements.map((r: { id: string }) => r.id)).toContain(
      'HK_OFCA_RADIO_EQUIPMENT'
    )
  })

  it('calls hardware_mcp.match_assembly_pattern over stdio', async () => {
    const result = await callMcpTool('hardware', 'match_assembly_pattern', {
      deploymentContext: DEPLOYMENT_CONTEXT,
      componentGraph: {
        node_type: 'outdoor-facade-node',
        selected_component_ids: [
          'weatherproof-enclosure',
          'crack-displacement-sensor',
          'vibration-sensor',
          'tilt-sensor',
          'moisture-sensor',
          'edge-compute-board',
          'lora-nbiot-module',
          'battery-pack',
          'mounting-bracket',
        ],
      },
    })

    expect(result.pattern_id).toBe('outdoor-battery-facade-iot-node')
    expect(result.required_component_ids).toContain('weatherproof-enclosure')
  })

  it('calls supplier_mcp.route_bom_to_gba over stdio', async () => {
    const result = await callMcpTool('supplier', 'route_bom_to_gba', {
      componentGraph: {
        node_type: 'outdoor-facade-node',
        selected_component_ids: ['weatherproof-enclosure', 'lora-nbiot-module'],
      },
      dfmaWarnings: [
        {
          id: 'IP_INSUFFICIENT',
          rfq_topic_tags: ['weatherproofing', 'corrosion'],
        },
      ],
      fixApplied: false,
    })

    expect(result.gba_route).toHaveLength(4)
    expect(result.supplier_questions.length).toBeGreaterThan(0)
  })

  it('supplier_mcp filters RFQ questions to selected components', async () => {
    const result = await callMcpTool('supplier', 'route_bom_to_gba', {
      componentGraph: {
        node_type: 'indoor-ceiling-node',
        selected_component_ids: ['edge-compute-board', 'mmwave-presence'],
      },
      dfmaWarnings: [],
      fixApplied: false,
    })

    const questions = result.supplier_questions.map((q: { question: string }) => q.question)
    expect(questions.join(' ')).not.toContain('crack displacement sensor')
    expect(questions.join(' ')).toContain('edge compute board')
  })

  it('source_research_mcp exposes honest Tavily-backed search status', async () => {
    const result = await callMcpTool('sourceResearch', 'search_official_sources', {
      query: 'Hong Kong OFCA radio equipment certification LoRa NB-IoT',
      allowed_domains: ['ofca.gov.hk'],
      max_results: 3,
    })

    expect(result.provider).toBe('tavily')
    expect(['ok', 'not_configured']).toContain(result.status)
    expect(result.query).toContain('OFCA')
  })

  it('hardware_mcp can research component availability via source research layer', async () => {
    const result = await callMcpTool('hardware', 'research_component_availability', {
      query: 'LoRa NB-IoT module low power outdoor IoT availability',
      allowed_domains: ['digikey.com', 'mouser.com', 'lcsc.com'],
    })

    expect(result.provider).toBe('tavily')
    expect(['ok', 'not_configured']).toContain(result.status)
    expect(result.update_policy).toContain('candidate')
  })

  it('compliance_mcp can refresh official sources without trusting arbitrary domains', async () => {
    const result = await callMcpTool('compliance', 'refresh_sources', {
      jurisdiction: 'Hong Kong',
      device_type: 'outdoor wireless smart building sensor',
    })

    expect(result.provider).toBe('tavily')
    expect(result.allowed_domains).toContain('bd.gov.hk')
    expect(result.allowed_domains).toContain('ofca.gov.hk')
    expect(result.update_policy).toContain('human-reviewable')
  })
})
