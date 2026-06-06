import type {
  BOMOffer,
  BOMRow,
  GbaRouteDisplayStep,
  SimulationWarning,
  SourceRefreshState,
} from '@/lib/types'

export type KitCategory =
  | 'sensors'
  | 'compute-connectivity'
  | 'power'
  | 'enclosure-mechanical'
  | 'other'

export type BuildPackAction = {
  label: string
  enabled: boolean
  reason?: string
}

export type BuildPackLine = {
  id: string
  part: string
  supplierRoute: string
  cost: number
  category: KitCategory
  bestOffer: BOMOffer | null
  sourceStatus: string | null
  sourceLabel: string
  needsConfirmation: boolean
  isNew: boolean
  componentId?: string
  mpn?: string | null
  manufacturer?: string | null
  lifecycle?: string
}

export type KitGroup = {
  category: KitCategory
  label: string
  items: BuildPackLine[]
}

export type ReadinessFlag = {
  kind: 'source' | 'offer' | 'dfma' | 'route'
  severity: 'info' | 'warning' | 'critical'
  title: string
  message: string
  rowId?: string
}

export type BuildPackInput = {
  projectId: string
  projectTitle: string
  bom: BOMRow[]
  bomTotal: number
  baselineBomTotal: number
  fixApplied: boolean
  activeWarning: SimulationWarning | null
  supplierRoute: GbaRouteDisplayStep[]
  rfqQuestions: string[]
  sourceRefresh: SourceRefreshState
}

export type BuildPack = {
  projectId: string
  title: string
  supplierRoute: GbaRouteDisplayStep[]
  rfqQuestions: string[]
  summary: {
    totalCost: number
    baselineTotalCost: number
    costDelta: number
    partCount: number
    buyableCount: number
    unverifiedCount: number
    missingOfferCount: number
    readinessScore: number
    sourcingStatus: 'checking' | 'not_configured' | 'candidate' | 'error' | 'unverified' | 'ready'
    sourceState: 'checking' | 'not_configured' | 'candidate' | 'error' | 'unverified' | 'ready'
    sourceLabel: string
  }
  groups: KitGroup[]
  warnings: ReadinessFlag[]
  actions: {
    buyParts: BuildPackAction
    sendRfq: BuildPackAction
    refreshSourcing: BuildPackAction
  }
}

const CATEGORY_LABELS: Record<KitCategory, string> = {
  sensors: 'Sensors',
  'compute-connectivity': 'Compute & Connectivity',
  power: 'Power',
  'enclosure-mechanical': 'Enclosure & Mechanical',
  other: 'Other',
}

const CATEGORY_ORDER: KitCategory[] = [
  'sensors',
  'compute-connectivity',
  'power',
  'enclosure-mechanical',
  'other',
]

const UNCONFIRMED_SOURCE_STATUSES = new Set(['candidate', 'error', 'not_configured'])

export function selectBestBomOffer(offers?: BOMOffer[]): BOMOffer | null {
  if (!offers?.length) return null

  return (
    offers
      .filter((offer) => offer.url.trim().length > 0)
      .sort((a, b) => a.unitPrice - b.unitPrice)[0] ?? null
  )
}

export function classifyKitCategory(row: BOMRow): KitCategory {
  const text = [row.part, row.supplierRoute, row.id, row.componentId].filter(Boolean).join(' ').toLowerCase()

  if (matchesAny(text, ['sensor', 'imu', 'accelerometer', 'gyro', 'vibration', 'tilt', 'crack', 'moisture'])) {
    return 'sensors'
  }

  if (
    matchesAny(text, [
      'pcb',
      'pcba',
      'controller',
      'mcu',
      'microcontroller',
      'compute',
      'processor',
      'radio',
      'antenna',
      'connectivity',
      'cellular',
      'lora',
      'wifi',
      'bluetooth',
      'ble',
      'modem',
      'gateway',
      'electronics',
    ])
  ) {
    return 'compute-connectivity'
  }

  if (matchesAny(text, ['battery', 'power', 'solar', 'charger', 'regulator', 'dc-dc', 'buck', 'fuel gauge'])) {
    return 'power'
  }

  if (
    matchesAny(text, [
      'enclosure',
      'housing',
      'case',
      'mechanical',
      'plastic',
      'plastics',
      'bracket',
      'mount',
      'gasket',
      'seal',
      'membrane',
      'fastener',
      'screw',
      'standoff',
    ])
  ) {
    return 'enclosure-mechanical'
  }

  return 'other'
}

export function deriveBuildPack(input: BuildPackInput): BuildPack {
  const lines = input.bom.map(toBuildPackLine)
  const partCount = lines.length
  const buyableCount = lines.filter((line) => line.bestOffer).length
  const unverifiedCount = lines.filter((line) => line.needsConfirmation).length
  const missingOfferCount = lines.filter((line) => !line.bestOffer).length
  const unresolvedCriticalDfmaWarning =
    input.activeWarning?.severity === 'critical' && !input.fixApplied ? input.activeWarning : null
  const sourceState = summarizeSourceState(input.sourceRefresh, lines)
  const warnings = buildWarnings({
    lines,
    missingOfferCount,
    unverifiedCount,
    activeWarning: input.activeWarning,
    fixApplied: input.fixApplied,
    supplierRoute: input.supplierRoute,
    sourceState,
    sourceRefresh: input.sourceRefresh,
  })

  return {
    projectId: input.projectId,
    title: input.projectTitle.trim() || 'Hardware Build Pack',
    supplierRoute: input.supplierRoute,
    rfqQuestions: input.rfqQuestions,
    summary: {
      totalCost: input.bomTotal,
      baselineTotalCost: input.baselineBomTotal,
      costDelta: input.bomTotal - input.baselineBomTotal,
      partCount,
      buyableCount,
      unverifiedCount,
      missingOfferCount,
      readinessScore: calculateReadinessScore({
        partCount,
        unverifiedCount,
        missingOfferCount,
        hasCriticalDfmaWarning: Boolean(unresolvedCriticalDfmaWarning),
        fixApplied: input.fixApplied,
        hasSupplierRoute: input.supplierRoute.length > 0,
      }),
      sourcingStatus: sourceState,
      sourceState,
      sourceLabel: sourceLabelForState(sourceState, input.sourceRefresh),
    },
    groups: groupLines(lines),
    warnings,
    actions: {
      buyParts: {
        label: 'Buy parts',
        enabled: buyableCount > 0,
        reason: buyableCount > 0 ? undefined : 'No distributor offers with product URLs are available.',
      },
      sendRfq: {
        label: 'Send RFQ',
        enabled: input.rfqQuestions.length > 0 || input.supplierRoute.length > 0,
        reason:
          input.rfqQuestions.length > 0 || input.supplierRoute.length > 0
            ? undefined
            : 'Add supplier-route context or RFQ questions first.',
      },
      refreshSourcing: {
        label: input.sourceRefresh.status === 'not_configured' ? 'Configure sourcing' : 'Refresh sourcing',
        enabled: input.sourceRefresh.status !== 'checking',
        reason: input.sourceRefresh.status === 'checking' ? 'Sourcing refresh is already running.' : undefined,
      },
    },
  }
}

function toBuildPackLine(row: BOMRow): BuildPackLine {
  const sourceStatus = row.sourceStatus ?? null

  return {
    id: row.id,
    part: row.part,
    supplierRoute: row.supplierRoute,
    cost: row.cost,
    category: classifyKitCategory(row),
    bestOffer: selectBestBomOffer(row.offers),
    sourceStatus,
    sourceLabel: sourceLabelForRow(sourceStatus),
    needsConfirmation: !sourceStatus || UNCONFIRMED_SOURCE_STATUSES.has(sourceStatus),
    isNew: Boolean(row.isNew),
    componentId: row.componentId,
    mpn: row.mpn,
    manufacturer: row.manufacturer,
    lifecycle: row.lifecycle,
  }
}

function groupLines(lines: BuildPackLine[]): KitGroup[] {
  return CATEGORY_ORDER.map((category) => ({
    category,
    label: CATEGORY_LABELS[category],
    items: lines.filter((line) => line.category === category),
  })).filter((group) => group.items.length > 0)
}

function calculateReadinessScore({
  partCount,
  unverifiedCount,
  missingOfferCount,
  hasCriticalDfmaWarning,
  fixApplied,
  hasSupplierRoute,
}: {
  partCount: number
  unverifiedCount: number
  missingOfferCount: number
  hasCriticalDfmaWarning: boolean
  fixApplied: boolean
  hasSupplierRoute: boolean
}) {
  if (partCount === 0) return 0

  let score = 82
  score -= unverifiedCount * 10
  score -= missingOfferCount * 14
  if (hasCriticalDfmaWarning) score -= 28
  if (fixApplied) score += 6
  if (hasSupplierRoute) score += 4

  return clamp(Math.round(score), 0, 99)
}

function summarizeSourceState(
  sourceRefresh: SourceRefreshState,
  lines: BuildPackLine[]
): BuildPack['summary']['sourceState'] {
  if (sourceRefresh.status === 'checking') return 'checking'
  if (sourceRefresh.status === 'not_configured') return 'not_configured'
  if (lines.some((line) => line.sourceStatus === 'error')) return 'error'
  if (sourceRefresh.status === 'error') return 'error'
  if (lines.some((line) => line.sourceStatus === 'candidate')) return 'candidate'
  if (sourceRefresh.status === 'candidate') return 'candidate'
  if (lines.some((line) => line.needsConfirmation)) return 'unverified'
  return 'ready'
}

function buildWarnings({
  lines,
  missingOfferCount,
  unverifiedCount,
  activeWarning,
  fixApplied,
  supplierRoute,
  sourceState,
  sourceRefresh,
}: {
  lines: BuildPackLine[]
  missingOfferCount: number
  unverifiedCount: number
  activeWarning: SimulationWarning | null
  fixApplied: boolean
  supplierRoute: GbaRouteDisplayStep[]
  sourceState: BuildPack['summary']['sourceState']
  sourceRefresh: SourceRefreshState
}): ReadinessFlag[] {
  const warnings: ReadinessFlag[] = []

  if (unverifiedCount > 0 || sourceRefresh.status === 'not_configured' || sourceRefresh.status === 'error') {
    warnings.push({
      kind: 'source',
      severity: sourceState === 'error' ? 'critical' : 'warning',
      title: 'Sourcing needs confirmation',
      message: sourceWarningMessage(sourceState, sourceRefresh, unverifiedCount),
    })
  }

  if (missingOfferCount > 0) {
    warnings.push({
      kind: 'offer',
      severity: 'warning',
      title: 'Distributor offers missing',
      message: `${missingOfferCount} BOM line(s) do not have a buyable distributor URL.`,
    })
  }

  if (activeWarning?.severity === 'critical' && !fixApplied) {
    warnings.push({
      kind: 'dfma',
      severity: activeWarning.severity === 'critical' ? 'critical' : 'warning',
      title: activeWarning.title,
      message: activeWarning.explanation,
    })
  }

  if (lines.length > 0 && supplierRoute.length === 0) {
    warnings.push({
      kind: 'route',
      severity: 'info',
      title: 'Supplier route missing',
      message: 'Add a supplier route before sending an RFQ package.',
    })
  }

  return warnings
}

function sourceLabelForRow(status: string | null): string {
  switch (status) {
    case 'seeded':
      return 'Seeded source'
    case 'candidate':
      return 'Candidate source'
    case 'error':
      return 'Sourcing error'
    case 'not_configured':
      return 'Sourcing not configured'
    case null:
      return 'Needs sourcing'
    default:
      return status
  }
}

function sourceLabelForState(
  state: BuildPack['summary']['sourceState'],
  sourceRefresh: SourceRefreshState
): string {
  if (canUseRefreshMessageForState(state, sourceRefresh)) return sourceRefresh.message

  switch (state) {
    case 'checking':
      return 'Checking sources'
    case 'not_configured':
      return 'Sourcing not configured'
    case 'candidate':
      return 'Candidate sources'
    case 'error':
      return 'Sourcing error'
    case 'unverified':
      return 'Sources need confirmation'
    case 'ready':
      return 'Sources ready'
  }
}

function sourceWarningMessage(
  state: BuildPack['summary']['sourceState'],
  sourceRefresh: SourceRefreshState,
  unverifiedCount: number
): string {
  if (canUseRefreshMessageForState(state, sourceRefresh)) return sourceRefresh.message

  switch (state) {
    case 'checking':
      return 'Sourcing refresh is checking distributor sources.'
    case 'not_configured':
      return 'Configure sourcing before confirming distributor availability.'
    case 'candidate':
      return `${unverifiedCount} BOM line(s) have candidate sources that need confirmation.`
    case 'error':
      return 'Sourcing error on one or more BOM lines; refresh or review sources.'
    case 'unverified':
      return `${unverifiedCount} BOM line(s) need source confirmation.`
    case 'ready':
      return 'Sources are ready.'
  }
}

function canUseRefreshMessageForState(
  state: BuildPack['summary']['sourceState'],
  sourceRefresh: SourceRefreshState
): boolean {
  return Boolean(sourceRefresh.message && sourceRefresh.status !== 'idle' && sourceRefresh.status === state)
}

function matchesAny(value: string, needles: string[]) {
  return needles.some((needle) => value.includes(needle))
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
