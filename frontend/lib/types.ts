export type ViewMode = 'normal' | 'xray' | 'explode'
export type DemoStep = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

export type PipelineStageName =
  | 'context'
  | 'components'
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
}

export type Component3D = {
  id: string
  label: string
  position: [number, number, number]
  explodeOffset: [number, number, number]
  color: string
  geometry: 'box' | 'cylinder' | 'sphere'
  scale: [number, number, number]
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
  | 'context-card'
  | 'warning-card'
  | 'action-button'
  | 'file-upload'

export type ChatMessage = {
  id: string
  type: MessageType
  content: string
  timestamp: number
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
