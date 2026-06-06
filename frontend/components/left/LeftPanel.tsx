'use client'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { ContextCards } from './ContextCards'
import { BOMTable } from './BOMTable'
import { SupplierCards } from './SupplierCards'
import { PipelineStages } from './PipelineStages'

export function LeftPanel() {
  return (
    <GlassPanel className="flex flex-col h-full overflow-y-auto p-4 space-y-6 w-[280px] shrink-0">
      <PipelineStages />
      <ContextCards />
      <BOMTable />
      <SupplierCards />
    </GlassPanel>
  )
}
