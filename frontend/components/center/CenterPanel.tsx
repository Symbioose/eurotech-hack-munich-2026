'use client'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { BuildGuardScene } from './BuildGuardScene'
import { ViewControls } from './ViewControls'
import { useProjectStore } from '@/lib/store'

export function CenterPanel() {
  const showNode = useProjectStore((s) => s.showNode)

  return (
    <GlassPanel className="relative flex-1 h-full overflow-hidden">
      {showNode && <ViewControls />}
      <BuildGuardScene />
      {!showNode && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-white/20 text-sm">Describe your smart city problem →</p>
        </div>
      )}
    </GlassPanel>
  )
}
