'use client'
import { useMemo, useState } from 'react'
import { useProjectStore } from '@/lib/store'
import type { SimulationScenario } from '@/lib/types'
import { startWorldModelSimulation } from '@/lib/world-model-simulation'

const SCENARIOS: {
  value: SimulationScenario
  label: string
  shortLabel: string
  description: string
}[] = [
  {
    value: 'normal',
    label: 'Normal',
    shortLabel: 'Normal',
    description: 'field baseline',
  },
  {
    value: 'stressed',
    label: 'Stressed',
    shortLabel: 'Stress',
    description: 'accelerated lab',
  },
  {
    value: 'catastrophic',
    label: 'Catastrophic',
    shortLabel: 'Critical',
    description: 'compound planner',
  },
]

function formatAction(action: string) {
  return action.replace(/_/g, ' ')
}

function percent(value: number) {
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`
}

export function SimulationOverlay() {
  const simulation = useProjectStore((s) => s.simulation)
  const sceneComponents = useProjectStore((s) => s.sceneComponents)
  const [isExpanded, setIsExpanded] = useState(false)

  const peakComponent = useMemo(() => {
    return Object.entries(simulation.risksByComponent)
      .sort((a, b) => b[1] - a[1])[0] ?? null
  }, [simulation.risksByComponent])
  const componentLabels = useMemo(() => {
    return new Map(sceneComponents.map((component) => [component.id, component.label]))
  }, [sceneComponents])

  const progress = simulation.totalSteps > 0
    ? Math.min(100, (simulation.currentStep / simulation.totalSteps) * 100)
    : 0
  const statusLabel = simulation.status === 'complete'
    ? 'complete'
    : simulation.status === 'error'
      ? 'failed'
      : simulation.status === 'connecting'
        ? 'connecting'
        : simulation.status === 'running'
          ? 'rolling out'
          : 'ready'
  const isBusy = simulation.status === 'connecting' || simulation.status === 'running'
  const activeScenario = SCENARIOS.find((scenario) => scenario.value === simulation.scenario)

  return (
    <div className={`absolute left-4 top-4 z-10 rounded-lg border border-white/[0.08] bg-zinc-950/75 px-3 py-3 shadow-[0_18px_45px_rgba(0,0,0,0.24)] backdrop-blur-md transition-[width] duration-200 ${
      isExpanded ? 'w-[300px]' : 'w-[210px]'
    }`}>
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setIsExpanded((value) => !value)}
          className="min-w-0 text-left"
          aria-expanded={isExpanded}
        >
          <p className="text-[10px] uppercase tracking-widest text-white/35">
            World Model
          </p>
          <p className="mt-0.5 truncate text-sm font-medium text-white/85">
            {isExpanded ? (
              <>
                Week {simulation.currentStep || 0}
                {simulation.totalSteps ? <span className="text-white/35"> / {simulation.totalSteps}</span> : null}
              </>
            ) : (
              <>
                {activeScenario?.label ?? 'Simulation'}
                <span className="text-white/35"> · {percent(simulation.deviceFailureProb)}</span>
              </>
            )}
          </p>
        </button>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className={`rounded-full px-2 py-1 text-[10px] uppercase tracking-widest ${
            simulation.status === 'error'
              ? 'bg-red-400/10 text-red-200'
              : simulation.status === 'complete'
                ? 'bg-emerald-400/10 text-emerald-200'
                : 'bg-white/[0.06] text-white/45'
          }`}>
            {isExpanded ? statusLabel : statusLabel.slice(0, 4)}
          </span>
          <button
            type="button"
            onClick={() => setIsExpanded((value) => !value)}
            className="rounded-full border border-white/[0.08] bg-white/[0.04] px-1.5 py-1 text-[10px] text-white/45 transition-colors hover:text-white/75"
            aria-label={isExpanded ? 'Collapse world model panel' : 'Expand world model panel'}
          >
            {isExpanded ? '−' : '+'}
          </button>
        </div>
      </div>

      {!isExpanded && (
        <>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-yellow-300 to-red-500 transition-[width] duration-150"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[10px] text-white/35">
            <span>Week {simulation.currentStep || 0}</span>
            <span>{peakComponent ? percent(peakComponent[1]) : '0%'} peak</span>
          </div>
        </>
      )}

      {isExpanded && (
        <>
          <div className="mt-3 grid grid-cols-3 gap-1 rounded-lg border border-white/[0.06] bg-white/[0.025] p-1">
        {SCENARIOS.map((scenario) => {
          const isActive = simulation.scenario === scenario.value
          return (
            <button
              key={scenario.value}
              type="button"
              disabled={isBusy}
              onClick={() => startWorldModelSimulation(scenario.value)}
              className={`rounded-md px-2 py-2 text-left transition-colors active:translate-y-px disabled:cursor-wait disabled:opacity-70 ${
                isActive
                  ? 'bg-white/[0.09] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                  : 'text-white/40 hover:bg-white/[0.05] hover:text-white/70'
              }`}
            >
              <span className="block text-[11px] font-medium">{scenario.shortLabel}</span>
              <span className="mt-0.5 block truncate text-[9px] text-white/30">
                {scenario.description}
              </span>
            </button>
          )
        })}
          </div>

          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-yellow-300 to-red-500 transition-[width] duration-150"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="mt-2 flex items-center justify-between text-[10px] text-white/30">
            <span>Only trained model components are recolored</span>
            <span>9 parts</span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
        <div className="rounded-md border border-white/[0.06] bg-white/[0.03] px-2 py-1.5">
          <p className="text-white/30">Device risk</p>
          <p className="mt-0.5 font-mono text-white/80">{percent(simulation.deviceFailureProb)}</p>
        </div>
        <div className="rounded-md border border-white/[0.06] bg-white/[0.03] px-2 py-1.5">
          <p className="text-white/30">Peak part</p>
          <p className="mt-0.5 truncate font-mono text-white/80">
            {peakComponent ? percent(peakComponent[1]) : '0%'}
          </p>
        </div>
          </div>

          {peakComponent && (
            <p className="mt-2 truncate text-[11px] text-white/45">
              Highest risk: <span className="text-white/70">{componentLabels.get(peakComponent[0]) ?? peakComponent[0]}</span>
            </p>
          )}

          <div className="mt-2 text-[11px] text-white/45">
            Stress: <span className="text-white/70">{formatAction(simulation.activeStressAction)}</span>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <span className="text-[10px] text-white/30">low</span>
            <div className="h-1.5 flex-1 rounded-full bg-gradient-to-r from-emerald-400 via-yellow-300 to-red-500" />
            <span className="text-[10px] text-white/30">high</span>
          </div>

          {simulation.error && (
            <p className="mt-2 text-[11px] leading-relaxed text-red-200/80">{simulation.error}</p>
          )}
        </>
      )}
    </div>
  )
}
