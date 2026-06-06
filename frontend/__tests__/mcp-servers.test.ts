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

  it('calls scene_mcp.generate_scene_graph over stdio with visible fix parts', async () => {
    const result = await callMcpTool('scene', 'generate_scene_graph', {
      componentGraph: {
        node_type: 'outdoor-facade-node',
        selected_component_ids: [
          'weatherproof-enclosure',
          'edge-compute-board',
          'battery-pack',
          'ip67-gasket-kit',
          'ptfe-membrane',
          '316l-stainless-fasteners',
          'drainage-lip',
        ],
      },
    })

    const sceneIds = result.nodes.map((node: { scene_id: string }) => node.scene_id)
    expect(sceneIds).toContain('enclosure')
    expect(sceneIds).toContain('compute')
    expect(sceneIds).toContain('battery')
    expect(sceneIds).toContain('gasket')
    expect(sceneIds).toContain('membrane')
    expect(sceneIds).toContain('fasteners')
    expect(sceneIds).toContain('drainage-lip')
    expect(result.nodes.every((node: { assembly?: unknown }) => node.assembly)).toBe(true)
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

  it('hardware_mcp searches the expanded component catalog by tag and limit', async () => {
    const result = await callMcpTool('hardware', 'search_components', {
      query: 'water',
      tags: ['flood'],
      limit: 5,
    })

    expect(result.components.length).toBeGreaterThan(0)
    expect(result.components.length).toBeLessThanOrEqual(5)
    expect(result.components.every((component: { id: string }) => typeof component.id === 'string')).toBe(true)
  })

  it('hardware_mcp recommends components for a deployment context', async () => {
    const result = await callMcpTool('hardware', 'recommend_components', {
      deploymentContext: {
        ...DEPLOYMENT_CONTEXT,
        surface: 'roadside drainage channel',
        goal: 'monitor flood water level, rain and conductivity',
        power: ['solar-assisted', 'battery-powered'],
      },
      limit: 12,
    })

    const ids = result.components.map((component: { id: string }) => component.id)
    expect(ids).toContain('water-level-ultrasonic')
    expect(ids).toContain('rain-gauge')
  })

  it('hardware_mcp exposes component lookup and family tags', async () => {
    const component = await callMcpTool('hardware', 'get_component', {
      id: 'water-level-ultrasonic',
    })
    const families = await callMcpTool('hardware', 'list_component_families', {})

    expect(component.id).toBe('water-level-ultrasonic')
    expect(families.families).toContain('sensor')
    expect(families.intent_tags).toContain('flood')
  })
})
