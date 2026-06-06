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
    expect(verdict.severity).toBe('critical')
    expect(verdict.title).toBe('World Model blocked this design')
    expect(verdict.scenario).toBe('catastrophic')
    expect(verdict.evidence.dominantFailureHead).toBe('moisture_ingress_prob')
    expect(verdict.evidence.peakDeviceRisk).toBe(0.74)

    if (verdict.recommendedAction.kind !== 'dfma_fix') {
      throw new Error('Expected a DfMA fix recommendation')
    }

    expect(verdict.recommendedAction.label).toBe('Apply weatherproofing resilience fix')
    expect(verdict.recommendedAction.dfmaWarningId).toBe('IP_INSUFFICIENT')
  })
})
