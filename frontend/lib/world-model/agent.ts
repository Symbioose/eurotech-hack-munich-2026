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

function clamp01(value: number | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}

function formatPercent(value: number) {
  return `${Math.round(clamp01(value) * 100)}%`
}

function peakComponent(risks: Record<string, number> | undefined): Pick<
  WorldModelEvidence,
  'peakComponentId' | 'peakComponentRisk'
> {
  let peakComponentId: string | null = null
  let peakComponentRisk = 0

  for (const [componentId, rawRisk] of Object.entries(risks ?? {})) {
    const risk = clamp01(rawRisk)
    if (risk > peakComponentRisk) {
      peakComponentId = componentId
      peakComponentRisk = risk
    }
  }

  return { peakComponentId, peakComponentRisk }
}

function dominantFailureHead(step: SimulationStep | undefined): Pick<
  WorldModelEvidence,
  'dominantFailureHead' | 'dominantFailureProbability'
> {
  let dominantFailureHead: WorldModelEvidence['dominantFailureHead'] = null
  let dominantFailureProbability = 0

  for (const head of FAILURE_HEADS) {
    const probability = clamp01(step?.[head])
    if (probability > dominantFailureProbability) {
      dominantFailureHead = head
      dominantFailureProbability = probability
    }
  }

  return { dominantFailureHead, dominantFailureProbability }
}

function evidenceFromReport(report: SimulationReport): WorldModelEvidence {
  const steps = Array.isArray(report.steps) ? report.steps : []
  let peakStep: SimulationStep | undefined
  let peakIndex = -1
  let peakDeviceRisk = 0

  steps.forEach((step, index) => {
    const risk = clamp01(step.device_failure_prob)
    if (!peakStep || risk > peakDeviceRisk) {
      peakStep = step
      peakIndex = index
      peakDeviceRisk = risk
    }
  })

  const component = peakComponent(report.risksByStep?.[peakIndex])
  const failure = dominantFailureHead(peakStep)

  return {
    peakDeviceRisk,
    peakWeek: peakStep?.timestep ?? 0,
    ...component,
    ...failure,
    triggerAction: peakStep?.active_stress_action ?? 'none',
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

function scoreFailureModes(step: SimulationStep | undefined): Record<Exclude<WorldModelFailureMode, 'none' | 'unknown'>, number> {
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

function failureModeFromReport(
  report: SimulationReport,
  evidence: WorldModelEvidence,
  severity: WorldModelSeverity
): WorldModelFailureMode {
  const steps = Array.isArray(report.steps) ? report.steps : []
  if (steps.length === 0) return 'unknown'
  if (severity === 'pass') return 'none'

  const peakStep = steps.find((step) => step.timestep === evidence.peakWeek) ?? steps[0]
  const scores = scoreFailureModes(peakStep)
  const [mode] = Object.entries(scores).reduce(
    (best, current) => current[1] > best[1] ? current : best,
    ['moisture_ingress', scores.moisture_ingress] as [Exclude<WorldModelFailureMode, 'none' | 'unknown'>, number]
  )

  return mode
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
  const evidence = evidenceFromReport(report)
  const severity = severityFromEvidence(evidence)
  const failureMode = failureModeFromReport(report, evidence, severity)
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
