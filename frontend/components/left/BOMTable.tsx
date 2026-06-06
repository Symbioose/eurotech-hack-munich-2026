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

  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-[#888] mb-2">Bill of Materials</p>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-[#888] border-b border-[#e0dfd8]">
            <th className="text-left pb-1 font-normal">Part</th>
            <th className="text-right pb-1 font-normal">$</th>
          </tr>
        </thead>
        <tbody>
          {bom.map((row) => {
            const isHighlighted = row.componentId === highlightedComponentId
            const rowClass = isHighlighted
              ? 'text-[#111] bg-[#f5f4f0]'
              : row.isNew
              ? 'text-[#111] font-semibold'
              : 'text-[#111] hover:text-[#333]'
            return (
              <tr
                key={row.id}
                onClick={() => setHighlightedComponent(row.componentId ?? null)}
                className={`cursor-pointer transition-colors ${rowClass}`}
              >
                <td className="py-0.5 pr-2 truncate max-w-[140px]">
                  {row.isNew && <span className="mr-1">+</span>}
                  {row.part}
                </td>
                <td className="py-0.5 text-right tabular-nums">{row.cost}</td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-[#e0dfd8] text-[#111] font-medium">
            <td className="pt-1">Total</td>
            <td className="pt-1 text-right tabular-nums">
              ${bomTotal}
              {fixApplied && bomTotal > baselineBomTotal && (
                <span className="text-[#888] text-[10px] ml-1">
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
