'use client'
import { useEffect, useState, type ReactNode } from 'react'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { ContextCards } from './ContextCards'
import { BOMTable } from './BOMTable'
import { SupplierCards } from './SupplierCards'
import { PipelineStages } from './PipelineStages'
import { ExpertSources } from './ExpertSources'
import { CollapsibleSection } from './CollapsibleSection'
import { SectionIcon } from './SectionIcon'
import { useProjectStore } from '@/lib/store'

type SectionKey = 'pipeline' | 'context' | 'bom' | 'suppliers' | 'sources'

const STORAGE_KEY = 'pc_left_panel'
const DEFAULT_OPEN: Record<SectionKey, boolean> = {
  pipeline: true,
  context: false,
  bom: true,
  suppliers: false,
  sources: false,
}

function readPrefs(): { collapsed?: boolean; open?: Partial<Record<SectionKey, boolean>> } {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function LeftPanel() {
  const isStreaming = useProjectStore((s) => s.isStreaming)
  const pipelineStage = useProjectStore((s) => s.pipelineStage)
  const usedDeterministic = useProjectStore((s) => s.usedDeterministic)
  const contextLen = useProjectStore((s) => s.contextFields.length)
  const bomLen = useProjectStore((s) => s.bom.length)
  const showSuppliers = useProjectStore((s) => s.showSuppliers)
  const routeLen = useProjectStore((s) => s.gbaRoute.length)
  const hasPipeline = useProjectStore((s) => !!s.pipelineState)

  const [collapsed, setCollapsed] = useState<boolean>(() => readPrefs().collapsed ?? false)
  const [open, setOpen] = useState<Record<SectionKey, boolean>>(() => ({
    ...DEFAULT_OPEN,
    ...readPrefs().open,
  }))

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ collapsed, open }))
    } catch {
      // ignore
    }
  }, [collapsed, open])

  const sections: { key: SectionKey; title: string; visible: boolean; count?: number; content: ReactNode }[] = [
    {
      key: 'pipeline',
      title: 'Pipeline',
      visible: isStreaming || !!pipelineStage || usedDeterministic,
      content: <PipelineStages />,
    },
    { key: 'context', title: 'Context', visible: contextLen > 0, count: contextLen, content: <ContextCards /> },
    { key: 'bom', title: 'BOM & Sourcing', visible: bomLen > 0, count: bomLen, content: <BOMTable /> },
    {
      key: 'suppliers',
      title: 'Supplier route & RFQ',
      visible: showSuppliers && routeLen > 0,
      content: <SupplierCards />,
    },
    { key: 'sources', title: 'Sources', visible: hasPipeline, content: <ExpertSources /> },
  ]
  const visible = sections.filter((s) => s.visible)

  if (visible.length === 0) {
    return (
      <GlassPanel className="flex flex-col w-[260px] shrink-0">
        <div className="flex items-center px-3 h-9 border-b border-white/[0.06]">
          <span className="text-[10px] uppercase tracking-widest text-white/30">Workspace</span>
        </div>
        <p className="text-[10px] text-white/20 p-4 leading-relaxed">
          Generate a design to see the pipeline, BOM, sourcing and suppliers here.
        </p>
      </GlassPanel>
    )
  }

  if (collapsed) {
    return (
      <GlassPanel className="flex flex-col items-center gap-1 py-2 w-11 shrink-0">
        <button
          onClick={() => setCollapsed(false)}
          title="Expand panel"
          className="w-8 h-8 flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/[0.06] rounded text-sm"
        >
          »
        </button>
        <div className="w-5 h-px bg-white/[0.08] my-1" />
        {visible.map((s) => (
          <button
            key={s.key}
            title={s.title}
            onClick={() => {
              setCollapsed(false)
              setOpen((o) => ({ ...o, [s.key]: true }))
            }}
            className="w-8 h-8 flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/[0.06] rounded"
          >
            <SectionIcon name={s.key} />
          </button>
        ))}
      </GlassPanel>
    )
  }

  return (
    <GlassPanel className="flex flex-col h-full w-[260px] shrink-0">
      <div className="flex items-center justify-between px-3 h-9 border-b border-white/[0.06] shrink-0">
        <span className="text-[10px] uppercase tracking-widest text-white/30">Workspace</span>
        <button
          onClick={() => setCollapsed(true)}
          title="Collapse panel"
          className="text-white/30 hover:text-white/70 text-sm leading-none px-1"
        >
          «
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-3">
        {visible.map((s) => (
          <CollapsibleSection
            key={s.key}
            title={s.title}
            icon={<SectionIcon name={s.key} />}
            count={s.count}
            open={!!open[s.key]}
            onToggle={() => setOpen((o) => ({ ...o, [s.key]: !o[s.key] }))}
          >
            {s.content}
          </CollapsibleSection>
        ))}
      </div>
    </GlassPanel>
  )
}
