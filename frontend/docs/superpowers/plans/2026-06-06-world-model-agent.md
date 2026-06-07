# World Model Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn world-model simulation output into a first-class agent verdict that appears in chat, proposes a generic resilience fix, and applies that fix through the existing pipeline.

**Architecture:** Add a deterministic `lib/world-model/agent.ts` that analyzes `SimulationReport` objects and returns typed verdicts. Add API routes for analysis and hybrid fix application, then wire `lib/world-model-simulation.ts` and chat UI to show/action the verdict. Keep Reports as telemetry and chat as the decision surface.

**Tech Stack:** Next.js 16 App Router, React 19, Zustand, TypeScript, Vitest, existing pipeline orchestrator/edit APIs.

---

## File Structure

- Modify: `lib/types.ts`
  - Add `WorldModelVerdict`, evidence, recommended action, and chat message typing.
- Create: `lib/world-model/agent.ts`
  - Pure deterministic analysis; no store mutation, no fetch, no LLM.
- Create: `__tests__/world-model-agent.test.ts`
  - Unit tests for verdict thresholds and fix mapping.
- Create: `app/api/world-model/analyze/route.ts`
  - Server endpoint for agent analysis.
- Create: `app/api/world-model/apply-fix/route.ts`
  - Server endpoint for applying `dfma_fix` or `component_edit` recommendations.
- Modify: `lib/pipeline-stream.ts`
  - Add client helpers for analyze/apply world-model fix.
- Create: `components/right/WorldModelVerdictCard.tsx`
  - Chat card for verdicts and actions.
- Modify: `components/right/ChatMessage.tsx`
  - Render world-model verdict cards.
- Modify: `lib/store.ts`
  - Track verdict messages with existing message flow; no separate global verdict state needed.
- Modify: `lib/world-model-simulation.ts`
  - Call analyze endpoint after final frame and add verdict message.
- Modify: `README.md`
  - Document World Model Agent flow and demo sequence.

---

## Task 1: Add World Model Verdict Types

**Files:**
- Modify: `lib/types.ts`
- Test: `__tests__/world-model-agent.test.ts`

- [ ] **Step 1: Write the failing type-level smoke test**

Create `__tests__/world-model-agent.test.ts` with:

```ts
import { describe, expect, test } from 'vitest'
import type { WorldModelVerdict } from '@/lib/types'

describe('world model agent types', () => {
  test('supports a typed critical verdict with a DfMA fix recommendation', () => {
    const verdict: WorldModelVerdict = {
      id: 'wm-catastrophic-1',
      severity: 'critical',
      scenario: 'catastrophic',
      fixed: false,
      failureMode: 'moisture_ingress',
      title: 'World Model blocked this design',
      summary: 'Moisture ingress cascade at week 38.',
      rootCause: 'Seal degradation allowed moisture risk to propagate into electronics.',
      affectedComponents: ['enclosure', 'compute'],
      evidence: {
        peakDeviceRisk: 0.74,
        peakWeek: 38,
        peakComponentId: 'enclosure',
        peakComponentRisk: 0.68,
        dominantFailureHead: 'moisture_ingress_prob',
        dominantFailureProbability: 0.61,
        triggerAction: 'humidity_soak',
      },
      recommendedAction: {
        kind: 'dfma_fix',
        label: 'Apply weatherproofing resilience fix',
        dfmaWarningId: 'IP_INSUFFICIENT',
        explanation: 'The failure signature maps to the existing enclosure weatherproofing fix.',
      },
    }

    expect(verdict.recommendedAction.kind).toBe('dfma_fix')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm run test -- __tests__/world-model-agent.test.ts
```

Expected: FAIL because `WorldModelVerdict` is not exported from `lib/types.ts`.

- [ ] **Step 3: Add verdict types**

Append to `lib/types.ts` after `SimulationReport`:

```ts
export type WorldModelSeverity = 'pass' | 'warning' | 'critical'

export type WorldModelFailureMode =
  | 'none'
  | 'moisture_ingress'
  | 'thermal_stress'
  | 'bracket_fatigue'
  | 'sensor_drift'
  | 'unknown'

export type WorldModelEvidence = {
  peakDeviceRisk: number
  peakWeek: number
  peakComponentId: string | null
  peakComponentRisk: number
  dominantFailureHead: keyof Pick<
    SimulationStep,
    | 'moisture_ingress_prob'
    | 'thermal_runaway_prob'
    | 'seal_failure_prob'
    | 'bracket_failure_prob'
  > | null
  dominantFailureProbability: number
  triggerAction: string
}

export type WorldModelRecommendedAction =
  | {
      kind: 'none'
      label: string
      explanation: string
    }
  | {
      kind: 'dfma_fix'
      label: string
      dfmaWarningId: string
      explanation: string
    }
  | {
      kind: 'component_edit'
      label: string
      editOps: import('@/lib/pipeline/edit-resolver').EditOp[]
      explanation: string
    }

export type WorldModelVerdict = {
  id: string
  severity: WorldModelSeverity
  scenario: SimulationScenario
  fixed: boolean
  failureMode: WorldModelFailureMode
  title: string
  summary: string
  rootCause: string
  affectedComponents: string[]
  evidence: WorldModelEvidence
  recommendedAction: WorldModelRecommendedAction
}
```

Then update `MessageType`:

```ts
export type MessageType =
  | 'user'
  | 'ai'
  | 'tool-call'
  | 'context-card'
  | 'warning-card'
  | 'world-model-verdict'
  | 'action-button'
  | 'file-upload'
```

And update `ChatMessage`:

```ts
export type ChatMessage = {
  id: string
  type: MessageType
  content: string
  timestamp: number
  toolCall?: ChatToolCall
  warning?: SimulationWarning
  worldModelVerdict?: WorldModelVerdict
  actionLabel?: string
  actionCallback?: string
  fileName?: string
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm run test -- __tests__/world-model-agent.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/types.ts __tests__/world-model-agent.test.ts
git commit -m "feat(world-model): add verdict types"
```

---

## Task 2: Implement Deterministic World Model Agent

**Files:**
- Create: `lib/world-model/agent.ts`
- Modify: `__tests__/world-model-agent.test.ts`

- [ ] **Step 1: Add failing agent tests**

Replace `__tests__/world-model-agent.test.ts` with:

```ts
import { describe, expect, test } from 'vitest'
import { analyzeWorldModelReport } from '@/lib/world-model/agent'
import type { PipelineState } from '@/lib/pipeline/types'
import type { SimulationReport, SimulationScenario, SimulationStep } from '@/lib/types'

function step(overrides: Partial<SimulationStep>): SimulationStep {
  return {
    timestep: 1,
    scenario: 'catastrophic',
    objective: 'moisture_ingress',
    moisture_ingress_prob: 0.01,
    thermal_runaway_prob: 0.01,
    seal_failure_prob: 0.01,
    bracket_failure_prob: 0.01,
    device_failure_prob: 0.01,
    active_stress_action: 'none',
    enclosure_seal_integrity: 0.98,
    pcb_health: 0.98,
    battery_soc: 0.95,
    bracket_corrosion: 0.02,
    moisture_sensor_drift: 0.02,
    crack_sensor_drift: 0.02,
    tilt_sensor_drift: 0.01,
    ...overrides,
  }
}

function report(
  scenario: SimulationScenario,
  steps: SimulationStep[],
  risksByStep: Record<string, number>[]
): SimulationReport {
  return {
    scenario,
    objective: 'moisture_ingress',
    usesPlanner: scenario === 'catastrophic',
    fixed: false,
    generatedAt: 1,
    steps,
    risksByStep,
  }
}

function pipelineStateWithDfmaWarning(): PipelineState {
  return {
    prompt: 'sensor node',
    deploymentContext: {
      city: 'Hong Kong',
      site: 'residential facade',
      surface: 'outdoor facade',
      goal: 'monitor moisture ingress',
      environment: ['humid', 'rain'],
      climate: { humidity: 'high', rainfall: 'heavy', wind: 'typhoon' },
      constraints: [],
    },
    compliance: { requirements: [] },
    componentGraph: { node_type: 'sensor_node', selected_component_ids: ['enclosure', 'compute'] },
    assembly: { pattern_id: 'test', summary: 'test', steps: [] },
    bom: { rows: [], total_cost_usd: 0 },
    dfma: {
      warnings: [{
        id: 'IP_INSUFFICIENT',
        category: 'environmental',
        severity: 'critical',
        title: 'IP insufficient',
        explanation: 'Missing gasket',
        affected_component_ids: ['enclosure'],
        fix: {
          label: 'Add gasket',
          add_component_ids: ['ip67-gasket'],
          add_scene_only_ids: [],
          cost_delta_usd: 4,
          rfq_topic_tags: ['weatherproofing'],
        },
      }],
      passed_checks: [],
    },
    rfq: { supplier_questions: [], gba_route: [] },
    scene: { nodes: [] },
    fixApplied: false,
    appliedWarningId: null,
    usedDeterministic: true,
    baselineComponentIds: ['enclosure', 'compute'],
    baselineBomTotal: 0,
    extraComponents: [],
    gbaRouteDisplay: [],
    mcpToolCalls: [],
    agentTrace: [],
    pipelineStatus: 'complete',
    interruption: null,
  }
}

describe('analyzeWorldModelReport', () => {
  test('returns pass for low-risk reports', () => {
    const verdict = analyzeWorldModelReport({
      pipelineState: pipelineStateWithDfmaWarning(),
      report: report('normal', [step({ timestep: 1 })], [{ enclosure: 0.05 }]),
      previousReports: [],
    })

    expect(verdict.severity).toBe('pass')
    expect(verdict.recommendedAction.kind).toBe('none')
  })

  test('returns warning for medium device risk', () => {
    const verdict = analyzeWorldModelReport({
      pipelineState: pipelineStateWithDfmaWarning(),
      report: report('stressed', [step({ timestep: 12, device_failure_prob: 0.31 })], [{ enclosure: 0.2 }]),
      previousReports: [],
    })

    expect(verdict.severity).toBe('warning')
    expect(verdict.evidence.peakDeviceRisk).toBeCloseTo(0.31)
  })

  test('maps critical moisture ingress to existing DfMA fix', () => {
    const verdict = analyzeWorldModelReport({
      pipelineState: pipelineStateWithDfmaWarning(),
      report: report(
        'catastrophic',
        [step({
          timestep: 38,
          moisture_ingress_prob: 0.66,
          seal_failure_prob: 0.5,
          device_failure_prob: 0.74,
          enclosure_seal_integrity: 0.28,
          active_stress_action: 'humidity_soak',
        })],
        [{ enclosure: 0.68, compute: 0.51 }]
      ),
      previousReports: [],
    })

    expect(verdict.severity).toBe('critical')
    expect(verdict.failureMode).toBe('moisture_ingress')
    expect(verdict.recommendedAction.kind).toBe('dfma_fix')
    if (verdict.recommendedAction.kind === 'dfma_fix') {
      expect(verdict.recommendedAction.dfmaWarningId).toBe('IP_INSUFFICIENT')
    }
  })

  test('maps thermal risk to component edit', () => {
    const verdict = analyzeWorldModelReport({
      pipelineState: pipelineStateWithDfmaWarning(),
      report: report(
        'catastrophic',
        [step({ timestep: 22, thermal_runaway_prob: 0.58, device_failure_prob: 0.55, battery_soc: 0.42 })],
        [{ battery: 0.65, compute: 0.4 }]
      ),
      previousReports: [],
    })

    expect(verdict.failureMode).toBe('thermal_stress')
    expect(verdict.recommendedAction.kind).toBe('component_edit')
  })

  test('handles empty report without crashing', () => {
    const verdict = analyzeWorldModelReport({
      pipelineState: pipelineStateWithDfmaWarning(),
      report: report('normal', [], []),
      previousReports: [],
    })

    expect(verdict.severity).toBe('pass')
    expect(verdict.failureMode).toBe('unknown')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm run test -- __tests__/world-model-agent.test.ts
```

Expected: FAIL because `@/lib/world-model/agent` does not exist.

- [ ] **Step 3: Implement agent**

Create `lib/world-model/agent.ts`:

```ts
import type { PipelineState } from '@/lib/pipeline/types'
import type {
  SimulationReport,
  SimulationStep,
  WorldModelEvidence,
  WorldModelFailureMode,
  WorldModelRecommendedAction,
  WorldModelSeverity,
  WorldModelVerdict,
} from '@/lib/types'

type AnalyzeInput = {
  pipelineState: PipelineState
  report: SimulationReport
  previousReports?: SimulationReport[]
}

const THRESHOLDS = {
  passDeviceRisk: 0.2,
  passComponentRisk: 0.35,
  passFailureHead: 0.25,
  criticalDeviceRisk: 0.5,
  criticalFailureHead: 0.45,
  criticalComponentRisk: 0.6,
}

const FAILURE_HEADS = [
  'moisture_ingress_prob',
  'thermal_runaway_prob',
  'seal_failure_prob',
  'bracket_failure_prob',
] as const

function clamp01(value: number | undefined) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value ?? 0))
}

function formatPercent(value: number) {
  return `${Math.round(clamp01(value) * 100)}%`
}

function maxEntry(values: Record<string, number> | undefined): [string | null, number] {
  const entries = Object.entries(values ?? {})
  if (entries.length === 0) return [null, 0]
  const [id, risk] = entries.sort((a, b) => b[1] - a[1])[0]
  return [id, clamp01(risk)]
}

function dominantFailure(step: SimulationStep | undefined): {
  head: WorldModelEvidence['dominantFailureHead']
  probability: number
} {
  if (!step) return { head: null, probability: 0 }
  const [head, probability] = FAILURE_HEADS
    .map((key) => [key, clamp01(step[key])] as const)
    .sort((a, b) => b[1] - a[1])[0]
  return { head, probability }
}

function evidenceFromReport(report: SimulationReport): WorldModelEvidence {
  const indexed = report.steps.map((step, index) => ({ step, index }))
  const peak = indexed.sort((a, b) => clamp01(b.step.device_failure_prob) - clamp01(a.step.device_failure_prob))[0]
  const peakStep = peak?.step
  const peakIndex = peak?.index ?? 0
  const [peakComponentId, peakComponentRisk] = maxEntry(report.risksByStep[peakIndex])
  const dominant = dominantFailure(peakStep)

  return {
    peakDeviceRisk: clamp01(peakStep?.device_failure_prob),
    peakWeek: peakStep?.timestep ?? 0,
    peakComponentId,
    peakComponentRisk,
    dominantFailureHead: dominant.head,
    dominantFailureProbability: dominant.probability,
    triggerAction: peakStep?.active_stress_action ?? 'none',
  }
}

function severityFromEvidence(evidence: WorldModelEvidence): WorldModelSeverity {
  if (
    evidence.peakDeviceRisk >= THRESHOLDS.criticalDeviceRisk ||
    evidence.dominantFailureProbability >= THRESHOLDS.criticalFailureHead ||
    evidence.peakComponentRisk >= THRESHOLDS.criticalComponentRisk
  ) {
    return 'critical'
  }
  if (
    evidence.peakDeviceRisk >= THRESHOLDS.passDeviceRisk ||
    evidence.peakComponentRisk >= THRESHOLDS.passComponentRisk ||
    evidence.dominantFailureProbability >= THRESHOLDS.passFailureHead
  ) {
    return 'warning'
  }
  return 'pass'
}

function failureModeFromReport(report: SimulationReport, evidence: WorldModelEvidence): WorldModelFailureMode {
  const peakStep = report.steps.find((step) => step.timestep === evidence.peakWeek)
  if (!peakStep) return 'unknown'
  const moisture = Math.max(clamp01(peakStep.moisture_ingress_prob), clamp01(peakStep.seal_failure_prob))
  const thermal = clamp01(peakStep.thermal_runaway_prob)
  const bracket = Math.max(clamp01(peakStep.bracket_failure_prob), clamp01(peakStep.bracket_corrosion))
  const sensor = Math.max(
    clamp01(peakStep.moisture_sensor_drift),
    clamp01(peakStep.crack_sensor_drift),
    clamp01(peakStep.tilt_sensor_drift)
  )
  const winner = [
    ['moisture_ingress', moisture] as const,
    ['thermal_stress', thermal] as const,
    ['bracket_fatigue', bracket] as const,
    ['sensor_drift', sensor] as const,
  ].sort((a, b) => b[1] - a[1])[0]
  if (winner[1] < 0.2 && evidence.peakDeviceRisk < 0.2) return 'none'
  return winner[0]
}

function hasDfmaWarning(state: PipelineState, warningId: string) {
  return state.dfma.warnings.some((warning) => warning.id === warningId)
}

function recommendedAction(mode: WorldModelFailureMode, severity: WorldModelSeverity, state: PipelineState): WorldModelRecommendedAction {
  if (severity === 'pass' || mode === 'none' || mode === 'unknown') {
    return {
      kind: 'none',
      label: 'No hardware change required',
      explanation: 'The simulated rollout stayed below the intervention threshold.',
    }
  }
  if (mode === 'moisture_ingress' && hasDfmaWarning(state, 'IP_INSUFFICIENT')) {
    return {
      kind: 'dfma_fix',
      label: 'Apply weatherproofing resilience fix',
      dfmaWarningId: 'IP_INSUFFICIENT',
      explanation: 'The failure signature maps to the existing enclosure weatherproofing fix.',
    }
  }
  if (mode === 'thermal_stress') {
    return {
      kind: 'component_edit',
      label: 'Harden thermal path',
      explanation: 'Add a thermal mitigation component and rerun the supplier/scene pipeline.',
      editOps: [{ op: 'add', component: { part: 'Thermal isolation pad and heat spreader', category: 'thermal', estimated_cost_usd: 5 } }],
    }
  }
  if (mode === 'bracket_fatigue') {
    return {
      kind: 'component_edit',
      label: 'Harden mounting system',
      explanation: 'Add a vibration-isolating corrosion-resistant mounting component.',
      editOps: [{ op: 'add', component: { part: 'Vibration-isolating 316L bracket kit', category: 'mechanical', estimated_cost_usd: 8 } }],
    }
  }
  if (mode === 'sensor_drift') {
    return {
      kind: 'component_edit',
      label: 'Harden sensing accuracy',
      explanation: 'Add a calibration reference so drift can be detected and compensated.',
      editOps: [{ op: 'add', component: { part: 'Environmental calibration reference', category: 'sensor', estimated_cost_usd: 6 } }],
    }
  }
  return {
    kind: 'component_edit',
    label: 'Harden enclosure resilience',
    explanation: 'Add generic resilience hardening because no existing DfMA fix is available.',
    editOps: [{ op: 'add', component: { part: 'Weatherproof enclosure hardening kit', category: 'enclosure', estimated_cost_usd: 7 } }],
  }
}

function copyFor(mode: WorldModelFailureMode, severity: WorldModelSeverity, evidence: WorldModelEvidence) {
  if (severity === 'pass') {
    return {
      title: 'World Model passed this design',
      summary: `Peak device risk stayed at ${formatPercent(evidence.peakDeviceRisk)}.`,
      rootCause: 'The simulated field rollout stayed below the intervention thresholds.',
    }
  }
  const label = {
    moisture_ingress: 'Moisture ingress cascade',
    thermal_stress: 'Thermal stress',
    bracket_fatigue: 'Mounting fatigue',
    sensor_drift: 'Sensor drift',
    none: 'No dominant failure mode',
    unknown: 'Unknown failure mode',
  }[mode]
  return {
    title: severity === 'critical' ? 'World Model blocked this design' : 'World Model found field risk',
    summary: `${label} at week ${evidence.peakWeek}.`,
    rootCause:
      mode === 'moisture_ingress'
        ? 'Seal degradation under moisture and stress allows risk to propagate into protected electronics.'
        : mode === 'thermal_stress'
          ? 'The rollout shows thermal or battery stress rising beyond the resilience threshold.'
          : mode === 'bracket_fatigue'
            ? 'The mounting path accumulates corrosion or vibration-driven fatigue under the simulated stress protocol.'
            : mode === 'sensor_drift'
              ? 'Sensor state drift rises enough to threaten field measurement reliability.'
              : 'The rollout produced a risk signature that needs engineering review before manufacturing.',
  }
}

export function analyzeWorldModelReport({ pipelineState, report }: AnalyzeInput): WorldModelVerdict {
  const evidence = evidenceFromReport(report)
  const severity = severityFromEvidence(evidence)
  const failureMode = failureModeFromReport(report, evidence)
  const copy = copyFor(failureMode, severity, evidence)

  return {
    id: `wm-${report.scenario}-${report.fixed ? 'fixed' : 'unfixed'}-${report.generatedAt}`,
    severity,
    scenario: report.scenario,
    fixed: report.fixed,
    failureMode,
    title: copy.title,
    summary: copy.summary,
    rootCause: copy.rootCause,
    affectedComponents: [evidence.peakComponentId].filter(Boolean) as string[],
    evidence,
    recommendedAction: recommendedAction(failureMode, severity, pipelineState),
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm run test -- __tests__/world-model-agent.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/world-model/agent.ts __tests__/world-model-agent.test.ts
git commit -m "feat(world-model): analyze simulation verdicts"
```

---

## Task 3: Add World Model Analyze API

**Files:**
- Create: `app/api/world-model/analyze/route.ts`
- Test: `__tests__/world-model-api.test.ts`

- [ ] **Step 1: Write failing route tests**

Create `__tests__/world-model-api.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import { POST } from '@/app/api/world-model/analyze/route'

describe('/api/world-model/analyze', () => {
  test('rejects missing payload', async () => {
    const res = await POST(new Request('http://localhost/api/world-model/analyze', {
      method: 'POST',
      body: JSON.stringify({}),
    }))

    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm run test -- __tests__/world-model-api.test.ts
```

Expected: FAIL because the route does not exist.

- [ ] **Step 3: Implement route**

Create `app/api/world-model/analyze/route.ts`:

```ts
import { analyzeWorldModelReport } from '@/lib/world-model/agent'
import type { PipelineState } from '@/lib/pipeline/types'
import type { SimulationReport } from '@/lib/types'

export async function POST(req: Request) {
  let pipelineState: PipelineState
  let report: SimulationReport
  let previousReports: SimulationReport[] | undefined

  try {
    ;({ pipelineState, report, previousReports } = await req.json())
    if (!pipelineState || !report || !Array.isArray(report.steps)) throw new Error('missing fields')
  } catch {
    return Response.json({ error: 'bad request' }, { status: 400 })
  }

  return Response.json(analyzeWorldModelReport({
    pipelineState,
    report,
    previousReports: previousReports ?? [],
  }))
}
```

- [ ] **Step 4: Run route test**

Run:

```bash
npm run test -- __tests__/world-model-api.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/world-model/analyze/route.ts __tests__/world-model-api.test.ts
git commit -m "feat(world-model): add analyze api"
```

---

## Task 4: Add Hybrid Apply-Fix API

**Files:**
- Create: `app/api/world-model/apply-fix/route.ts`
- Modify: `__tests__/world-model-api.test.ts`

- [ ] **Step 1: Add failing bad-payload test**

Append to `__tests__/world-model-api.test.ts`:

```ts
import { POST as APPLY_FIX } from '@/app/api/world-model/apply-fix/route'

describe('/api/world-model/apply-fix', () => {
  test('rejects missing verdict or pipeline state', async () => {
    const res = await APPLY_FIX(new Request('http://localhost/api/world-model/apply-fix', {
      method: 'POST',
      body: JSON.stringify({}),
    }))

    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm run test -- __tests__/world-model-api.test.ts
```

Expected: FAIL because `app/api/world-model/apply-fix/route.ts` does not exist.

- [ ] **Step 3: Implement route**

Create `app/api/world-model/apply-fix/route.ts`:

```ts
import { applyComponentEdit, applyPipelineFix } from '@/lib/pipeline/orchestrator'
import type { PipelineState } from '@/lib/pipeline/types'
import type { WorldModelVerdict } from '@/lib/types'

export async function POST(req: Request) {
  let pipelineState: PipelineState
  let verdict: WorldModelVerdict

  try {
    ;({ pipelineState, verdict } = await req.json())
    if (!pipelineState || !verdict?.recommendedAction) throw new Error('missing fields')
  } catch {
    return Response.json({ error: 'bad request' }, { status: 400 })
  }

  const action = verdict.recommendedAction
  if (action.kind === 'none') {
    return Response.json({ error: 'no actionable fix for this verdict' }, { status: 422 })
  }

  if (action.kind === 'dfma_fix') {
    return Response.json(await applyPipelineFix(pipelineState, action.dfmaWarningId))
  }

  return Response.json(await applyComponentEdit(pipelineState, action.editOps))
}
```

- [ ] **Step 4: Run test**

Run:

```bash
npm run test -- __tests__/world-model-api.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/world-model/apply-fix/route.ts __tests__/world-model-api.test.ts
git commit -m "feat(world-model): apply verdict fixes"
```

---

## Task 5: Add Client API Helpers

**Files:**
- Modify: `lib/pipeline-stream.ts`
- Test: `__tests__/pipeline-stream-world-model.test.ts`

- [ ] **Step 1: Write failing helper tests**

Create `__tests__/pipeline-stream-world-model.test.ts`:

```ts
import { afterEach, describe, expect, test, vi } from 'vitest'
import { analyzeWorldModelApi, applyWorldModelFixApi } from '@/lib/pipeline-stream'

describe('world model pipeline client helpers', () => {
  afterEach(() => vi.restoreAllMocks())

  test('posts report to analyze endpoint', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ severity: 'pass' }),
    } as Response)

    await analyzeWorldModelApi({ id: 'state' }, { steps: [] }, [])

    expect(fetchMock).toHaveBeenCalledWith('/api/world-model/analyze', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }))
  })

  test('posts verdict to apply-fix endpoint', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ pipelineStatus: 'complete' }),
    } as Response)

    await applyWorldModelFixApi({ id: 'state' }, { id: 'verdict' })

    expect(fetchMock).toHaveBeenCalledWith('/api/world-model/apply-fix', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm run test -- __tests__/pipeline-stream-world-model.test.ts
```

Expected: FAIL because helpers do not exist.

- [ ] **Step 3: Add helpers**

Append to `lib/pipeline-stream.ts`:

```ts
export async function analyzeWorldModelApi(
  pipelineState: unknown,
  report: unknown,
  previousReports: unknown[] = []
): Promise<unknown> {
  const res = await fetch('/api/world-model/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pipelineState, report, previousReports }),
  })
  if (!res.ok) throw new Error('World model analysis failed')
  return res.json()
}

export async function applyWorldModelFixApi(
  pipelineState: unknown,
  verdict: unknown
): Promise<unknown> {
  const res = await fetch('/api/world-model/apply-fix', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pipelineState, verdict }),
  })
  if (!res.ok) throw new Error('World model fix failed')
  return res.json()
}
```

- [ ] **Step 4: Run helper test**

Run:

```bash
npm run test -- __tests__/pipeline-stream-world-model.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/pipeline-stream.ts __tests__/pipeline-stream-world-model.test.ts
git commit -m "feat(world-model): add client helpers"
```

---

## Task 6: Render World Model Verdict Card

**Files:**
- Create: `components/right/WorldModelVerdictCard.tsx`
- Modify: `components/right/ChatMessage.tsx`
- Test: `__tests__/world-model-verdict-card.test.tsx`

- [ ] **Step 1: Write failing render test**

Create `__tests__/world-model-verdict-card.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { ChatMessage } from '@/components/right/ChatMessage'
import type { ChatMessage as ChatMessageType } from '@/lib/types'

describe('WorldModelVerdictCard', () => {
  test('renders verdict evidence and action label', () => {
    const message: ChatMessageType = {
      id: 'wm-message',
      type: 'world-model-verdict',
      content: '',
      timestamp: 1,
      worldModelVerdict: {
        id: 'wm-1',
        severity: 'critical',
        scenario: 'catastrophic',
        fixed: false,
        failureMode: 'moisture_ingress',
        title: 'World Model blocked this design',
        summary: 'Moisture ingress cascade at week 38.',
        rootCause: 'Seal degradation allowed moisture propagation.',
        affectedComponents: ['enclosure'],
        evidence: {
          peakDeviceRisk: 0.74,
          peakWeek: 38,
          peakComponentId: 'enclosure',
          peakComponentRisk: 0.68,
          dominantFailureHead: 'moisture_ingress_prob',
          dominantFailureProbability: 0.66,
          triggerAction: 'humidity_soak',
        },
        recommendedAction: {
          kind: 'dfma_fix',
          label: 'Apply weatherproofing resilience fix',
          dfmaWarningId: 'IP_INSUFFICIENT',
          explanation: 'Maps to weatherproofing.',
        },
      },
    }

    render(<ChatMessage message={message} />)

    expect(screen.getByText('World Model blocked this design')).toBeInTheDocument()
    expect(screen.getByText(/Peak device risk: 74%/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Apply weatherproofing resilience fix/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm run test -- __tests__/world-model-verdict-card.test.tsx
```

Expected: FAIL because `ChatMessage` does not render `world-model-verdict`.

- [ ] **Step 3: Implement card and render branch**

Create `components/right/WorldModelVerdictCard.tsx`:

```tsx
'use client'
import type { WorldModelVerdict } from '@/lib/types'

type Props = {
  verdict: WorldModelVerdict
}

function percent(value: number) {
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`
}

function formatAction(action: string) {
  return action.replace(/_/g, ' ')
}

export function WorldModelVerdictCard({ verdict }: Props) {
  const action = verdict.recommendedAction
  const canApply = action.kind !== 'none'
  const severityClass = verdict.severity === 'critical'
    ? 'border-red-400/35 bg-red-400/[0.06]'
    : verdict.severity === 'warning'
      ? 'border-amber-400/35 bg-amber-400/[0.06]'
      : 'border-emerald-400/25 bg-emerald-400/[0.05]'

  return (
    <div className={`rounded-lg border p-3 ${severityClass}`}>
      <p className="text-[10px] uppercase tracking-widest text-white/35">World Model Agent</p>
      <p className="mt-1 text-sm font-medium text-white/90">{verdict.title}</p>
      <p className="mt-1 text-xs text-white/55">{verdict.summary}</p>

      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
        <div className="rounded-md border border-white/[0.06] bg-black/10 px-2 py-1.5">
          <p className="text-white/30">Peak device risk</p>
          <p className="font-mono text-white/80">{percent(verdict.evidence.peakDeviceRisk)}</p>
        </div>
        <div className="rounded-md border border-white/[0.06] bg-black/10 px-2 py-1.5">
          <p className="text-white/30">Peak week</p>
          <p className="font-mono text-white/80">{verdict.evidence.peakWeek}</p>
        </div>
      </div>

      <p className="mt-2 text-[11px] text-white/45">
        Highest component: <span className="text-white/70">{verdict.evidence.peakComponentId ?? 'none'}</span>
        {' · '}
        Trigger: <span className="text-white/70">{formatAction(verdict.evidence.triggerAction)}</span>
      </p>
      <p className="mt-2 text-xs leading-relaxed text-white/55">{verdict.rootCause}</p>

      {canApply ? (
        <button
          type="button"
          className="mt-3 w-full rounded-md border border-blue-400/25 bg-blue-400/10 px-3 py-2 text-xs font-medium text-blue-200 transition-colors hover:bg-blue-400/15"
        >
          {action.label}
        </button>
      ) : (
        <p className="mt-3 text-xs text-emerald-300/75">{action.explanation}</p>
      )}
    </div>
  )
}
```

Modify `components/right/ChatMessage.tsx`:

```tsx
import { WorldModelVerdictCard } from './WorldModelVerdictCard'
```

Add before action-button handling:

```tsx
  if (message.type === 'world-model-verdict' && message.worldModelVerdict) {
    return (
      <div className="my-2">
        <WorldModelVerdictCard verdict={message.worldModelVerdict} />
      </div>
    )
  }
```

- [ ] **Step 4: Run card test**

Run:

```bash
npm run test -- __tests__/world-model-verdict-card.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/right/WorldModelVerdictCard.tsx components/right/ChatMessage.tsx __tests__/world-model-verdict-card.test.tsx
git commit -m "feat(world-model): render verdict cards"
```

---

## Task 7: Wire Verdict Fix Action In UI

**Files:**
- Modify: `components/right/WorldModelVerdictCard.tsx`
- Test: `__tests__/world-model-verdict-card.test.tsx`

- [ ] **Step 1: Add failing click test**

Append to `__tests__/world-model-verdict-card.test.tsx`:

```tsx
import { fireEvent, waitFor } from '@testing-library/react'
import { useProjectStore } from '@/lib/store'

test('dispatches apply-world-model-fix action when clicked', async () => {
  const message: ChatMessageType = {
    id: 'wm-message',
    type: 'world-model-verdict',
    content: '',
    timestamp: 1,
    worldModelVerdict: {
      id: 'wm-1',
      severity: 'critical',
      scenario: 'catastrophic',
      fixed: false,
      failureMode: 'moisture_ingress',
      title: 'World Model blocked this design',
      summary: 'Moisture ingress cascade at week 38.',
      rootCause: 'Seal degradation allowed moisture propagation.',
      affectedComponents: ['enclosure'],
      evidence: {
        peakDeviceRisk: 0.74,
        peakWeek: 38,
        peakComponentId: 'enclosure',
        peakComponentRisk: 0.68,
        dominantFailureHead: 'moisture_ingress_prob',
        dominantFailureProbability: 0.66,
        triggerAction: 'humidity_soak',
      },
      recommendedAction: {
        kind: 'dfma_fix',
        label: 'Apply weatherproofing resilience fix',
        dfmaWarningId: 'IP_INSUFFICIENT',
        explanation: 'Maps to weatherproofing.',
      },
    },
  }
  const events: string[] = []
  window.addEventListener('manu:chat-action', (event) => {
    events.push((event as CustomEvent<{ action: string }>).detail.action)
  })

  render(<ChatMessage message={message} />)
  fireEvent.click(screen.getByRole('button', { name: /Apply weatherproofing resilience fix/i }))

  await waitFor(() => expect(events).toContain('apply-world-model-fix'))
  useProjectStore.getState().reset()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm run test -- __tests__/world-model-verdict-card.test.tsx
```

Expected: FAIL because the button does not dispatch an event.

- [ ] **Step 3: Dispatch event**

In `WorldModelVerdictCard`, add:

```tsx
  function handleApply() {
    if (!canApply) return
    window.dispatchEvent(
      new CustomEvent('manu:chat-action', {
        detail: { action: 'apply-world-model-fix', verdict },
      })
    )
  }
```

Then add to button:

```tsx
onClick={handleApply}
```

- [ ] **Step 4: Run card tests**

Run:

```bash
npm run test -- __tests__/world-model-verdict-card.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/right/WorldModelVerdictCard.tsx __tests__/world-model-verdict-card.test.tsx
git commit -m "feat(world-model): dispatch verdict actions"
```

---

## Task 8: Wire Simulation Completion To Analysis

**Files:**
- Modify: `lib/world-model-simulation.ts`
- Test: `__tests__/world-model-simulation.test.ts`

- [ ] **Step 1: Write failing integration test**

Create `__tests__/world-model-simulation.test.ts`:

```ts
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { startWorldModelSimulation } from '@/lib/world-model-simulation'
import { useProjectStore } from '@/lib/store'

describe('startWorldModelSimulation analysis', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useProjectStore.getState().reset()
    useProjectStore.getState().setSceneComponents([
      {
        id: 'enclosure',
        label: 'Enclosure',
        position: [0, 0, 0],
        explodeOffset: [0, 0, 0],
        color: '#fff',
        geometry: 'box',
        scale: [1, 1, 1],
      },
    ])
    useProjectStore.getState().setPipelineState({ dfma: { warnings: [] } } as never)
  })

  test('adds a world model verdict message after final frame', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          scenario: 'catastrophic',
          objective: 'moisture_ingress',
          uses_planner: true,
          steps: [{
            timestep: 1,
            scenario: 'catastrophic',
            objective: 'moisture_ingress',
            moisture_ingress_prob: 0.7,
            thermal_runaway_prob: 0.01,
            seal_failure_prob: 0.5,
            bracket_failure_prob: 0.01,
            device_failure_prob: 0.74,
            active_stress_action: 'humidity_soak',
            enclosure_seal_integrity: 0.2,
            pcb_health: 0.9,
            battery_soc: 0.9,
            bracket_corrosion: 0.05,
            moisture_sensor_drift: 0.05,
            crack_sensor_drift: 0.05,
            tilt_sensor_drift: 0.05,
          }],
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'wm-1',
          severity: 'critical',
          title: 'World Model blocked this design',
          recommendedAction: { kind: 'none', label: 'None', explanation: 'None' },
          evidence: {},
        }),
      } as Response)

    startWorldModelSimulation('catastrophic')
    await vi.runAllTimersAsync()

    expect(useProjectStore.getState().messages.some((message) => message.type === 'world-model-verdict')).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm run test -- __tests__/world-model-simulation.test.ts
```

Expected: FAIL because no analyze call/verdict message exists.

- [ ] **Step 3: Implement analysis call**

Modify `lib/world-model-simulation.ts`:

```ts
import { analyzeWorldModelApi } from '@/lib/pipeline-stream'
import type { SimulationReport, WorldModelVerdict } from '@/lib/types'
```

Add helper:

```ts
async function analyzeCompletedReport(report: SimulationReport, runId: string, startedAt: number) {
  const store = useProjectStore.getState()
  const pipelineState = store.pipelineState
  if (!pipelineState) return

  const toolCallId = `${runId}-analysis`
  store.upsertToolCallMessage({
    id: toolCallId,
    server: 'world_model_backend',
    tool: 'POST /analyze',
    title: 'Analyze world-model failure mode',
    status: 'running',
    input: JSON.stringify({
      scenario: report.scenario,
      fixed: report.fixed,
      steps: report.steps.length,
    }, null, 2),
    startedAt,
  })

  try {
    const previousReports = Object.values(store.simulationReports).filter(Boolean)
    const verdict = (await analyzeWorldModelApi(pipelineState, report, previousReports)) as WorldModelVerdict
    useProjectStore.getState().upsertToolCallMessage({
      id: toolCallId,
      server: 'world_model_backend',
      tool: 'POST /analyze',
      title: 'Analyze world-model failure mode',
      status: 'completed',
      output: `${verdict.severity}: ${verdict.failureMode}`,
      startedAt,
      completedAt: Date.now(),
    })
    useProjectStore.getState().addMessage({
      id: `${runId}-verdict`,
      type: 'world-model-verdict',
      content: '',
      timestamp: Date.now(),
      worldModelVerdict: verdict,
    })
  } catch (error) {
    useProjectStore.getState().upsertToolCallMessage({
      id: toolCallId,
      server: 'world_model_backend',
      tool: 'POST /analyze',
      title: 'Analyze world-model failure mode',
      status: 'error',
      output: error instanceof Error ? error.message : 'Analysis failed',
      startedAt,
      completedAt: Date.now(),
    })
  }
}
```

In the `.then((body) => { ... })` block, create the report before `setSimulationReport`:

```ts
      const report: SimulationReport = {
        scenario: reportScenario,
        objective: body.objective,
        usesPlanner: body.uses_planner,
        fixed,
        generatedAt: Date.now(),
        steps: body.steps,
        risksByStep: body.steps.map(riskByComponent),
      }
      latestStore.setSimulationReport(report)
```

Replace the existing inline object passed to `setSimulationReport`.

After the final completion message, call:

```ts
          void analyzeCompletedReport(report, runId, startedAt)
```

- [ ] **Step 4: Run simulation test**

Run:

```bash
npm run test -- __tests__/world-model-simulation.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/world-model-simulation.ts __tests__/world-model-simulation.test.ts
git commit -m "feat(world-model): analyze completed simulations"
```

---

## Task 9: Handle Apply World Model Fix In Workspace

**Files:**
- Modify: `app/project/[id]/workspace/page.tsx`
- Modify: `lib/pipeline-stream.ts`
- Test: `__tests__/pipeline-stream-world-model.test.ts`

- [ ] **Step 1: Add helper already exists check**

No new test required if Task 5 covered `applyWorldModelFixApi`. This task wires the action into the workspace.

- [ ] **Step 2: Implement workspace action handler**

Modify imports in `app/project/[id]/workspace/page.tsx`:

```ts
import { applyWorldModelFixApi } from '@/lib/pipeline-stream'
import { hydrateStoreFromPipeline } from '@/lib/pipeline/hydrate-store'
import type { PipelineState } from '@/lib/pipeline/types'
import type { WorldModelVerdict } from '@/lib/types'
```

Inside `handleChatAction`, add:

```ts
      if (action === 'apply-world-model-fix') {
        const verdict = (event as CustomEvent<{ verdict?: WorldModelVerdict }>).detail?.verdict
        const pipelineState = useProjectStore.getState().pipelineState
        if (!verdict || !pipelineState) return
        useProjectStore.getState().upsertToolCallMessage({
          id: `world-model-fix-${verdict.id}`,
          server: 'world_model_backend',
          tool: 'POST /apply-fix',
          title: 'Apply world-model resilience fix',
          status: 'running',
          input: verdict.recommendedAction.label,
          startedAt: Date.now(),
        })
        applyWorldModelFixApi(pipelineState, verdict)
          .then((updated) => {
            hydrateStoreFromPipeline(updated as PipelineState)
            useProjectStore.getState().upsertToolCallMessage({
              id: `world-model-fix-${verdict.id}`,
              server: 'world_model_backend',
              tool: 'POST /apply-fix',
              title: 'Apply world-model resilience fix',
              status: 'completed',
              output: 'Pipeline re-resolved after world-model fix.',
              startedAt: Date.now(),
              completedAt: Date.now(),
            })
            useProjectStore.getState().addMessage({
              id: `world-model-rerun-${Date.now()}`,
              type: 'action-button',
              content: 'Resilience fix applied. Run the world-model simulation again to compare field risk.',
              timestamp: Date.now(),
              actionLabel: 'Run Simulation Again',
              actionCallback: 'run-simulation',
            })
          })
          .catch((error: Error) => {
            useProjectStore.getState().upsertToolCallMessage({
              id: `world-model-fix-${verdict.id}`,
              server: 'world_model_backend',
              tool: 'POST /apply-fix',
              title: 'Apply world-model resilience fix',
              status: 'error',
              output: error.message,
              startedAt: Date.now(),
              completedAt: Date.now(),
            })
          })
      }
```

During implementation, capture one `startedAt` constant before the upsert calls rather than calling `Date.now()` repeatedly.

- [ ] **Step 3: Run TypeScript build check**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/project/[id]/workspace/page.tsx
git commit -m "feat(world-model): apply verdict fixes from chat"
```

---

## Task 10: Update README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update README runtime flow**

Modify `README.md`:

- Add `/api/world-model/analyze` and `/api/world-model/apply-fix` to the API flow.
- Add `lib/world-model/agent.ts` and `components/right/WorldModelVerdictCard.tsx` to key files.
- Update expected demo flow to:
  1. Context Gate returns `ready`.
  2. Pipeline runs context/compliance/components/assembly/BOM/DfMA.
  3. DfMA emits `IP_INSUFFICIENT`.
  4. UI pauses at risk checkpoint.
  5. User applies DfMA fix.
  6. Supplier MCP and Scene MCP run.
  7. 3D scene appears.
  8. User runs World Model simulation.
  9. Reports tab captures telemetry.
  10. World Model Agent posts verdict card.
  11. User applies resilience fix if recommended.
  12. User reruns simulation to compare.

Add a section:

```md
## World Model Agent

The world model is not only an animation. After `/api/world-model/plan` returns rollout steps, the frontend stores a `SimulationReport`, animates the 3D node, and calls `/api/world-model/analyze`.

The analyzer is deterministic in v1. It reads peak device risk, failure heads, component risk and stress action, then returns a typed verdict:

- `pass`: no hardware change required.
- `warning`: field hardening recommended.
- `critical`: build should be blocked until resilience fix is applied.

DfMA warnings and World Model verdicts are intentionally separate:

- DfMA catches manufacturability risks before production.
- World Model catches simulated field failures over time.

Fixes are applied through the existing pipeline. If a verdict maps to an existing DfMA fix, the app reuses `applyPipelineFix`; otherwise it applies a structured component edit and regenerates BOM, sourcing, RFQ and scene.
```

- [ ] **Step 2: Run docs grep**

Run:

```bash
rg -n "World Model Agent|/api/world-model/analyze|WorldModelVerdictCard|lib/world-model/agent" README.md
```

Expected: all patterns are present.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: document world model agent flow"
```

---

## Task 11: Full Verification

**Files:**
- No code changes expected.

- [ ] **Step 1: Run focused tests**

Run:

```bash
npm run test -- __tests__/world-model-agent.test.ts __tests__/world-model-api.test.ts __tests__/pipeline-stream-world-model.test.ts __tests__/world-model-verdict-card.test.tsx __tests__/world-model-simulation.test.ts
```

Expected: all focused tests pass.

- [ ] **Step 2: Run full test suite**

Run:

```bash
npm run test
```

Expected: all tests pass.

- [ ] **Step 3: Run lint**

Run:

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 4: Run production build**

Run:

```bash
npm run build
```

Expected: production build succeeds and route list includes:

```text
/api/world-model/analyze
/api/world-model/apply-fix
/api/world-model/plan
```

- [ ] **Step 5: Inspect git status**

Run:

```bash
git status --short --branch
```

Expected: only unrelated `../.claude/` may remain untracked.

- [ ] **Step 6: Final commit if needed**

If verification required small fixes, commit them:

```bash
git add <changed-files>
git commit -m "fix(world-model): stabilize agent integration"
```

---

## Self-Review

- Spec coverage:
  - Deterministic world-model agent: Task 2.
  - Analyze API: Task 3.
  - Hybrid apply-fix: Task 4 and Task 9.
  - Chat verdict UI: Task 6 and Task 7.
  - Simulation completion wiring: Task 8.
  - README update: Task 10.
  - Verification: Task 11.
- Placeholder scan:
  - No `TBD`, `TODO`, or implementation placeholders remain.
  - Every code-producing step includes concrete code or exact edit instructions.
- Type consistency:
  - `WorldModelVerdict` is introduced before use.
  - `EditOp` type is reused from `lib/pipeline/edit-resolver.ts`.
  - Existing `SimulationReport` is reused from `lib/types.ts`.
  - Existing `applyPipelineFix` and `applyComponentEdit` are reused from `lib/pipeline/orchestrator.ts`.
