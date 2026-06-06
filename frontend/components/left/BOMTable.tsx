'use client'
import { useProjectStore } from '@/lib/store'

/** Provenance badge for a BOM row, so trust (verified vs estimate) is visible. */
function SourceBadge({ status }: { status?: string }) {
  if (!status) return null
  const map: Record<string, { label: string; className: string; title: string }> = {
    verified: {
      label: 'verified',
      className: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
      title: 'Verified against a live source',
    },
    seeded: {
      label: 'sourced',
      className: 'text-sky-300/80 border-sky-500/20 bg-sky-500/5',
      title: 'Seeded from a real supplier catalog — price grounded, not live-checked',
    },
    candidate: {
      label: 'estimate',
      className: 'text-amber-300 border-amber-500/30 bg-amber-500/10',
      title: 'Unverified estimate — confirm part, price and supplier before RFQ',
    },
    not_configured: {
      label: 'unsourced',
      className: 'text-white/40 border-white/15 bg-white/5',
      title: 'No source configured',
    },
    error: {
      label: 'estimate',
      className: 'text-amber-300 border-amber-500/30 bg-amber-500/10',
      title: 'Source lookup failed — treat as an estimate',
    },
  }
  const badge = map[status]
  if (!badge) return null
  return (
    <span
      title={badge.title}
      className={`ml-1.5 inline-block rounded-sm border px-1 py-px text-[8px] uppercase tracking-wide align-middle ${badge.className}`}
    >
      {badge.label}
    </span>
  )
}

export function BOMTable() {
  const bom = useProjectStore((s) => s.bom)
  const bomTotal = useProjectStore((s) => s.bomTotal)
  const baselineBomTotal = useProjectStore((s) => s.baselineBomTotal)
  const highlightedComponentId = useProjectStore((s) => s.highlightedComponentId)
  const fixApplied = useProjectStore((s) => s.fixApplied)
  const setHighlightedComponent = useProjectStore((s) => s.setHighlightedComponent)

  if (bom.length === 0) return null

  const total = bomTotal
  const estimateCount = bom.filter(
    (r) => r.sourceStatus === 'candidate' || r.sourceStatus === 'error'
  ).length

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
                <td className="py-0.5 pr-2 truncate max-w-[150px]">
                  {row.isNew && <span className="text-emerald-400 mr-1">+</span>}
                  {row.part}
                  <SourceBadge status={row.sourceStatus} />
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
      {estimateCount > 0 && (
        <p className="mt-1.5 text-[9px] text-amber-300/70">
          {estimateCount} unverified estimate{estimateCount > 1 ? 's' : ''} — confirm before RFQ.
        </p>
      )}
    </div>
  )
}
