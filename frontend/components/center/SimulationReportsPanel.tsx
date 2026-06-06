'use client'
import { useMemo, useState } from 'react'
import { useProjectStore } from '@/lib/store'
import type { SimulationReport, SimulationScenario, SimulationStep } from '@/lib/types'
import { startWorldModelSimulation } from '@/lib/world-model-simulation'

const SCENARIOS: { id: SimulationScenario; label: string; color: string; description: string }[] = [
  { id: 'normal', label: 'Normal', color: '#22c55e', description: 'ordinary field baseline' },
  { id: 'stressed', label: 'Stressed', color: '#facc15', description: 'accelerated lab protocol' },
  { id: 'catastrophic', label: 'Catastrophic', color: '#ef4444', description: 'compound failure search' },
]

const FAILURE_HEADS: {
  key: keyof SimulationStep
  label: string
  color: string
}[] = [
  { key: 'moisture_ingress_prob', label: 'Moisture ingress', color: '#38bdf8' },
  { key: 'thermal_runaway_prob', label: 'Thermal runaway', color: '#fb923c' },
  { key: 'seal_failure_prob', label: 'Seal failure', color: '#a3e635' },
  { key: 'bracket_failure_prob', label: 'Bracket failure', color: '#c084fc' },
]

const COMPONENT_STATES: {
  key: keyof SimulationStep
  label: string
  invert?: boolean
  color: string
}[] = [
  { key: 'enclosure_seal_integrity', label: 'Seal integrity', invert: true, color: '#60a5fa' },
  { key: 'pcb_health', label: 'PCB health', invert: true, color: '#f59e0b' },
  { key: 'battery_soc', label: 'Battery SOC', invert: true, color: '#84cc16' },
  { key: 'bracket_corrosion', label: 'Bracket corrosion', color: '#94a3b8' },
  { key: 'moisture_sensor_drift', label: 'Moisture drift', color: '#2dd4bf' },
  { key: 'crack_sensor_drift', label: 'Crack drift', color: '#818cf8' },
  { key: 'tilt_sensor_drift', label: 'Tilt drift', color: '#f472b6' },
]

type Series = {
  label: string
  color: string
  values: number[]
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
}

function percent(value: number) {
  return `${Math.round(clamp01(value) * 100)}%`
}

function maxValue(values: number[]) {
  return values.reduce((max, value) => Math.max(max, value), 0)
}

function lastValue(values: number[]) {
  return values[values.length - 1] ?? 0
}

function linePoints(values: number[], width: number, height: number, maxY = 1) {
  if (values.length === 0) return ''
  const denom = Math.max(1, values.length - 1)
  return values
    .map((value, index) => {
      const x = (index / denom) * width
      const y = height - (clamp01(value / maxY) * height)
      return `${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')
}

function LineChart({
  title,
  subtitle,
  series,
  height = 190,
  maxY = 1,
}: {
  title: string
  subtitle?: string
  series: Series[]
  height?: number
  maxY?: number
}) {
  const width = 720

  return (
    <section className="rounded-lg border border-white/[0.07] bg-white/[0.03] p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-medium text-white/85">{title}</h3>
          {subtitle && <p className="mt-1 text-xs text-white/35">{subtitle}</p>}
        </div>
        <div className="flex flex-wrap justify-end gap-x-3 gap-y-1">
          {series.map((item) => (
            <div key={item.label} className="flex items-center gap-1.5 text-[10px] text-white/40">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: item.color }} />
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 overflow-hidden rounded-md border border-white/[0.05] bg-zinc-950/35">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-[190px] w-full">
          {[0.25, 0.5, 0.75].map((ratio) => (
            <line
              key={ratio}
              x1="0"
              x2={width}
              y1={height - ratio * height}
              y2={height - ratio * height}
              stroke="rgba(255,255,255,0.06)"
            />
          ))}
          {series.map((item) => (
            <polyline
              key={item.label}
              points={linePoints(item.values, width, height, maxY)}
              fill="none"
              stroke={item.color}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </svg>
      </div>
    </section>
  )
}

function ScenarioCards({ reports }: { reports: SimulationReport[] }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {SCENARIOS.map((scenario) => {
        const report = reports.find((item) => item.scenario === scenario.id)
        const deviceValues = report?.steps.map((step) => step.device_failure_prob) ?? []
        const peak = maxValue(deviceValues)
        const latest = lastValue(deviceValues)

        return (
          <button
            key={scenario.id}
            type="button"
            onClick={() => startWorldModelSimulation(scenario.id)}
            className="group rounded-lg border border-white/[0.07] bg-white/[0.035] p-4 text-left transition-colors hover:border-white/[0.14] hover:bg-white/[0.055] active:translate-y-px"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-white/85">{scenario.label}</span>
              <span className="h-2 w-2 rounded-full" style={{ background: scenario.color }} />
            </div>
            <p className="mt-1 text-xs text-white/35">{scenario.description}</p>
            <div className="mt-4 flex items-end justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-white/25">Peak device risk</p>
                <p className="mt-1 font-mono text-2xl text-white/90">{report ? percent(peak) : '--'}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-widest text-white/25">Latest</p>
                <p className="mt-1 font-mono text-sm text-white/55">{report ? percent(latest) : 'not run'}</p>
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

function FailureHeads({ report }: { report: SimulationReport }) {
  return (
    <LineChart
      title={`${labelForScenario(report.scenario)} failure heads`}
      subtitle="The four probability heads directly predicted by the world model."
      series={FAILURE_HEADS.map((head) => ({
        label: head.label,
        color: head.color,
        values: report.steps.map((step) => Number(step[head.key] ?? 0)),
      }))}
    />
  )
}

function ComponentStates({ report }: { report: SimulationReport }) {
  return (
    <LineChart
      title={`${labelForScenario(report.scenario)} component state variables`}
      subtitle="Healthy variables are plotted as degradation risk: 1 - health/integrity/SOC."
      series={COMPONENT_STATES.map((state) => ({
        label: state.label,
        color: state.color,
        values: report.steps.map((step) => {
          const value = Number(step[state.key] ?? 0)
          return state.invert ? 1 - value : value
        }),
      }))}
    />
  )
}

function ComponentRiskGrid({ report }: { report: SimulationReport }) {
  const componentIds = Object.keys(report.risksByStep[0] ?? {})
  const rows = componentIds
    .map((id) => {
      const values = report.risksByStep.map((step) => step[id] ?? 0)
      return { id, values, peak: maxValue(values), latest: lastValue(values) }
    })
    .sort((a, b) => b.peak - a.peak)

  return (
    <section className="rounded-lg border border-white/[0.07] bg-white/[0.03] p-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-medium text-white/85">Trained component risk</h3>
          <p className="mt-1 text-xs text-white/35">Only components represented in the world-model state space are shown.</p>
        </div>
        <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-1 text-[10px] text-white/35">
          {rows.length} components
        </span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {rows.map((row) => (
          <div key={row.id} className="rounded-md border border-white/[0.06] bg-zinc-950/30 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-xs font-medium text-white/70">{labelForComponent(row.id)}</p>
              <p className="font-mono text-xs text-white/45">{percent(row.latest)}</p>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-yellow-300 to-red-500"
                style={{ width: `${Math.round(row.peak * 100)}%` }}
              />
            </div>
            <p className="mt-1 text-[10px] text-white/25">peak {percent(row.peak)}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function StressTimeline({ report }: { report: SimulationReport }) {
  const actions = Array.from(new Set(report.steps.map((step) => step.active_stress_action)))
  const colorForAction = (action: string) => {
    if (action === 'none') return '#334155'
    if (action === 'humidity_soak') return '#38bdf8'
    if (action === 'vibration_burst') return '#a78bfa'
    if (action === 'UV_exposure') return '#facc15'
    if (action === 'heat_cycle') return '#fb923c'
    if (action === 'typhoon_load') return '#ef4444'
    return '#94a3b8'
  }

  return (
    <section className="rounded-lg border border-white/[0.07] bg-white/[0.03] p-4">
      <h3 className="text-sm font-medium text-white/85">Stress action timeline</h3>
      <p className="mt-1 text-xs text-white/35">Shows what the model was exposed to at each rollout step.</p>
      <div className="mt-4 flex h-8 overflow-hidden rounded-md border border-white/[0.06] bg-zinc-950/35">
        {report.steps.map((step) => (
          <div
            key={`${step.timestep}-${step.active_stress_action}`}
            className="h-full flex-1"
            title={`Week ${step.timestep}: ${step.active_stress_action}`}
            style={{ background: colorForAction(step.active_stress_action) }}
          />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-3">
        {actions.map((action) => (
          <div key={action} className="flex items-center gap-1.5 text-[10px] text-white/40">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: colorForAction(action) }} />
            <span>{action.replace(/_/g, ' ')}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

function labelForScenario(scenario: SimulationScenario) {
  return SCENARIOS.find((item) => item.id === scenario)?.label ?? scenario
}

function labelForComponent(id: string) {
  return id
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

export function SimulationReportsPanel() {
  const reportsByScenario = useProjectStore((s) => s.simulationReports)
  const simulation = useProjectStore((s) => s.simulation)
  const reports = useMemo(
    () => SCENARIOS.map((scenario) => reportsByScenario[scenario.id]).filter((item): item is SimulationReport => Boolean(item)),
    [reportsByScenario]
  )
  const [selectedScenario, setSelectedScenario] = useState<SimulationScenario>('catastrophic')
  const selectedReport =
    reportsByScenario[selectedScenario] ?? reports[reports.length - 1] ?? null
  const deviceSeries = SCENARIOS
    .map((scenario) => {
      const report = reportsByScenario[scenario.id]
      if (!report) return null
      return {
        label: scenario.label,
        color: scenario.color,
        values: report.steps.map((step) => step.device_failure_prob),
      }
    })
    .filter((item): item is Series => Boolean(item))
  const isBusy = simulation.status === 'connecting' || simulation.status === 'running'

  return (
    <div className="h-full overflow-y-auto bg-zinc-950/40 px-5 py-5">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-white/30">World-model reports</p>
            <h2 className="mt-1 text-xl font-medium tracking-tight text-white/90">Failure probability trends</h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-white/40">
              These plots use the rollout frames returned by the backend model. Run each scenario to compare normal,
              stressed and catastrophic behavior side by side.
            </p>
          </div>
          <div className="flex gap-2">
            {SCENARIOS.map((scenario) => (
              <button
                key={scenario.id}
                type="button"
                disabled={isBusy}
                onClick={() => {
                  setSelectedScenario(scenario.id)
                  startWorldModelSimulation(scenario.id)
                }}
                className="rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs text-white/55 transition-colors hover:bg-white/[0.07] hover:text-white/80 active:translate-y-px disabled:cursor-wait disabled:opacity-50"
              >
                Run {scenario.label}
              </button>
            ))}
          </div>
        </div>

        <ScenarioCards reports={reports} />

        {reports.length === 0 ? (
          <section className="rounded-lg border border-dashed border-white/[0.10] bg-white/[0.025] px-5 py-10 text-center">
            <p className="text-sm font-medium text-white/75">No simulation report yet</p>
            <p className="mx-auto mt-2 max-w-lg text-sm text-white/35">
              Run a scenario from the buttons above or from the 3D simulation panel. The report tab will fill with
              device failure curves, component probabilities and stress timelines.
            </p>
          </section>
        ) : (
          <>
            {deviceSeries.length > 0 && (
              <LineChart
                title="Device failure probability"
                subtitle="Main comparison across all scenarios already run."
                series={deviceSeries}
              />
            )}

            <div className="flex items-center gap-2">
              {SCENARIOS.map((scenario) => {
                const hasReport = Boolean(reportsByScenario[scenario.id])
                return (
                  <button
                    key={scenario.id}
                    type="button"
                    disabled={!hasReport}
                    onClick={() => setSelectedScenario(scenario.id)}
                    className={`rounded-full border px-3 py-1.5 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
                      selectedReport?.scenario === scenario.id
                        ? 'border-white/[0.16] bg-white/[0.09] text-white/85'
                        : 'border-white/[0.07] bg-white/[0.03] text-white/40 hover:text-white/65'
                    }`}
                  >
                    {scenario.label}
                  </button>
                )
              })}
            </div>

            {selectedReport && (
              <div className="grid grid-cols-1 gap-4 pb-6">
                <FailureHeads report={selectedReport} />
                <ComponentRiskGrid report={selectedReport} />
                <ComponentStates report={selectedReport} />
                <StressTimeline report={selectedReport} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
