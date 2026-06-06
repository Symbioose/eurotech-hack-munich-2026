'use client'
import { useState } from 'react'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { BuildGuardScene } from './BuildGuardScene'
import { ViewControls } from './ViewControls'
import { useProjectStore } from '@/lib/store'
import { SimulationOverlay } from './SimulationOverlay'
import { SimulationReportsPanel } from './SimulationReportsPanel'
import { ComponentPanel } from './ComponentPanel'

type WorkspaceTab = 'simulation' | 'reports'

const TABS: { id: WorkspaceTab; label: string }[] = [
  { id: 'simulation', label: '3D Simulation' },
  { id: 'reports', label: 'Reports' },
]

export function CenterPanel() {
  const showNode = useProjectStore((s) => s.showNode)
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('simulation')

  return (
    <GlassPanel className="relative flex flex-1 h-full flex-col overflow-hidden">
      <div className="flex h-9 shrink-0 items-end border-b border-white/[0.06] bg-zinc-950/70 px-2 pt-1 backdrop-blur-md">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`relative h-8 rounded-t-md border px-3 text-xs transition-colors ${
              activeTab === tab.id
                ? 'border-white/[0.10] border-b-zinc-950 bg-zinc-950 text-white/85'
                : 'border-transparent text-white/35 hover:bg-white/[0.04] hover:text-white/60'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="relative min-h-0 flex-1">
        {activeTab === 'simulation' ? (
          <>
            {showNode && <ViewControls />}
            {showNode && <SimulationOverlay />}
            {showNode && <ComponentPanel />}
            <BuildGuardScene />
            {!showNode && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <p className="text-white/20 text-sm">Describe the product you want to build →</p>
              </div>
            )}
          </>
        ) : (
          <SimulationReportsPanel />
        )}
      </div>
    </GlassPanel>
  )
}
