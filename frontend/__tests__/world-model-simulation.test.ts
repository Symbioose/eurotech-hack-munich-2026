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
          scenario: 'catastrophic',
          fixed: false,
          failureMode: 'moisture_ingress',
          title: 'World Model blocked this design',
          summary: 'Moisture ingress cascade at week 1.',
          rootCause: 'Seal degradation allowed moisture propagation.',
          affectedComponents: ['enclosure'],
          evidence: {
            peakDeviceRisk: 0.74,
            peakWeek: 1,
            peakComponentId: 'enclosure',
            peakComponentRisk: 0.7,
            dominantFailureHead: 'moisture_ingress_prob',
            dominantFailureProbability: 0.7,
            triggerAction: 'humidity_soak',
          },
          recommendedAction: { kind: 'none', label: 'None', explanation: 'None' },
        }),
      } as Response)

    startWorldModelSimulation('catastrophic')
    await vi.runAllTimersAsync()

    expect(useProjectStore.getState().messages.some((message) => message.type === 'world-model-verdict')).toBe(true)
    vi.useRealTimers()
  })
})
