'use client'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { BuildGuardScene } from './BuildGuardScene'
import { ViewControls } from './ViewControls'
import { useProjectStore } from '@/lib/store'
import { SimulationOverlay } from './SimulationOverlay'

export function CenterPanel() {
  const showNode = useProjectStore((s) => s.showNode)

  return (
    <GlassPanel className="relative flex-1 h-full overflow-hidden">
      {showNode && <ViewControls />}
      {showNode && <SimulationOverlay />}
      <BuildGuardScene />
      {!showNode && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-white/20 text-sm">Describe the product you want to build →</p>
        </div>
      )}
    </GlassPanel>
  )
}
