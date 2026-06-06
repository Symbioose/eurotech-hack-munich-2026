'use client'
import { useProjectStore } from '@/lib/store'
export function BOMTable() {
  const bom = useProjectStore((s) => s.bom)
  const bomTotal = useProjectStore((s) => s.bomTotal)
  const baselineBomTotal = useProjectStore((s) => s.baselineBomTotal)
  const highlightedComponentId = useProjectStore((s) => s.highlightedComponentId)
  const fixApplied = useProjectStore((s) => s.fixApplied)
  const setHighlightedComponent = useProjectStore((s) => s.setHighlightedComponent)

  if (bom.length === 0) return null

  const total = bomTotal

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
              {fixApplied && bomTotal > baselineBomTotal && (
                <span className="text-emerald-400 text-[10px] ml-1">
                  +{bomTotal - baselineBomTotal}
                </span>
              )}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
