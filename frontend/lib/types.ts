export type ViewMode = 'normal' | 'xray' | 'explode'
export type DemoStep = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

export type PipelineStageName =
  | 'context'
  | 'compliance'
  | 'components'
  | 'assembly'
  | 'bom'
  | 'dfma'
  | 'rfq'
  | 'scene'
  | 'complete'
  | null

export type ContextField = {
  label: string
  value: string
}

export type BOMRow = {
  id: string
  part: string
  supplierRoute: string
  cost: number
  isNew?: boolean
  componentId?: string
  sourceStatus?: string
  lastCheckedAt?: string
}

export type Component3D = {
  id: string
  label: string
  position: [number, number, number]
  explodeOffset: [number, number, number]
  color: string
  geometry: 'box' | 'cylinder' | 'sphere'
  scale: [number, number, number]
  assembly?: ComponentAssembly
}

export type ComponentAssembly = {
  placement: string
  parentSceneId: string | null
  anchorFace: string
  contact: string
}

export type SimulationWarning = {
  id: string
  category: 'structural' | 'thermal' | 'environmental' | 'coverage' | 'power'
  severity: 'critical' | 'warning' | 'note'
  title: string
  explanation: string
  affectedComponents: string[]
  fix: {
    label: string
    componentChanges: { id: string; note: string }[]
    bomChanges: Omit<BOMRow, 'id'>[]
    costDelta: number
    rfqQuestionsAdded: string[]
  }
}

export type MessageType =
  | 'user'
  | 'ai'
  | 'tool-call'
  | 'context-card'
  | 'warning-card'
  | 'action-button'
  | 'file-upload'

export type ToolCallStatus = 'running' | 'completed' | 'fallback' | 'error'

export type ChatToolCall = {
  id: string
  server: string
  tool: string
  title: string
  status: ToolCallStatus
  input?: string
  output?: string
  startedAt: number
  completedAt?: number
}

export type ContextGateState = {
  status: 'awaiting_user'
  originalPrompt: string
  missingFields: string[]
  questions: { id: string; question: string }[]
}

export type ConversationState =
  | 'awaiting_context'
  | 'context_ready'
  | 'running_experts'
  | 'awaiting_risk_decision'
  | 'applying_fix'
  | 'complete'

export type ChatMessage = {
  id: string
  type: MessageType
  content: string
  timestamp: number
  toolCall?: ChatToolCall
  warning?: SimulationWarning
  actionLabel?: string
  actionCallback?: string
  fileName?: string
}

export type Project = {
  id: string
  title: string
  createdAt: number
  status: 'generating' | 'complete'
}

export type GbaRouteDisplayStep = {
  step: number
  role: string
  region: string
  description: string
  suppliers: { name: string; city: string; scope: string }[]
}

export type McpToolCallUI = {
  server: 'compliance' | 'hardware' | 'supplier' | 'scene' | 'sourceResearch'
  tool: string
  status: 'ok' | 'fallback'
}

export type SourceRefreshState = {
  status: 'idle' | 'checking' | 'not_configured' | 'candidate' | 'error'
  message: string
  refreshedAt?: string
}

export type SimulationStatus = 'idle' | 'connecting' | 'running' | 'complete' | 'error'
export type SimulationScenario = 'normal' | 'stressed' | 'catastrophic'

export type SimulationStep = {
  timestep: number
  scenario?: string
  objective?: string
  moisture_ingress_prob: number
  thermal_runaway_prob: number
  seal_failure_prob: number
  bracket_failure_prob: number
  device_failure_prob: number
  active_stress_action: string
  enclosure_seal_integrity: number
  pcb_health: number
  battery_soc: number
  bracket_corrosion: number
  moisture_sensor_drift: number
  crack_sensor_drift: number
  tilt_sensor_drift: number
}

export type SimulationReport = {
  scenario: SimulationScenario
  objective: string
  usesPlanner: boolean
  fixed: boolean
  generatedAt: number
  steps: SimulationStep[]
  risksByStep: Record<string, number>[]
}

export type ComponentDamageDetail = {
  label: string
  value: string
  risk: number
}

export type SimulationState = {
  status: SimulationStatus
  scenario: SimulationScenario
  currentStep: number
  totalSteps: number
  activeStressAction: string
  deviceFailureProb: number
  risksByComponent: Record<string, number>
  detailsByComponent: Record<string, ComponentDamageDetail[]>
  error: string | null
}
