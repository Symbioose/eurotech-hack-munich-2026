export type DeploymentContext = {
  city: string
  site: string
  surface: string
  regulation: string | null
  environment: string[]
  climate: {
    humidity: string | null
    rainfall: string | null
    wind: string | null
  }
  mounting: string[]
  power: string[]
  connectivity: string[]
  privacy: string[]
  goal: string
}

export type ComponentGraph = {
  node_type: string
  selected_component_ids: string[]
}

export type BOMRow = {
  component_id: string
  part: string
  supplier_route: string
  cost_usd: number
  scene_id: string | null
}

export type BOM = {
  rows: BOMRow[]
  total_cost_usd: number
}

export type DfmaWarning = {
  id: string
  category: 'structural' | 'thermal' | 'environmental' | 'coverage' | 'power'
  severity: 'critical' | 'warning' | 'note'
  title: string
  explanation: string
  affected_component_ids: string[]
  fix: {
    label: string
    add_component_ids: string[]
    add_scene_only_ids?: string[]
    cost_delta_usd: number
    rfq_topic_tags: string[]
  }
}

export type DfmaResult = {
  warnings: DfmaWarning[]
  passed_checks: string[]
}

export type SupplierQuestion = {
  topic: string
  question: string
  related_component_ids: string[]
}

export type GbaRouteStep = {
  step: number
  role: string
  region: string
  supplier_id: string
  stop: string
  description: string
}

export type RfqPack = {
  supplier_questions: SupplierQuestion[]
  gba_route: GbaRouteStep[]
}

export type SceneNode = {
  component_id: string
  scene_id: string
  label: string
  position: [number, number, number]
  explodeOffset: [number, number, number]
  color: string
  geometry: 'box' | 'cylinder' | 'sphere'
  scale: [number, number, number]
}

export type SceneGraph = {
  nodes: SceneNode[]
}

export type CatalogComponent = {
  id: string
  part: string
  category: string
  supplier_route: string
  cost_usd: number
  tags: string[]
  scene: {
    scene_id: string
    label: string
    position: [number, number, number]
    explodeOffset: [number, number, number]
    color: string
    geometry: 'box' | 'cylinder' | 'sphere'
    scale: [number, number, number]
  } | null
}

export type ComponentCatalog = {
  components: CatalogComponent[]
}

export type SupplierProfile = {
  id: string
  name: string
  city: string
  country: string
  scope: string
  stop: string
}

export type SupplierGraph = {
  suppliers: SupplierProfile[]
  gba_route: GbaRouteStep[]
  base_rfq_questions: SupplierQuestion[]
  topic_rfq_templates: Record<string, { question: string; related_component_ids: string[] }>
}

export type GbaRouteDisplay = GbaRouteStep & {
  suppliers: { name: string; city: string; scope: string }[]
}

export type DfmaRulesFile = {
  fix_catalog_ids: Record<
    string,
    { add_component_ids: string[]; add_scene_only_ids?: string[] }
  >
  checks: {
    id: string
    category: DfmaWarning['category']
    severity: DfmaWarning['severity']
    title: string
    requires_outdoor_surface?: boolean
    requires_humidity_exposure?: boolean
    requires_any_component_ids: string[]
    fix_key: string
    fix_label: string
    affected_component_ids: string[]
    rfq_topic_tags: string[]
  }[]
}

export type PipelineState = {
  prompt: string
  deploymentContext: DeploymentContext
  componentGraph: ComponentGraph
  bom: BOM
  dfma: DfmaResult
  rfq: RfqPack
  scene: SceneGraph
  fixApplied: boolean
  appliedWarningId: string | null
  usedDeterministic: boolean
  baselineComponentIds: string[]
  baselineBomTotal: number
  gbaRouteDisplay: GbaRouteDisplay[]
}

export type PipelineStage =
  | 'context'
  | 'components'
  | 'bom'
  | 'dfma'
  | 'rfq'
  | 'scene'
  | 'complete'
