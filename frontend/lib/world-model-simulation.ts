import { useProjectStore } from '@/lib/store'
import type { SimulationScenario, SimulationStep } from '@/lib/types'

type PlanResponse = {
  error?: string
  scenario: string
  objective: string
  uses_planner: boolean
  steps: SimulationStep[]
}

let activeRun: { cancelled: boolean } | null = null
let runCounter = 0

export const TRAINED_WORLD_MODEL_COMPONENT_IDS = new Set([
  'enclosure',
  'compute',
  'radio',
  'battery',
  'bracket',
  'moisture-sensor',
  'crack-sensor',
  'vibration-sensor',
  'tilt-sensor',
])

function normalizeScenario(value: string | undefined, fallback: SimulationScenario): SimulationScenario {
  if (value === 'normal' || value === 'stressed' || value === 'catastrophic') return value
  return fallback
}

function clamp01(value: number | undefined) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value ?? 0))
}

function zeroRiskByComponent() {
  const components = useProjectStore.getState().sceneComponents
  return Object.fromEntries(
    components
      .filter((component) => TRAINED_WORLD_MODEL_COMPONENT_IDS.has(component.id))
      .map((component) => [component.id, 0])
  )
}

export function riskByComponent(step: SimulationStep) {
  const moisture = clamp01(step.moisture_ingress_prob)
  const thermal = clamp01(step.thermal_runaway_prob)
  const seal = clamp01(step.seal_failure_prob)
  const bracket = clamp01(step.bracket_failure_prob)
  const sealDegradation = clamp01(1 - step.enclosure_seal_integrity)
  const pcbDegradation = clamp01(1 - step.pcb_health)
  const batteryDegradation = clamp01(1 - step.battery_soc)
  const bracketCorrosion = clamp01(step.bracket_corrosion)
  const moistureDrift = clamp01(step.moisture_sensor_drift)
  const crackDrift = clamp01(step.crack_sensor_drift)
  const tiltDrift = clamp01(step.tilt_sensor_drift)

  return {
    enclosure: Math.max(seal, moisture, sealDegradation),
    compute: Math.max(pcbDegradation, moisture, thermal),
    radio: Math.max(pcbDegradation, moisture * 0.85, thermal),
    battery: Math.max(batteryDegradation, thermal),
    bracket: Math.max(bracket, bracketCorrosion),
    'moisture-sensor': Math.max(moistureDrift, moisture),
    'crack-sensor': Math.max(crackDrift, bracket * 0.35),
    'vibration-sensor': Math.max(crackDrift, bracket * 0.35),
    'tilt-sensor': tiltDrift,
  }
}

function describePeakRisk(risks: Record<string, number>) {
  const [componentId, risk] = Object.entries(risks).sort((a, b) => b[1] - a[1])[0] ?? ['device', 0]
  return `${componentId}: ${(risk * 100).toFixed(0)}%`
}

export function startWorldModelSimulation(scenarioOverride?: SimulationScenario) {
  const store = useProjectStore.getState()
  const runId = `world-model-${++runCounter}-${Date.now()}`
  const startedAt = Date.now()
  const fixed = store.fixApplied
  const scenario = scenarioOverride ?? store.simulation.scenario
  const horizon = 60

  if (activeRun) activeRun.cancelled = true
  const run = { cancelled: false }
  activeRun = run

  store.setSimulation({
    status: 'connecting',
    scenario,
    currentStep: 0,
    totalSteps: horizon,
    activeStressAction: 'none',
    deviceFailureProb: 0,
    risksByComponent: zeroRiskByComponent(),
    error: null,
  })
  store.addMessage({
    id: `${runId}-start`,
    type: 'ai',
    content: 'Starting the world-model rollout. The 3D node is reset to green, then recolored as failure risk evolves.',
    timestamp: Date.now(),
  })
  store.upsertToolCallMessage({
    id: runId,
    server: 'world_model_backend',
    tool: 'POST /plan',
    title: 'Run world-model stress test',
    status: 'running',
    input: JSON.stringify({ scenario, horizon, fixed }, null, 2),
    startedAt,
  })

  let peakDeviceFailure = 0
  let lastRisks: Record<string, number> = zeroRiskByComponent()

  fetch('/api/world-model/plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      scenario,
      horizon,
      fixed,
      n_samples: 180,
      n_elites: 18,
      n_iterations: 5,
    }),
  })
    .then(async (res) => {
      const body = (await res.json()) as PlanResponse
      if (!res.ok || body.error) throw new Error(body.error ?? 'World-model request failed')
      return body
    })
    .then((body) => {
      if (run.cancelled) return
      const latestStore = useProjectStore.getState()
      const reportScenario = normalizeScenario(body.scenario, scenario)
      latestStore.setSimulationReport({
        scenario: reportScenario,
        objective: body.objective,
        usesPlanner: body.uses_planner,
        fixed,
        generatedAt: Date.now(),
        steps: body.steps,
        risksByStep: body.steps.map(riskByComponent),
      })
      latestStore.setSimulation({
        status: 'running',
        scenario: reportScenario,
        totalSteps: body.steps.length,
      })

      body.steps.forEach((frame, index) => {
        window.setTimeout(() => {
          if (run.cancelled || activeRun !== run) return
          const frameStore = useProjectStore.getState()
          lastRisks = riskByComponent(frame)
          peakDeviceFailure = Math.max(peakDeviceFailure, clamp01(frame.device_failure_prob))
          frameStore.setSimulation({
            status: 'running',
            scenario: normalizeScenario(frame.scenario, scenario),
            currentStep: frame.timestep,
            activeStressAction: frame.active_stress_action,
            deviceFailureProb: clamp01(frame.device_failure_prob),
            risksByComponent: lastRisks,
          })

          if (index !== body.steps.length - 1) return

          frameStore.setSimulation({
            status: 'complete',
            scenario: normalizeScenario(body.scenario, scenario),
            totalSteps: body.steps.length,
          })
          frameStore.upsertToolCallMessage({
            id: runId,
            server: 'world_model_backend',
            tool: 'POST /plan',
            title: 'Run world-model stress test',
            status: 'completed',
            output: [
              `scenario: ${body.scenario}`,
              `objective: ${body.objective}`,
              `steps: ${body.steps.length}`,
              `peak device failure: ${(peakDeviceFailure * 100).toFixed(0)}%`,
              `riskiest part: ${describePeakRisk(lastRisks)}`,
            ].join('\n'),
            startedAt,
            completedAt: Date.now(),
          })
          frameStore.addMessage({
            id: `${runId}-complete`,
            type: 'ai',
            content: `Simulation complete. Peak device failure reached ${(peakDeviceFailure * 100).toFixed(0)}%; riskiest part was ${describePeakRisk(lastRisks)}.`,
            timestamp: Date.now(),
          })
          activeRun = null
        }, index * 80)
      })
    })
    .catch((error: Error) => {
      if (run.cancelled || activeRun !== run) return
      const latestStore = useProjectStore.getState()
      latestStore.setSimulation({ status: 'error', error: error.message })
      latestStore.upsertToolCallMessage({
        id: runId,
        server: 'world_model_backend',
        tool: 'POST /plan',
        title: 'Run world-model stress test',
        status: 'error',
        output: error.message,
        startedAt,
        completedAt: Date.now(),
      })
      latestStore.addMessage({
        id: `${runId}-error`,
        type: 'ai',
        content: `World-model simulation failed: ${error.message}`,
        timestamp: Date.now(),
      })
      activeRun = null
    })
}
