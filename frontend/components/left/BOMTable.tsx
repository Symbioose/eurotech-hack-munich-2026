'use client'
import { useProjectStore } from '@/lib/store'

export function BOMTable() {
  const { bom, highlightedComponentId, fixApplied, setHighlightedComponent, activeWarning } = useProjectStore((s) => ({
    bom: s.bom,
    highlightedComponentId: s.highlightedComponentId,
    fixApplied: s.fixApplied,
    setHighlightedComponent: s.setHighlightedComponent,
    activeWarning: s.activeWarning,
  }))

  const total = bom.reduce((sum, r) => sum + r.cost, 0)

  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-white/30 mb-2">Bill of Materials</p>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-white/30 border-b border-white/[0.06]">
            <th className="text-left pb-1 font-normal">Part</th>
            <th className="text-right pb-1 font-normal">$</th>
          </tr>
        </thead>
        <tbody>
          {bom.map((row) => {
            const isHighlighted = row.componentId === highlightedComponentId
            const rowTextClass = isHighlighted
              ? 'text-[#3b82f6] bg-blue-500/5'
              : row.isNew
              ? 'text-emerald-400'
              : 'text-white/60 hover:text-white/80'
            return (
              <tr
                key={row.id}
                onClick={() => setHighlightedComponent(row.componentId ?? null)}
                className={`cursor-pointer transition-colors ${rowTextClass}`}
              >
                <td className="py-0.5 pr-2 truncate max-w-[140px]">
                  {row.isNew && <span className="text-emerald-400 mr-1">+</span>}
                  {row.part}
                </td>
                <td className="py-0.5 text-right tabular-nums">{row.cost}</td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-white/[0.06] text-white font-medium">
            <td className="pt-1">Total</td>
            <td className="pt-1 text-right tabular-nums">
              ${total}
              {fixApplied && activeWarning && (
                <span className="text-emerald-400 text-[10px] ml-1">+{activeWarning.fix.costDelta}</span>
              )}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
