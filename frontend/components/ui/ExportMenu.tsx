'use client'
import { useEffect, useRef, useState } from 'react'
import { useProjectStore } from '@/lib/store'
import { exportReadinessPack, exportDesignJson, exportBomCsv, type ReadinessData } from '@/lib/export'

export function ExportMenu() {
  const bomLen = useProjectStore((s) => s.bom.length)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  if (bomLen === 0) return null

  function readinessData(): ReadinessData {
    const s = useProjectStore.getState()
    return {
      projectTitle: s.projectTitle || 'Hardware product',
      contextFields: s.contextFields,
      bom: s.bom,
      bomTotal: s.bomTotal,
      baselineBomTotal: s.baselineBomTotal,
      fixApplied: s.fixApplied,
      warning: s.activeWarning
        ? {
            title: s.activeWarning.title,
            explanation: s.activeWarning.explanation,
            fixLabel: s.activeWarning.fix.label,
            costDelta: s.activeWarning.fix.costDelta,
          }
        : null,
      gbaRoute: s.gbaRoute,
      rfqQuestions: s.rfqQuestions,
    }
  }

  const item = (label: string, sub: string, run: () => void) => (
    <button
      onClick={() => {
        run()
        setOpen(false)
      }}
      className="w-full text-left px-3 py-2 hover:bg-white/[0.06] transition-colors"
    >
      <span className="block text-xs text-white/85">{label}</span>
      <span className="block text-[9px] text-white/35">{sub}</span>
    </button>
  )

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-xs px-3 py-1.5 rounded bg-accent/10 text-accent border border-accent/20 hover:bg-accent/20 transition-colors"
      >
        Export ▾
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-60 rounded-md border border-white/10 bg-[#15151a] shadow-xl overflow-hidden z-50">
          {item('Readiness Pack (PDF)', 'Brief, BOM, sourcing, supplier route', () =>
            exportReadinessPack(readinessData())
          )}
          {item('BOM (CSV)', 'MPN, manufacturer, distributor, buy link', () => {
            const s = useProjectStore.getState()
            exportBomCsv(s.bom, s.projectTitle || 'product')
          })}
          {item('Design artifact (JSON)', 'Machine-readable — feeds the world model', () => {
            const s = useProjectStore.getState()
            if (s.pipelineState) exportDesignJson(s.pipelineState, s.projectTitle || 'product')
          })}
        </div>
      )}
    </div>
  )
}
