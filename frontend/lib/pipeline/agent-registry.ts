import type { McpToolCall, PipelineAgentId } from './types'

export type PipelineToolKey =
  | 'compliance.search_requirements'
  | 'hardware.match_assembly_pattern'
  | 'supplier.route_bom_to_gba'
  | 'scene.generate_scene_graph'

export type PipelineToolDefinition = {
  key: PipelineToolKey
  server: McpToolCall['server']
  tool: string
  title: string
}

export type PipelineAgentDefinition = {
  id: PipelineAgentId
  title: string
  description: string
  allowedTools: PipelineToolKey[]
  maxSteps: number
}

export const PIPELINE_TOOL_REGISTRY: Record<PipelineToolKey, PipelineToolDefinition> = {
  'compliance.search_requirements': {
    key: 'compliance.search_requirements',
    server: 'compliance',
    tool: 'search_requirements',
    title: 'Check jurisdiction requirements',
  },
  'hardware.match_assembly_pattern': {
    key: 'hardware.match_assembly_pattern',
    server: 'hardware',
    tool: 'match_assembly_pattern',
    title: 'Validate hardware assembly pattern',
  },
  'supplier.route_bom_to_gba': {
    key: 'supplier.route_bom_to_gba',
    server: 'supplier',
    tool: 'route_bom_to_gba',
    title: 'Route BOM to GBA suppliers',
  },
  'scene.generate_scene_graph': {
    key: 'scene.generate_scene_graph',
    server: 'scene',
    tool: 'generate_scene_graph',
    title: 'Generate scene graph',
  },
}

export const PIPELINE_AGENT_REGISTRY: Record<PipelineAgentId, PipelineAgentDefinition> = {
  orchestrator: {
    id: 'orchestrator',
    title: 'Orchestrator Agent',
    description: 'Plans the hardware compilation workflow and delegates bounded work.',
    allowedTools: [],
    maxSteps: 12,
  },
  context_agent: {
    id: 'context_agent',
    title: 'Context Agent',
    description: 'Extracts deployment context from the user prompt or uploaded files.',
    allowedTools: [],
    maxSteps: 2,
  },
  compliance_hk_agent: {
    id: 'compliance_hk_agent',
    title: 'Hong Kong Compliance Agent',
    description: 'Checks jurisdiction, privacy, radio and deployment constraints.',
    allowedTools: ['compliance.search_requirements'],
    maxSteps: 4,
  },
  component_agent: {
    id: 'component_agent',
    title: 'Component Agent',
    description: 'Selects feasible smart-city electronics from the catalog.',
    allowedTools: [],
    maxSteps: 4,
  },
  hardware_expert_agent: {
    id: 'hardware_expert_agent',
    title: 'Hardware Expert Agent',
    description: 'Validates assembly patterns and missing hardware constraints.',
    allowedTools: ['hardware.match_assembly_pattern'],
    maxSteps: 4,
  },
  bom_agent: {
    id: 'bom_agent',
    title: 'BOM Agent',
    description: 'Builds a priced bill of materials from selected catalog components.',
    allowedTools: [],
    maxSteps: 2,
  },
  dfma_agent: {
    id: 'dfma_agent',
    title: 'DfMA Agent',
    description: 'Checks deployment manufacturability and proposes fix packs.',
    allowedTools: [],
    maxSteps: 3,
  },
  supplier_gba_agent: {
    id: 'supplier_gba_agent',
    title: 'GBA Supplier Agent',
    description: 'Routes the BOM into a supplier-ready Greater Bay Area RFQ path.',
    allowedTools: ['supplier.route_bom_to_gba'],
    maxSteps: 4,
  },
  scene_3d_agent: {
    id: 'scene_3d_agent',
    title: '3D Scene Agent',
    description: 'Converts the component graph into a 3D scene graph.',
    allowedTools: ['scene.generate_scene_graph'],
    maxSteps: 3,
  },
}

export function findPipelineToolByName(toolName: string) {
  return Object.values(PIPELINE_TOOL_REGISTRY).find((definition) => definition.tool === toolName)
}
