export type ViewMode = 'normal' | 'xray' | 'explode'
export type DemoStep = 0 | 1 | 2 | 3 | 4 | 5 | 6

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

export type Supplier = {
  id: string
  name: string
  city: string
  country: string
  scope: string
  website?: string
  stop: 'hk-integrator' | 'sz-ems' | 'dg-enclosure' | 'hk-compliance'
}
