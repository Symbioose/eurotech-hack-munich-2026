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
      regulation: null,
      goal: 'monitor moisture ingress',
      environment: ['humid', 'rain'],
      climate: { humidity: 'high', rainfall: 'heavy', wind: 'typhoon' },
      mounting: [],
      power: [],
      connectivity: [],
      privacy: [],
    },
    compliance: { requirements: [] },
    componentGraph: { node_type: 'sensor_node', selected_component_ids: ['enclosure', 'compute'] },
    assembly: {
      pattern_id: 'test',
      label: 'test',
      required_component_ids: [],
      recommended_component_ids: [],
      missing_required_component_ids: [],
      constraints: [],
      assembly_steps: [],
    },
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
