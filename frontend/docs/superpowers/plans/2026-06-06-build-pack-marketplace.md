# Build Pack Marketplace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a dedicated Build Pack Marketplace page that turns the completed hardware pipeline output into buyable parts, RFQ handoff, source refresh, and supplier route actions without fake sourcing.

**Architecture:** Add a typed marketplace derivation layer in `lib/marketplace/build-pack.ts` and keep React components as renderers. Add a client marketplace page at `/project/[id]/marketplace`, link to it from the existing header after the BOM is available, and reuse existing `/api/go`, `/api/research/refresh`, and export helpers. Preserve the current workspace flow and source truth policy.

**Tech Stack:** Next.js 16 App Router, React 19, Zustand, TypeScript, Tailwind CSS, Vitest, React Testing Library, jsPDF exports already in `lib/export.ts`.

---

## File Structure

- Create `lib/marketplace/build-pack.ts`: pure typed helper for grouping BOM rows, selecting offers, scoring procurement readiness, and deriving action enablement.
- Create `__tests__/marketplace-build-pack.test.ts`: unit tests for the helper.
- Create `components/marketplace/SourceBadge.tsx`: shared sourcing badge for marketplace rows.
- Create `components/marketplace/BuildPackHeader.tsx`: compact summary and readiness header.
- Create `components/marketplace/ProcurementActions.tsx`: Buy Parts, Send RFQ Pack, Refresh Sourcing controls.
- Create `components/marketplace/KitContents.tsx`: grouped BOM table.
- Create `components/marketplace/SupplierRoutePanel.tsx`: supplier route timeline.
- Create `components/marketplace/RfqPackPanel.tsx`: RFQ questions panel.
- Create `components/marketplace/MarketplacePage.tsx`: client container wiring Zustand state, refresh API, exports, and derived Build Pack data.
- Create `app/project/[id]/marketplace/page.tsx`: Next route wrapper.
- Create `app/project/[id]/marketplace/loading.tsx`: immediate loading UI for the dynamic route.
- Modify `components/ui/Header.tsx`: add `projectId` prop and `Order Build Pack` link gated by completed BOM state.
- Modify `app/project/[id]/workspace/page.tsx`: pass `projectId` to `Header`.
- Modify `README.md`: document the marketplace route, sourcing truth policy, `/api/go`, `/api/research/refresh`, and verification commands.
- Create `__tests__/marketplace-page.test.tsx`: render tests for empty and populated marketplace states.
- Create `__tests__/header-build-pack-link.test.tsx`: verify the header CTA gating.

Before editing route files, read the local Next.js docs:

```bash
sed -n '1,220p' node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md
sed -n '1,220p' node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md
sed -n '1,220p' node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md
```

Expected: docs confirm file-based routes, dynamic `params` as a promise, `Link` for client transitions, and `'use client'` boundaries for components using hooks/browser state.

---

## Task 1: Build Pack Derivation Helper

**Files:**
- Create: `lib/marketplace/build-pack.ts`
- Test: `__tests__/marketplace-build-pack.test.ts`

- [ ] **Step 1: Write the failing helper tests**

Create `__tests__/marketplace-build-pack.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { deriveBuildPack } from '../lib/marketplace/build-pack'
import type { BOMRow, GbaRouteDisplayStep, SimulationWarning } from '../lib/types'

const route: GbaRouteDisplayStep[] = [
  {
    step: 1,
    role: 'PCB & electronics',
    region: 'Regional',
    description: 'PCB, sensors and controller',
    suppliers: [{ name: 'PCB Partner', city: 'Regional', scope: 'SMT assembly' }],
  },
]

function row(patch: Partial<BOMRow> & Pick<BOMRow, 'id' | 'part' | 'cost'>): BOMRow {
  return {
    supplierRoute: 'Shenzhen electronics',
    componentId: patch.id,
    sourceStatus: 'seeded',
    offers: [],
    ...patch,
  }
}

describe('deriveBuildPack', () => {
  it('groups BOM rows, selects the cheapest buyable offer, and summarizes readiness', () => {
    const bom: BOMRow[] = [
      row({
        id: 'imu',
        part: 'Vibration / IMU sensor',
        cost: 18,
        mpn: 'BMI270',
        manufacturer: 'Bosch Sensortec',
        offers: [
          {
            distributor: 'Digi-Key',
            region: 'US / Global',
            unitPrice: 20.16,
            moq: 1,
            stock: null,
            url: 'https://www.digikey.com/en/products/result?keywords=BMI270',
            verified: false,
          },
          {
            distributor: 'LCSC',
            region: 'CN / Greater Bay Area',
            unitPrice: 15.3,
            moq: 5,
            stock: null,
            url: 'https://www.lcsc.com/search?q=BMI270',
            verified: false,
          },
        ],
      }),
      row({
        id: 'enclosure',
        part: 'Weatherproof enclosure',
        supplierRoute: 'Dongguan enclosure/plastics',
        cost: 28,
        sourceStatus: 'candidate',
      }),
    ]

    const pack = deriveBuildPack({
      projectId: 'demo',
      projectTitle: 'Facade sensor node',
      bom,
      bomTotal: 46,
      baselineBomTotal: 42,
      fixApplied: true,
      activeWarning: null,
      supplierRoute: route,
      rfqQuestions: ['What IP rating can you certify?'],
      sourceRefresh: { status: 'idle', message: 'Seeded sources' },
    })

    expect(pack.title).toBe('Facade sensor node')
    expect(pack.summary.totalCost).toBe(46)
    expect(pack.summary.partCount).toBe(2)
    expect(pack.summary.buyableCount).toBe(1)
    expect(pack.summary.unverifiedCount).toBe(1)
    expect(pack.summary.readinessScore).toBeGreaterThanOrEqual(65)
    expect(pack.summary.readinessScore).toBeLessThan(100)
    expect(pack.groups.map((group) => group.label)).toEqual(['Sensors', 'Enclosure & Mechanical'])
    expect(pack.groups[0].items[0].bestOffer?.distributor).toBe('LCSC')
    expect(pack.actions.buyParts.enabled).toBe(true)
    expect(pack.actions.sendRfq.enabled).toBe(true)
    expect(pack.actions.refreshSourcing.enabled).toBe(true)
    expect(pack.warnings.some((warning) => warning.kind === 'source')).toBe(true)
  })

  it('penalizes missing offers and active critical warnings without inventing sourcing', () => {
    const activeWarning: SimulationWarning = {
      id: 'ip-risk',
      category: 'environmental',
      severity: 'critical',
      title: 'Insufficient ingress protection',
      explanation: 'The enclosure needs a seal fix.',
      affectedComponents: ['enclosure'],
      fix: {
        label: 'Add gasket and membrane',
        componentChanges: [],
        bomChanges: [],
        costDelta: 11,
        rfqQuestionsAdded: [],
      },
    }

    const pack = deriveBuildPack({
      projectId: 'demo',
      projectTitle: '',
      bom: [row({ id: 'battery', part: 'Battery module', cost: 24, sourceStatus: 'error' })],
      bomTotal: 24,
      baselineBomTotal: 24,
      fixApplied: false,
      activeWarning,
      supplierRoute: [],
      rfqQuestions: [],
      sourceRefresh: { status: 'not_configured', message: 'Tavily key not configured' },
    })

    expect(pack.title).toBe('Hardware Build Pack')
    expect(pack.summary.buyableCount).toBe(0)
    expect(pack.summary.unverifiedCount).toBe(1)
    expect(pack.summary.readinessScore).toBeLessThan(55)
    expect(pack.actions.buyParts.enabled).toBe(false)
    expect(pack.actions.sendRfq.enabled).toBe(false)
    expect(pack.actions.refreshSourcing.label).toBe('Configure sourcing')
    expect(pack.warnings.map((warning) => warning.kind)).toContain('dfma')
    expect(pack.warnings.map((warning) => warning.kind)).toContain('offer')
  })
})
```

- [ ] **Step 2: Run the tests and verify they fail**

Run:

```bash
npm run test -- __tests__/marketplace-build-pack.test.ts
```

Expected: FAIL because `../lib/marketplace/build-pack` does not exist.

- [ ] **Step 3: Implement the helper**

Create `lib/marketplace/build-pack.ts`:

```ts
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
  detail: string
}

export type BuildPackLine = BOMRow & {
  category: KitCategory
  bestOffer: BOMOffer | null
  sourceLabel: string
  needsConfirmation: boolean
}

export type KitGroup = {
  key: KitCategory
  label: string
  items: BuildPackLine[]
}

export type ReadinessFlag = {
  kind: 'source' | 'offer' | 'dfma' | 'route'
  severity: 'info' | 'warning' | 'critical'
  message: string
}

export type BuildPack = {
  projectId: string
  title: string
  summary: {
    totalCost: number
    baselineTotal: number
    partCount: number
    buyableCount: number
    unverifiedCount: number
    readinessScore: number
    sourcingStatus: string
  }
  actions: {
    buyParts: BuildPackAction
    sendRfq: BuildPackAction
    refreshSourcing: BuildPackAction
  }
  groups: KitGroup[]
  supplierRoute: GbaRouteDisplayStep[]
  rfqQuestions: string[]
  warnings: ReadinessFlag[]
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

const UNVERIFIED_STATUSES = new Set(['candidate', 'error', 'not_configured'])

export function selectBestBomOffer(offers?: BOMOffer[]): BOMOffer | null {
  if (!offers?.length) return null
  return [...offers]
    .filter((offer) => offer.url)
    .sort((a, b) => a.unitPrice - b.unitPrice)[0] ?? null
}

export function classifyKitCategory(row: BOMRow): KitCategory {
  const text = `${row.part} ${row.supplierRoute} ${row.componentId ?? row.id}`.toLowerCase()
  if (/(sensor|imu|tilt|moisture|humidity|crack|camera|presence|motion|temperature|air quality)/.test(text)) {
    return 'sensors'
  }
  if (/(compute|mcu|microcontroller|edge|radio|lora|nb-iot|connectivity|usb|board)/.test(text)) {
    return 'compute-connectivity'
  }
  if (/(battery|power|poe|solar|cell)/.test(text)) {
    return 'power'
  }
  if (/(enclosure|mechanical|mount|bracket|gasket|membrane|fastener|drainage|metal|plastic)/.test(text)) {
    return 'enclosure-mechanical'
  }
  return 'other'
}

function sourceLabel(status?: string): string {
  if (status === 'verified') return 'verified'
  if (status === 'seeded') return 'sourced'
  if (status === 'candidate') return 'estimate'
  if (status === 'not_configured') return 'unsourced'
  if (status === 'error') return 'estimate'
  return 'unknown'
}

function sourceSummary(input: BuildPackInput, unverifiedCount: number): string {
  if (input.sourceRefresh.status === 'checking') return 'Refreshing source candidates'
  if (input.sourceRefresh.status === 'not_configured') return 'Seeded sources, live refresh not configured'
  if (input.sourceRefresh.status === 'candidate') return 'Candidate source updates found'
  if (input.sourceRefresh.status === 'error') return 'Source refresh failed, using existing sources'
  if (unverifiedCount > 0) return `${unverifiedCount} line${unverifiedCount > 1 ? 's' : ''} need confirmation`
  return 'Seeded sources ready for procurement review'
}

function readinessScore(args: {
  partCount: number
  unverifiedCount: number
  missingOfferCount: number
  hasCriticalWarning: boolean
  fixApplied: boolean
  hasSupplierRoute: boolean
}) {
  if (args.partCount === 0) return 0
  let score = 82
  score -= args.unverifiedCount * 8
  score -= args.missingOfferCount * 6
  if (args.hasCriticalWarning) score -= 22
  if (args.fixApplied) score += 7
  if (args.hasSupplierRoute) score += 6
  return Math.max(0, Math.min(99, score))
}

function buildWarnings(input: BuildPackInput, lines: BuildPackLine[]): ReadinessFlag[] {
  const warnings: ReadinessFlag[] = []
  const unverified = lines.filter((line) => line.needsConfirmation).length
  const missingOffers = lines.filter((line) => !line.bestOffer).length
  if (unverified > 0) {
    warnings.push({
      kind: 'source',
      severity: 'warning',
      message: `${unverified} BOM line${unverified > 1 ? 's' : ''} require source confirmation before purchase.`,
    })
  }
  if (missingOffers > 0) {
    warnings.push({
      kind: 'offer',
      severity: 'warning',
      message: `${missingOffers} BOM line${missingOffers > 1 ? 's do' : ' does'} not have a buy link yet.`,
    })
  }
  if (input.activeWarning?.severity === 'critical' && !input.fixApplied) {
    warnings.push({
      kind: 'dfma',
      severity: 'critical',
      message: `Critical manufacturing risk still open: ${input.activeWarning.title}.`,
    })
  }
  if (input.supplierRoute.length === 0) {
    warnings.push({
      kind: 'route',
      severity: 'info',
      message: 'Supplier route is not available yet; use BOM export while route generation completes.',
    })
  }
  return warnings
}

function groupLines(lines: BuildPackLine[]): KitGroup[] {
  return CATEGORY_ORDER.map((category) => ({
    key: category,
    label: CATEGORY_LABELS[category],
    items: lines.filter((line) => line.category === category),
  })).filter((group) => group.items.length > 0)
}

export function deriveBuildPack(input: BuildPackInput): BuildPack {
  const lines: BuildPackLine[] = input.bom.map((row) => {
    const status = row.sourceStatus
    return {
      ...row,
      category: classifyKitCategory(row),
      bestOffer: selectBestBomOffer(row.offers),
      sourceLabel: sourceLabel(status),
      needsConfirmation: !status || UNVERIFIED_STATUSES.has(status),
    }
  })
  const buyableCount = lines.filter((line) => line.bestOffer).length
  const unverifiedCount = lines.filter((line) => line.needsConfirmation).length
  const missingOfferCount = lines.length - buyableCount
  const hasCriticalWarning = input.activeWarning?.severity === 'critical' && !input.fixApplied
  const hasSupplierRoute = input.supplierRoute.length > 0

  return {
    projectId: input.projectId,
    title: input.projectTitle.trim() || 'Hardware Build Pack',
    summary: {
      totalCost: input.bomTotal,
      baselineTotal: input.baselineBomTotal,
      partCount: lines.length,
      buyableCount,
      unverifiedCount,
      readinessScore: readinessScore({
        partCount: lines.length,
        unverifiedCount,
        missingOfferCount,
        hasCriticalWarning,
        fixApplied: input.fixApplied,
        hasSupplierRoute,
      }),
      sourcingStatus: sourceSummary(input, unverifiedCount),
    },
    actions: {
      buyParts: {
        label: 'Buy Parts',
        enabled: buyableCount > 0,
        detail:
          buyableCount > 0
            ? `${buyableCount} distributor link${buyableCount > 1 ? 's' : ''} ready`
            : 'No distributor links available',
      },
      sendRfq: {
        label: 'Send RFQ Pack',
        enabled: input.rfqQuestions.length > 0 || hasSupplierRoute,
        detail:
          input.rfqQuestions.length > 0
            ? `${input.rfqQuestions.length} supplier question${input.rfqQuestions.length > 1 ? 's' : ''} ready`
            : hasSupplierRoute
              ? 'Supplier route ready'
              : 'RFQ data unavailable',
      },
      refreshSourcing: {
        label: input.sourceRefresh.status === 'not_configured' ? 'Configure sourcing' : 'Refresh Sourcing',
        enabled: input.sourceRefresh.status !== 'checking',
        detail: input.sourceRefresh.message,
      },
    },
    groups: groupLines(lines),
    supplierRoute: input.supplierRoute,
    rfqQuestions: input.rfqQuestions,
    warnings: buildWarnings(input, lines),
  }
}
```

- [ ] **Step 4: Run the helper tests and verify they pass**

Run:

```bash
npm run test -- __tests__/marketplace-build-pack.test.ts
```

Expected: PASS for both `deriveBuildPack` tests.

- [ ] **Step 5: Commit the helper**

Run:

```bash
git add lib/marketplace/build-pack.ts __tests__/marketplace-build-pack.test.ts
git commit -m "feat: derive build pack marketplace data"
```

Expected: commit succeeds.

---

## Task 2: Marketplace Render Components

**Files:**
- Create: `components/marketplace/SourceBadge.tsx`
- Create: `components/marketplace/BuildPackHeader.tsx`
- Create: `components/marketplace/ProcurementActions.tsx`
- Create: `components/marketplace/KitContents.tsx`
- Create: `components/marketplace/SupplierRoutePanel.tsx`
- Create: `components/marketplace/RfqPackPanel.tsx`

- [ ] **Step 1: Create the source badge component**

Create `components/marketplace/SourceBadge.tsx`:

```tsx
import type { BOMRow } from '@/lib/types'

const BADGES: Record<string, { label: string; className: string; title: string }> = {
  verified: {
    label: 'verified',
    className: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
    title: 'Verified against a live or manually reviewed source',
  },
  seeded: {
    label: 'sourced',
    className: 'border-sky-400/25 bg-sky-400/10 text-sky-300',
    title: 'Curated catalog or registry source; price remains an estimate',
  },
  candidate: {
    label: 'estimate',
    className: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
    title: 'Candidate or estimated source requiring confirmation',
  },
  not_configured: {
    label: 'unsourced',
    className: 'border-white/15 bg-white/5 text-white/45',
    title: 'Live source refresh is not configured',
  },
  error: {
    label: 'estimate',
    className: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
    title: 'Source lookup failed; confirm before purchase',
  },
}

export function SourceBadge({ status }: { status: BOMRow['sourceStatus'] }) {
  const badge = status ? BADGES[status] : null
  if (!badge) {
    return (
      <span
        title="Source status unknown"
        className="inline-flex items-center rounded-sm border border-white/15 bg-white/5 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-white/40"
      >
        unknown
      </span>
    )
  }

  return (
    <span
      title={badge.title}
      className={`inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[9px] uppercase tracking-wide ${badge.className}`}
    >
      {badge.label}
    </span>
  )
}
```

- [ ] **Step 2: Create the summary header**

Create `components/marketplace/BuildPackHeader.tsx`:

```tsx
import type { BuildPack } from '@/lib/marketplace/build-pack'

function scoreClass(score: number) {
  if (score >= 80) return 'text-emerald-300 border-emerald-400/25 bg-emerald-400/10'
  if (score >= 60) return 'text-sky-300 border-sky-400/25 bg-sky-400/10'
  return 'text-amber-300 border-amber-400/30 bg-amber-400/10'
}

export function BuildPackHeader({ pack }: { pack: BuildPack }) {
  const delta = pack.summary.totalCost - pack.summary.baselineTotal

  return (
    <section className="border-b border-white/[0.08] px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-white/35">Build Pack Marketplace</p>
          <h1 className="mt-1 truncate text-xl font-semibold tracking-tight text-white/90">{pack.title}</h1>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-white/45">
            Procurement-ready kit derived from the validated hardware pipeline. Source confidence is shown on every part.
          </p>
        </div>
        <div className={`rounded-md border px-3 py-2 text-right ${scoreClass(pack.summary.readinessScore)}`}>
          <p className="text-[10px] uppercase tracking-wide opacity-75">Procurement readiness</p>
          <p className="text-2xl font-semibold tabular-nums">{pack.summary.readinessScore}</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-5">
        <div className="border border-white/[0.08] bg-white/[0.03] p-3">
          <p className="text-[10px] uppercase tracking-wide text-white/30">BOM total</p>
          <p className="mt-1 text-lg font-medium text-white tabular-nums">
            ${pack.summary.totalCost}
            {delta > 0 && <span className="ml-1 text-xs text-emerald-300">+{delta}</span>}
          </p>
        </div>
        <div className="border border-white/[0.08] bg-white/[0.03] p-3">
          <p className="text-[10px] uppercase tracking-wide text-white/30">Parts</p>
          <p className="mt-1 text-lg font-medium text-white tabular-nums">{pack.summary.partCount}</p>
        </div>
        <div className="border border-white/[0.08] bg-white/[0.03] p-3">
          <p className="text-[10px] uppercase tracking-wide text-white/30">Buyable</p>
          <p className="mt-1 text-lg font-medium text-white tabular-nums">{pack.summary.buyableCount}</p>
        </div>
        <div className="border border-white/[0.08] bg-white/[0.03] p-3">
          <p className="text-[10px] uppercase tracking-wide text-white/30">To confirm</p>
          <p className="mt-1 text-lg font-medium text-white tabular-nums">{pack.summary.unverifiedCount}</p>
        </div>
        <div className="border border-white/[0.08] bg-white/[0.03] p-3">
          <p className="text-[10px] uppercase tracking-wide text-white/30">Sources</p>
          <p className="mt-1 truncate text-xs text-white/65">{pack.summary.sourcingStatus}</p>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Create procurement action controls**

Create `components/marketplace/ProcurementActions.tsx`:

```tsx
import type { BuildPack } from '@/lib/marketplace/build-pack'

type Props = {
  pack: BuildPack
  refreshing: boolean
  onBuyParts: () => void
  onExportRfq: () => void
  onRefreshSources: () => void
}

function ActionButton({
  label,
  detail,
  disabled,
  onClick,
}: {
  label: string
  detail: string
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="min-h-20 border border-white/[0.08] bg-white/[0.035] px-4 py-3 text-left transition-colors hover:border-blue-400/30 hover:bg-blue-400/10 disabled:cursor-not-allowed disabled:opacity-45"
    >
      <span className="block text-sm font-medium text-white/85">{label}</span>
      <span className="mt-1 block text-xs leading-relaxed text-white/42">{detail}</span>
    </button>
  )
}

export function ProcurementActions({
  pack,
  refreshing,
  onBuyParts,
  onExportRfq,
  onRefreshSources,
}: Props) {
  return (
    <section className="space-y-3">
      <div>
        <p className="text-[10px] uppercase tracking-widest text-white/30">Procurement actions</p>
        <p className="mt-1 text-xs text-white/45">
          Buy distributor parts, export the supplier pack, or refresh candidate sourcing without changing source truth.
        </p>
      </div>
      <div className="grid gap-2 md:grid-cols-3">
        <ActionButton
          label={pack.actions.buyParts.label}
          detail={pack.actions.buyParts.detail}
          disabled={!pack.actions.buyParts.enabled}
          onClick={onBuyParts}
        />
        <ActionButton
          label={pack.actions.sendRfq.label}
          detail={pack.actions.sendRfq.detail}
          disabled={!pack.actions.sendRfq.enabled}
          onClick={onExportRfq}
        />
        <ActionButton
          label={refreshing ? 'Refreshing Sourcing' : pack.actions.refreshSourcing.label}
          detail={pack.actions.refreshSourcing.detail}
          disabled={!pack.actions.refreshSourcing.enabled || refreshing}
          onClick={onRefreshSources}
        />
      </div>
      {pack.warnings.length > 0 && (
        <div className="space-y-1">
          {pack.warnings.map((warning) => (
            <p
              key={`${warning.kind}-${warning.message}`}
              className={
                warning.severity === 'critical'
                  ? 'text-xs text-red-300/80'
                  : warning.severity === 'warning'
                    ? 'text-xs text-amber-300/80'
                    : 'text-xs text-white/35'
              }
            >
              {warning.message}
            </p>
          ))}
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 4: Create kit contents**

Create `components/marketplace/KitContents.tsx`:

```tsx
import type { BuildPack } from '@/lib/marketplace/build-pack'
import { SourceBadge } from './SourceBadge'

function buyHref(url: string, componentId: string, distributor: string) {
  const params = new URLSearchParams({ u: url, c: componentId, d: distributor })
  return `/api/go?${params.toString()}`
}

export function KitContents({ pack }: { pack: BuildPack }) {
  return (
    <section className="space-y-3">
      <div>
        <p className="text-[10px] uppercase tracking-widest text-white/30">Kit contents</p>
        <p className="mt-1 text-xs text-white/45">Grouped BOM with MPNs, source confidence and best current buy links.</p>
      </div>
      <div className="space-y-4">
        {pack.groups.map((group) => (
          <div key={group.key} className="border border-white/[0.08] bg-white/[0.025]">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2">
              <h2 className="text-sm font-medium text-white/80">{group.label}</h2>
              <span className="text-[10px] text-white/30">{group.items.length} part{group.items.length > 1 ? 's' : ''}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-xs">
                <thead className="text-white/30">
                  <tr className="border-b border-white/[0.06]">
                    <th className="px-3 py-2 text-left font-normal">Part</th>
                    <th className="px-3 py-2 text-left font-normal">MPN</th>
                    <th className="px-3 py-2 text-left font-normal">Source</th>
                    <th className="px-3 py-2 text-left font-normal">Best distributor</th>
                    <th className="px-3 py-2 text-right font-normal">Unit</th>
                    <th className="px-3 py-2 text-right font-normal">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {group.items.map((item) => (
                    <tr key={item.id} className="border-b border-white/[0.04] last:border-b-0">
                      <td className="px-3 py-2 text-white/75">
                        <span className="block font-medium">{item.part}</span>
                        <span className="block text-[10px] text-white/30">{item.manufacturer || item.supplierRoute}</span>
                      </td>
                      <td className="px-3 py-2 text-white/50">{item.mpn || 'Search by part'}</td>
                      <td className="px-3 py-2"><SourceBadge status={item.sourceStatus} /></td>
                      <td className="px-3 py-2 text-white/55">
                        {item.bestOffer ? `${item.bestOffer.distributor} · ${item.bestOffer.region}` : 'RFQ required'}
                      </td>
                      <td className="px-3 py-2 text-right text-white/75 tabular-nums">
                        ${item.bestOffer?.unitPrice ?? item.cost}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {item.bestOffer ? (
                          <a
                            href={buyHref(item.bestOffer.url, item.id, item.bestOffer.distributor)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-300 underline-offset-2 hover:underline"
                          >
                            Buy
                          </a>
                        ) : (
                          <span className="text-white/25">RFQ</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 5: Create supplier route panel**

Create `components/marketplace/SupplierRoutePanel.tsx`:

```tsx
import type { BuildPack } from '@/lib/marketplace/build-pack'

export function SupplierRoutePanel({ pack }: { pack: BuildPack }) {
  return (
    <section className="space-y-3">
      <div>
        <p className="text-[10px] uppercase tracking-widest text-white/30">Supplier route</p>
        <p className="mt-1 text-xs text-white/45">Manufacturing handoff from integrator to EMS, enclosure, compliance and logistics.</p>
      </div>
      {pack.supplierRoute.length === 0 ? (
        <div className="border border-white/[0.08] bg-white/[0.025] p-4 text-xs text-white/35">
          Supplier route is not available yet. Export the BOM and RFQ questions while route generation completes.
        </div>
      ) : (
        <div className="space-y-3">
          {pack.supplierRoute.map((stop, index) => (
            <div key={`${stop.step}-${stop.role}`} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="flex h-6 w-6 items-center justify-center rounded-full border border-blue-400/35 bg-blue-400/10 text-xs text-blue-300">
                  {stop.step}
                </div>
                {index < pack.supplierRoute.length - 1 && <div className="my-1 w-px flex-1 bg-white/[0.08]" />}
              </div>
              <div className="flex-1 border border-white/[0.08] bg-white/[0.025] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-medium text-white/80">{stop.role}</h2>
                  <span className="text-[10px] uppercase tracking-wide text-white/30">{stop.region}</span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-white/45">{stop.description}</p>
                {stop.suppliers.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {stop.suppliers.map((supplier) => (
                      <span
                        key={`${stop.step}-${supplier.name}`}
                        title={supplier.scope}
                        className="border border-white/[0.08] bg-white/[0.04] px-2 py-1 text-[10px] text-white/45"
                      >
                        {supplier.name} · {supplier.city}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 6: Create RFQ panel**

Create `components/marketplace/RfqPackPanel.tsx`:

```tsx
import type { BuildPack } from '@/lib/marketplace/build-pack'

export function RfqPackPanel({ pack }: { pack: BuildPack }) {
  return (
    <section className="space-y-3">
      <div>
        <p className="text-[10px] uppercase tracking-widest text-white/30">RFQ pack</p>
        <p className="mt-1 text-xs text-white/45">Supplier questions generated from the BOM and manufacturability checks.</p>
      </div>
      {pack.rfqQuestions.length === 0 ? (
        <div className="border border-white/[0.08] bg-white/[0.025] p-4 text-xs text-white/35">
          No RFQ questions generated yet.
        </div>
      ) : (
        <ol className="space-y-2">
          {pack.rfqQuestions.map((question, index) => (
            <li key={`${index}-${question}`} className="border border-white/[0.08] bg-white/[0.025] p-3">
              <span className="text-[10px] uppercase tracking-wide text-white/25">Question {index + 1}</span>
              <p className="mt-1 text-xs leading-relaxed text-white/70">{question}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
```

- [ ] **Step 7: Commit render components**

Run:

```bash
git add components/marketplace
git commit -m "feat: add build pack marketplace components"
```

Expected: commit succeeds.

---

## Task 3: Marketplace Page Container And Route

**Files:**
- Create: `components/marketplace/MarketplacePage.tsx`
- Create: `app/project/[id]/marketplace/page.tsx`
- Create: `app/project/[id]/marketplace/loading.tsx`
- Test: `__tests__/marketplace-page.test.tsx`

- [ ] **Step 1: Write page render tests**

Create `__tests__/marketplace-page.test.tsx`:

```tsx
import { act } from 'react'
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MarketplacePage } from '../components/marketplace/MarketplacePage'
import { useProjectStore } from '../lib/store'

vi.mock('../lib/export', () => ({
  exportReadinessPack: vi.fn(),
  exportBomCsv: vi.fn(),
  exportDesignJson: vi.fn(),
}))

describe('MarketplacePage', () => {
  beforeEach(() => {
    act(() => {
      useProjectStore.getState().reset()
    })
  })

  it('renders an empty state when no build pack exists', () => {
    const html = renderToString(<MarketplacePage projectId="project-empty" />)

    expect(html).toContain('No Build Pack generated yet')
    expect(html).toContain('/project/project-empty/workspace')
  })

  it('renders a populated Build Pack from the store', () => {
    act(() => {
      const store = useProjectStore.getState()
      store.setProjectTitle('Facade sensor node')
      store.setBOM([
        {
          id: 'vibration-sensor',
          part: 'Vibration / IMU sensor',
          supplierRoute: 'Shenzhen distributor',
          cost: 18,
          componentId: 'vibration-sensor',
          sourceStatus: 'seeded',
          mpn: 'BMI270',
          manufacturer: 'Bosch Sensortec',
          lifecycle: 'active',
          offers: [
            {
              distributor: 'LCSC',
              region: 'CN / Greater Bay Area',
              unitPrice: 15.3,
              moq: 5,
              stock: null,
              url: 'https://www.lcsc.com/search?q=BMI270',
              verified: false,
            },
          ],
        },
      ])
      store.setBomTotal(18)
      store.setBaselineBomTotal(18)
      store.setRfqQuestions(['Does the sensor have environmental test data?'])
      store.setGbaRoute([
        {
          step: 1,
          role: 'PCB & electronics',
          region: 'Regional',
          description: 'PCB and SMT assembly',
          suppliers: [{ name: 'PCB Partner', city: 'Regional', scope: 'SMT' }],
        },
      ])
    })

    const html = renderToString(<MarketplacePage projectId="project-1" />)

    expect(html).toContain('Build Pack Marketplace')
    expect(html).toContain('Facade sensor node')
    expect(html).toContain('Vibration / IMU sensor')
    expect(html).toContain('Buy Parts')
    expect(html).toContain('RFQ pack')
    expect(html).toContain('PCB &amp; electronics')
  })
})
```

- [ ] **Step 2: Run the page tests and verify they fail**

Run:

```bash
npm run test -- __tests__/marketplace-page.test.tsx
```

Expected: FAIL because `components/marketplace/MarketplacePage` does not exist.

- [ ] **Step 3: Implement the client page container**

Create `components/marketplace/MarketplacePage.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useProjectStore } from '@/lib/store'
import { deriveBuildPack } from '@/lib/marketplace/build-pack'
import { exportBomCsv, exportDesignJson, exportReadinessPack, type ReadinessData } from '@/lib/export'
import { BuildPackHeader } from './BuildPackHeader'
import { ProcurementActions } from './ProcurementActions'
import { KitContents } from './KitContents'
import { SupplierRoutePanel } from './SupplierRoutePanel'
import { RfqPackPanel } from './RfqPackPanel'
import type { McpToolCallUI, SourceRefreshState } from '@/lib/types'

type RefreshResponse = {
  refreshed_at: string
  results: {
    compliance: { status: string; provider: string }
    hardware: { status: string; provider: string }
  }
  mcpToolCalls: McpToolCallUI[]
}

function statusFromRefresh(body: RefreshResponse): SourceRefreshState {
  const statuses = [body.results.compliance.status, body.results.hardware.status]
  if (statuses.includes('ok')) {
    return { status: 'candidate', message: 'Candidate updates found', refreshedAt: body.refreshed_at }
  }
  if (statuses.every((status) => status === 'not_configured')) {
    return { status: 'not_configured', message: 'Tavily key not configured', refreshedAt: body.refreshed_at }
  }
  return { status: 'error', message: 'Refresh returned partial results', refreshedAt: body.refreshed_at }
}

function readinessData(): ReadinessData {
  const state = useProjectStore.getState()
  return {
    projectTitle: state.projectTitle || 'Hardware product',
    contextFields: state.contextFields,
    bom: state.bom,
    bomTotal: state.bomTotal,
    baselineBomTotal: state.baselineBomTotal,
    fixApplied: state.fixApplied,
    warning: state.activeWarning
      ? {
          title: state.activeWarning.title,
          explanation: state.activeWarning.explanation,
          fixLabel: state.activeWarning.fix.label,
          costDelta: state.activeWarning.fix.costDelta,
        }
      : null,
    gbaRoute: state.gbaRoute,
    rfqQuestions: state.rfqQuestions,
  }
}

export function MarketplacePage({ projectId }: { projectId: string }) {
  const projectTitle = useProjectStore((state) => state.projectTitle)
  const bom = useProjectStore((state) => state.bom)
  const bomTotal = useProjectStore((state) => state.bomTotal)
  const baselineBomTotal = useProjectStore((state) => state.baselineBomTotal)
  const fixApplied = useProjectStore((state) => state.fixApplied)
  const activeWarning = useProjectStore((state) => state.activeWarning)
  const supplierRoute = useProjectStore((state) => state.gbaRoute)
  const rfqQuestions = useProjectStore((state) => state.rfqQuestions)
  const sourceRefresh = useProjectStore((state) => state.sourceRefresh)
  const pipelineState = useProjectStore((state) => state.pipelineState)
  const setSourceRefresh = useProjectStore((state) => state.setSourceRefresh)
  const setMcpToolCalls = useProjectStore((state) => state.setMcpToolCalls)
  const [refreshing, setRefreshing] = useState(false)

  if (bom.length === 0) {
    return (
      <main className="flex h-screen flex-col bg-[#0a0a0a] text-white">
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="max-w-md border border-white/[0.08] bg-white/[0.035] p-6 text-center">
            <p className="text-[10px] uppercase tracking-widest text-white/30">Build Pack Marketplace</p>
            <h1 className="mt-2 text-xl font-semibold text-white/90">No Build Pack generated yet</h1>
            <p className="mt-2 text-sm leading-relaxed text-white/45">
              Generate a hardware design first, then return here to buy parts, export RFQ material and review the supplier route.
            </p>
            <Link
              href={`/project/${projectId}/workspace`}
              className="mt-4 inline-flex border border-blue-400/25 bg-blue-400/10 px-3 py-2 text-sm text-blue-300 hover:bg-blue-400/15"
            >
              Back to workspace
            </Link>
          </div>
        </div>
      </main>
    )
  }

  const pack = deriveBuildPack({
    projectId,
    projectTitle,
    bom,
    bomTotal,
    baselineBomTotal,
    fixApplied,
    activeWarning,
    supplierRoute,
    rfqQuestions,
    sourceRefresh,
  })

  function handleBuyParts() {
    const urls = pack.groups
      .flatMap((group) => group.items)
      .map((line) => line.bestOffer && { url: line.bestOffer.url, componentId: line.id, distributor: line.bestOffer.distributor })
      .filter((item): item is { url: string; componentId: string; distributor: string } => Boolean(item))

    for (const item of urls.slice(0, 6)) {
      const params = new URLSearchParams({ u: item.url, c: item.componentId, d: item.distributor })
      window.open(`/api/go?${params.toString()}`, '_blank', 'noopener,noreferrer')
    }
  }

  function handleExportRfq() {
    exportReadinessPack(readinessData())
    exportBomCsv(bom, projectTitle || 'product')
    if (pipelineState) exportDesignJson(pipelineState, projectTitle || 'product')
  }

  async function handleRefreshSources() {
    if (!pipelineState || refreshing) {
      if (!pipelineState) setSourceRefresh({ status: 'error', message: 'Generate a pipeline before refreshing sources' })
      return
    }
    setRefreshing(true)
    setSourceRefresh({ status: 'checking', message: 'Checking web sources' })
    try {
      const res = await fetch('/api/research/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pipelineState }),
      })
      if (!res.ok) throw new Error('refresh failed')
      const body = (await res.json()) as RefreshResponse
      setSourceRefresh(statusFromRefresh(body))
      setMcpToolCalls([...useProjectStore.getState().mcpToolCalls, ...body.mcpToolCalls])
    } catch {
      setSourceRefresh({ status: 'error', message: 'Refresh failed' })
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <main className="h-screen overflow-y-auto bg-[#0a0a0a] text-white">
      <BuildPackHeader pack={pack} />
      <div className="mx-auto grid max-w-7xl gap-5 px-5 py-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <ProcurementActions
            pack={pack}
            refreshing={refreshing}
            onBuyParts={handleBuyParts}
            onExportRfq={handleExportRfq}
            onRefreshSources={handleRefreshSources}
          />
          <KitContents pack={pack} />
        </div>
        <aside className="space-y-6">
          <SupplierRoutePanel pack={pack} />
          <RfqPackPanel pack={pack} />
        </aside>
      </div>
    </main>
  )
}
```

- [ ] **Step 4: Implement the route and loading state**

Create `app/project/[id]/marketplace/page.tsx`:

```tsx
import { use } from 'react'
import { MarketplacePage } from '@/components/marketplace/MarketplacePage'

export default function ProjectMarketplacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return <MarketplacePage projectId={id} />
}
```

Create `app/project/[id]/marketplace/loading.tsx`:

```tsx
export default function MarketplaceLoading() {
  return (
    <main className="flex h-screen items-center justify-center bg-[#0a0a0a] text-white">
      <div className="border border-white/[0.08] bg-white/[0.035] px-5 py-4">
        <p className="text-[10px] uppercase tracking-widest text-white/30">Build Pack Marketplace</p>
        <p className="mt-2 text-sm text-white/60">Preparing procurement view...</p>
      </div>
    </main>
  )
}
```

- [ ] **Step 5: Run marketplace page tests**

Run:

```bash
npm run test -- __tests__/marketplace-page.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit marketplace page**

Run:

```bash
git add components/marketplace/MarketplacePage.tsx app/project/[id]/marketplace/page.tsx app/project/[id]/marketplace/loading.tsx __tests__/marketplace-page.test.tsx
git commit -m "feat: add build pack marketplace page"
```

Expected: commit succeeds.

---

## Task 4: Workspace Header CTA

**Files:**
- Modify: `components/ui/Header.tsx`
- Modify: `app/project/[id]/workspace/page.tsx`
- Test: `__tests__/header-build-pack-link.test.tsx`

- [ ] **Step 1: Write header CTA tests**

Create `__tests__/header-build-pack-link.test.tsx`:

```tsx
import { act } from 'react'
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Header } from '../components/ui/Header'
import { useProjectStore } from '../lib/store'

vi.mock('../components/ui/ExportMenu', () => ({
  ExportMenu: () => <div>Export Menu</div>,
}))

describe('Header Build Pack CTA', () => {
  beforeEach(() => {
    act(() => {
      useProjectStore.getState().reset()
    })
  })

  it('hides Order Build Pack before a BOM exists', () => {
    const html = renderToString(<Header projectId="project-1" projectTitle="Demo" />)

    expect(html).toContain('Manu')
    expect(html).not.toContain('Order Build Pack')
  })

  it('shows Order Build Pack when BOM rows exist', () => {
    act(() => {
      useProjectStore.getState().setBOM([
        { id: 'sensor', part: 'Sensor', supplierRoute: 'Distributor', cost: 10 },
      ])
    })

    const html = renderToString(<Header projectId="project-1" projectTitle="Demo" />)

    expect(html).toContain('Order Build Pack')
    expect(html).toContain('/project/project-1/marketplace')
  })
})
```

- [ ] **Step 2: Run the header tests and verify they fail**

Run:

```bash
npm run test -- __tests__/header-build-pack-link.test.tsx
```

Expected: FAIL because `Header` does not accept `projectId` and has no marketplace CTA.

- [ ] **Step 3: Update the header**

Replace `components/ui/Header.tsx` with:

```tsx
'use client'

import Link from 'next/link'
import { useProjectStore } from '@/lib/store'
import { ExportMenu } from './ExportMenu'

type Props = {
  projectId?: string
  projectTitle?: string
}

export function Header({ projectId, projectTitle }: Props) {
  const bomLen = useProjectStore((state) => state.bom.length)
  const showBuildPack = Boolean(projectId && bomLen > 0)

  return (
    <div className="flex h-11 shrink-0 items-center justify-between border-b border-white/[0.06] px-4">
      <div className="flex min-w-0 items-center gap-3">
        <span className="text-sm font-medium tracking-tight text-white/90">Manu</span>
        {projectTitle && (
          <>
            <span className="text-white/20">/</span>
            <span className="max-w-[240px] truncate text-sm text-white/50">{projectTitle}</span>
          </>
        )}
      </div>
      <div className="flex items-center gap-2">
        {showBuildPack && (
          <Link
            href={`/project/${projectId}/marketplace`}
            className="rounded border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs text-emerald-300 transition-colors hover:bg-emerald-400/15"
          >
            Order Build Pack
          </Link>
        )}
        <ExportMenu />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Pass the project id from the workspace**

In `app/project/[id]/workspace/page.tsx`, change:

```tsx
<Header projectTitle={projectTitle || undefined} />
```

to:

```tsx
<Header projectId={projectId} projectTitle={projectTitle || undefined} />
```

- [ ] **Step 5: Run header tests**

Run:

```bash
npm run test -- __tests__/header-build-pack-link.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit the CTA**

Run:

```bash
git add components/ui/Header.tsx app/project/[id]/workspace/page.tsx __tests__/header-build-pack-link.test.tsx
git commit -m "feat: link workspace to build pack marketplace"
```

Expected: commit succeeds.

---

## Task 5: README Marketplace Documentation

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update README with marketplace flow**

Add this section after `Main Runtime Flow` in `README.md`:

```md
## Build Pack Marketplace

The completed workspace can open a procurement view:

```text
/project/[id]/marketplace
```

The marketplace is a Build Pack page. It turns the pipeline output into:

- a procurement readiness summary
- grouped BOM contents with MPN, manufacturer, lifecycle and source status
- distributor buy links wrapped through `/api/go`
- RFQ questions for suppliers
- supplier route handoff
- source refresh through `/api/research/refresh`

This is not a fake checkout. The UI does not invent stock, live pricing, delivery dates or verified supplier guarantees.

### Sourcing Truth Policy

- `verified`: live or manually reviewed source
- `seeded`: curated catalog / registry source; price remains an estimate
- `candidate`: candidate result or estimate requiring confirmation
- `not_configured`: live source refresh is unavailable
- `error`: lookup failed; confirm before purchase

`/api/go` owns the marketplace redirect funnel. It allowlists known distributor hosts, tags outbound links, and logs clicks to `data/_marketplace-clicks.jsonl` without blocking the redirect.

`/api/research/refresh` calls compliance and hardware source tools. Without `TAVILY_API_KEY`, refresh returns `not_configured` and the marketplace keeps using seeded sources.
```

- [ ] **Step 2: Ensure verification commands remain documented**

Confirm `README.md` still contains:

```md
npm run test
npm run lint
npm run build
```

If the commands are missing, add them under the existing `Tests` or `Run` sections.

- [ ] **Step 3: Commit README update**

Run:

```bash
git add README.md
git commit -m "docs: document build pack marketplace"
```

Expected: commit succeeds.

---

## Task 6: Integration Verification And Polish

**Files:**
- Modify only files touched in Tasks 1-5 if verification finds real issues.

- [ ] **Step 1: Run targeted marketplace tests**

Run:

```bash
npm run test -- __tests__/marketplace-build-pack.test.ts __tests__/marketplace-page.test.tsx __tests__/header-build-pack-link.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run the full test suite**

Run:

```bash
npm run test
```

Expected: PASS.

- [ ] **Step 3: Run lint**

Run:

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 4: Run production build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 5: Manual demo smoke test**

Run the dev server:

```bash
npm run dev
```

Expected: Next dev server starts and prints a local URL, usually `http://localhost:3000`.

Manual browser flow:

1. Open the workspace demo project.
2. Generate or load the demo prompt.
3. Apply the DfMA fix if the risk checkpoint appears.
4. Confirm `Order Build Pack` appears in the header after BOM generation.
5. Click `Order Build Pack`.
6. Confirm the marketplace shows Build Pack header, Procurement Actions, Kit Contents, Supplier Route, and RFQ Pack.
7. Confirm `Buy` links point to `/api/go?...` and open distributor pages.
8. Click `Refresh Sourcing` without `TAVILY_API_KEY`; confirm it reports the not-configured or seeded-source state without modifying source truth.

- [ ] **Step 6: Stop the dev server**

If the dev server was started in the current session, stop it with `Ctrl-C`.

Expected: no long-running session remains.

- [ ] **Step 7: Commit verification fixes if any files changed**

If verification required fixes, run:

```bash
git status --short
git add <changed-files>
git commit -m "fix: polish build pack marketplace"
```

Expected: commit succeeds when there are verification fixes. If no files changed, skip this commit.

---

## Self-Review

Spec coverage:

- Dedicated `/project/[id]/marketplace` page: Task 3.
- Workspace `Order Build Pack` CTA: Task 4.
- Build Pack helper layer: Task 1.
- Grouped BOM and source badges: Tasks 1 and 2.
- Buy Parts through `/api/go`: Tasks 2 and 3.
- Send RFQ Pack through existing exports: Task 3.
- Refresh Sourcing through `/api/research/refresh`: Task 3.
- Supplier route and RFQ panels: Task 2.
- Empty/error states: Task 3.
- README update: Task 5.
- Tests and verification commands: Tasks 1, 3, 4, and 6.

Placeholder scan:

- No unresolved marker strings or open-ended implementation steps are present.
- Every code-writing step includes concrete file content or an exact replacement.

Type consistency:

- `deriveBuildPack` types use existing `BOMRow`, `BOMOffer`, `GbaRouteDisplayStep`, `SimulationWarning`, and `SourceRefreshState`.
- UI components consume the `BuildPack` shape defined in Task 1.
- `MarketplacePage` passes the exact input shape expected by `deriveBuildPack`.
