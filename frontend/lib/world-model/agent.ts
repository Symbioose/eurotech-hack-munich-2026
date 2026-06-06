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

type FailureHead = NonNullable<WorldModelEvidence['dominantFailureHead']>
type ActionableFailureMode = Exclude<WorldModelFailureMode, 'none' | 'unknown'>
type SignalKind = 'device' | 'component' | 'failure'

type PeakSignal = {
  kind: SignalKind
  value: number
  step?: SimulationStep
  componentId?: string | null
  failureHead?: FailureHead | null
}

type ReportEvidence = {
  evidence: WorldModelEvidence
  strongestSignal: PeakSignal | null
  devicePeakStep?: SimulationStep
}

const THRESHOLDS = {
  passDeviceRisk: 0.2,
  passComponentRisk: 0.35,
  passFailureHead: 0.25,
  criticalDeviceRisk: 0.5,
  criticalFailureHead: 0.45,
  criticalComponentRisk: 0.6,
} as const

const FAILURE_HEADS = [
  'moisture_ingress_prob',
  'thermal_runaway_prob',
  'seal_failure_prob',
  'bracket_failure_prob',
] as const satisfies readonly FailureHead[]

const FAILURE_MODES = [
  'moisture_ingress',
  'thermal_stress',
  'bracket_fatigue',
  'sensor_drift',
] as const satisfies readonly ActionableFailureMode[]

function clamp01(value: number | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}

function formatPercent(value: number) {
  return `${Math.round(clamp01(value) * 100)}%`
}

function peakComponentAcrossReport(
  report: SimulationReport,
  steps: SimulationStep[]
): Pick<WorldModelEvidence, 'peakComponentId' | 'peakComponentRisk'> & { step?: SimulationStep } {
  let peakComponentId: string | null = null
  let peakComponentRisk = 0
  let peakComponentStep: SimulationStep | undefined

  for (const [index, risks] of Object.entries(report.risksByStep ?? {})) {
    for (const [componentId, rawRisk] of Object.entries(risks ?? {})) {
      const risk = clamp01(rawRisk)
      if (risk > peakComponentRisk) {
        peakComponentId = componentId
        peakComponentRisk = risk
        peakComponentStep = steps[Number(index)]
      }
    }
  }

  return { peakComponentId, peakComponentRisk, step: peakComponentStep }
}

function dominantFailureHeadAcrossSteps(
  steps: SimulationStep[]
): Pick<WorldModelEvidence, 'dominantFailureHead' | 'dominantFailureProbability'> & { step?: SimulationStep } {
  let dominantFailureHead: WorldModelEvidence['dominantFailureHead'] = null
  let dominantFailureProbability = 0
  let dominantFailureStep: SimulationStep | undefined

  for (const step of steps) {
    for (const head of FAILURE_HEADS) {
      const probability = clamp01(step[head])
      if (probability > dominantFailureProbability) {
        dominantFailureHead = head
        dominantFailureProbability = probability
        dominantFailureStep = step
      }
    }
  }

  return {
    dominantFailureHead,
    dominantFailureProbability,
    step: dominantFailureStep,
  }
}

function strongestSignal(signals: PeakSignal[]): PeakSignal | null {
  return signals.reduce<PeakSignal | null>(
    (strongest, signal) => !strongest || signal.value > strongest.value ? signal : strongest,
    null
  )
}

function evidenceFromReport(report: SimulationReport): ReportEvidence {
  const steps = Array.isArray(report.steps) ? report.steps : []
  let peakStep: SimulationStep | undefined
  let peakDeviceRisk = 0

  for (const step of steps) {
    const risk = clamp01(step.device_failure_prob)
    if (!peakStep || risk > peakDeviceRisk) {
      peakStep = step
      peakDeviceRisk = risk
    }
  }

  const component = peakComponentAcrossReport(report, steps)
  const failure = dominantFailureHeadAcrossSteps(steps)
  const strongest = strongestSignal([
    { kind: 'device', value: peakDeviceRisk, step: peakStep },
    {
      kind: 'component',
      value: component.peakComponentRisk,
      step: component.step,
      componentId: component.peakComponentId,
    },
    {
      kind: 'failure',
      value: failure.dominantFailureProbability,
      step: failure.step,
      failureHead: failure.dominantFailureHead,
    },
  ])

  return {
    evidence: {
      peakDeviceRisk,
      peakWeek: peakStep?.timestep ?? 0,
      peakComponentId: component.peakComponentId,
      peakComponentRisk: component.peakComponentRisk,
      dominantFailureHead: failure.dominantFailureHead,
      dominantFailureProbability: failure.dominantFailureProbability,
      triggerAction: strongest?.step?.active_stress_action ?? 'none',
    },
    strongestSignal: strongest,
    devicePeakStep: peakStep,
  }
}

function severityFromEvidence(evidence: WorldModelEvidence): WorldModelSeverity {
  if (
    evidence.peakDeviceRisk >= THRESHOLDS.criticalDeviceRisk ||
    evidence.peakComponentRisk >= THRESHOLDS.criticalComponentRisk ||
    evidence.dominantFailureProbability >= THRESHOLDS.criticalFailureHead
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

function scoreFailureModes(step: SimulationStep | undefined): Record<ActionableFailureMode, number> {
  if (!step) {
    return {
      moisture_ingress: 0,
      thermal_stress: 0,
      bracket_fatigue: 0,
      sensor_drift: 0,
    }
  }

  return {
    moisture_ingress: Math.max(
      clamp01(step.moisture_ingress_prob),
      clamp01(step.seal_failure_prob),
      clamp01(1 - step.enclosure_seal_integrity)
    ),
    thermal_stress: Math.max(
      clamp01(step.thermal_runaway_prob),
      clamp01(1 - step.battery_soc)
    ),
    bracket_fatigue: Math.max(
      clamp01(step.bracket_failure_prob),
      clamp01(step.bracket_corrosion)
    ),
    sensor_drift: Math.max(
      clamp01(step.moisture_sensor_drift),
      clamp01(step.crack_sensor_drift),
      clamp01(step.tilt_sensor_drift)
    ),
  }
}

function modeFromScores(scores: Record<ActionableFailureMode, number>): ActionableFailureMode {
  let bestMode: ActionableFailureMode = 'moisture_ingress'

  for (const mode of FAILURE_MODES) {
    if (scores[mode] > scores[bestMode]) {
      bestMode = mode
    }
  }

  return bestMode
}

function modeFromFailureHead(head: FailureHead | null | undefined): ActionableFailureMode | null {
  if (head === 'moisture_ingress_prob' || head === 'seal_failure_prob') return 'moisture_ingress'
  if (head === 'thermal_runaway_prob') return 'thermal_stress'
  if (head === 'bracket_failure_prob') return 'bracket_fatigue'
  return null
}

function modeFromComponentId(componentId: string | null | undefined): ActionableFailureMode | null {
  const id = componentId?.toLowerCase() ?? ''
  if (!id) return null
  if (id.includes('battery') || id.includes('thermal') || id.includes('heat')) return 'thermal_stress'
  if (id.includes('bracket') || id.includes('mount') || id.includes('fastener')) return 'bracket_fatigue'
  if (id.includes('sensor') || id.includes('calibration')) return 'sensor_drift'
  if (id.includes('enclosure') || id.includes('seal') || id.includes('gasket')) return 'moisture_ingress'
  return null
}

function failureModeFromReport(
  report: SimulationReport,
  analysis: ReportEvidence,
  severity: WorldModelSeverity
): WorldModelFailureMode {
  const steps = Array.isArray(report.steps) ? report.steps : []
  if (steps.length === 0) return 'unknown'
  if (severity === 'pass') return 'none'

  const signal = analysis.strongestSignal
  if (signal?.kind === 'failure') {
    const mode = modeFromFailureHead(signal.failureHead)
    if (mode) return mode
  }

  if (signal?.kind === 'component') {
    const mode = modeFromComponentId(signal.componentId)
    if (mode) return mode
  }

  const relevantStep = signal?.step ?? analysis.devicePeakStep ?? steps[0]
  const scores = scoreFailureModes(relevantStep)

  return modeFromScores(scores)
}

function hasDfmaWarning(state: PipelineState, warningId: string) {
  return state.dfma.warnings.some((warning) => warning.id === warningId)
}

function componentEditAction(
  label: string,
  part: string,
  category: string,
  estimatedCostUsd: number,
  explanation: string
): WorldModelRecommendedAction {
  return {
    kind: 'component_edit',
    label,
    explanation,
    editOps: [{
      op: 'add',
      component: {
        part,
        category,
        estimated_cost_usd: estimatedCostUsd,
      },
    }],
  }
}

function recommendedAction(
  failureMode: WorldModelFailureMode,
  severity: WorldModelSeverity,
  state: PipelineState
): WorldModelRecommendedAction {
  if (severity === 'pass' || failureMode === 'none' || failureMode === 'unknown') {
    return {
      kind: 'none',
      label: 'No hardware change required',
      explanation: 'The simulated rollout stayed below the intervention thresholds.',
    }
  }

  if (failureMode === 'moisture_ingress' && hasDfmaWarning(state, 'IP_INSUFFICIENT')) {
    return {
      kind: 'dfma_fix',
      label: 'Apply weatherproofing fix',
      dfmaWarningId: 'IP_INSUFFICIENT',
      explanation: 'The failure signature maps to the existing enclosure weatherproofing warning.',
    }
  }

  if (failureMode === 'thermal_stress') {
    return componentEditAction(
      'Add thermal isolation',
      'Thermal isolation pad and heat spreader',
      'thermal',
      5,
      'Reduce heat transfer into the electronics and spread localized thermal load.'
    )
  }

  if (failureMode === 'bracket_fatigue') {
    return componentEditAction(
      'Add fatigue-resistant mount',
      'Vibration-isolating 316L bracket kit',
      'mechanical',
      8,
      'Reduce vibration transfer and corrosion-driven mounting fatigue.'
    )
  }

  if (failureMode === 'sensor_drift') {
    return componentEditAction(
      'Add calibration reference',
      'Environmental calibration reference',
      'sensor',
      6,
      'Add a stable reference so field drift can be detected and compensated.'
    )
  }

  return componentEditAction(
    'Harden enclosure',
    'Weatherproof enclosure hardening kit',
    'enclosure',
    7,
    'Add enclosure resilience hardening because no matching DfMA fix is available.'
  )
}

function copyFor(
  failureMode: WorldModelFailureMode,
  severity: WorldModelSeverity,
  evidence: WorldModelEvidence
) {
  if (severity === 'pass') {
    return {
      title: 'World Model passed this design',
      summary: `Peak device risk stayed at ${formatPercent(evidence.peakDeviceRisk)}.`,
      rootCause: 'The simulated field rollout stayed below intervention thresholds.',
    }
  }

  const failureLabels: Record<WorldModelFailureMode, string> = {
    none: 'No dominant failure mode',
    moisture_ingress: 'Moisture ingress cascade',
    thermal_stress: 'Thermal stress',
    bracket_fatigue: 'Bracket fatigue',
    sensor_drift: 'Sensor drift',
    unknown: 'Unknown failure mode',
  }

  const rootCauses: Record<WorldModelFailureMode, string> = {
    none: 'No single field degradation path crossed the analysis threshold.',
    moisture_ingress: 'Seal degradation allows moisture risk to propagate into protected electronics.',
    thermal_stress: 'Thermal or battery stress rises beyond the resilience threshold.',
    bracket_fatigue: 'Corrosion or vibration-driven fatigue accumulates in the mounting path.',
    sensor_drift: 'Sensor drift threatens field measurement reliability.',
    unknown: 'The rollout produced a risk signature that needs engineering review.',
  }

  return {
    title: severity === 'critical' ? 'World Model blocked this design' : 'World Model found field risk',
    summary: `${failureLabels[failureMode]} at week ${evidence.peakWeek}.`,
    rootCause: rootCauses[failureMode],
  }
}

function affectedComponents(evidence: WorldModelEvidence): string[] {
  return evidence.peakComponentId ? [evidence.peakComponentId] : []
}

export function analyzeWorldModelReport(input: AnalyzeInput): WorldModelVerdict {
  const { pipelineState, report } = input
  const analysis = evidenceFromReport(report)
  const evidence = analysis.evidence
  const severity = severityFromEvidence(evidence)
  const failureMode = failureModeFromReport(report, analysis, severity)
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
    affectedComponents: affectedComponents(evidence),
    evidence,
    recommendedAction: recommendedAction(failureMode, severity, pipelineState),
  }
}
