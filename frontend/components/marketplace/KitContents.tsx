import type { BOMOffer } from '@/lib/types'
import type { BuildPack, BuildPackLine } from '@/lib/marketplace/build-pack'
import { SourceBadge } from './SourceBadge'

type KitContentsProps = {
  pack: BuildPack
}

function usd(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value)
}

function buyHref(offer: BOMOffer, line: BuildPackLine) {
  const params = new URLSearchParams({
    u: offer.url,
    c: line.componentId ?? line.id,
    d: offer.distributor,
  })

  return `/api/go?${params.toString()}`
}

function offerLabel(offer: BOMOffer) {
  const stock = offer.stock === null ? 'stock unknown' : `${offer.stock} stock`
  return `${offer.distributor} / ${offer.region} / ${usd(offer.unitPrice)} / MOQ ${offer.moq} / ${stock}`
}

function LifecycleText({ line }: { line: BuildPackLine }) {
  const details = [line.manufacturer, line.mpn, line.lifecycle].filter(Boolean)
  if (details.length === 0) return null

  return <p className="mt-0.5 truncate text-[10px] text-white/35">{details.join(' / ')}</p>
}

export function KitContents({ pack }: KitContentsProps) {
  return (
    <section className="rounded-lg border border-white/[0.08] bg-white/[0.03]">
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/35">Kit Contents</p>
          <p className="mt-0.5 text-xs text-white/45">{pack.summary.partCount} BOM line items</p>
        </div>
        <p className="text-xs tabular-nums text-white/60">{usd(pack.summary.totalCost)}</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-xs">
          <thead className="border-b border-white/[0.06] text-[10px] uppercase tracking-widest text-white/30">
            <tr>
              <th className="px-4 py-2 font-normal">Part</th>
              <th className="px-3 py-2 font-normal">Route</th>
              <th className="px-3 py-2 text-right font-normal">Cost</th>
              <th className="px-3 py-2 font-normal">Best Offer</th>
              <th className="px-3 py-2 font-normal">Source</th>
              <th className="px-4 py-2 text-right font-normal">Link</th>
            </tr>
          </thead>
          <tbody>
            {pack.groups.map((group) => (
              <GroupRows key={group.category} label={group.label} items={group.items} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function GroupRows({ label, items }: { label: string; items: BuildPackLine[] }) {
  return (
    <>
      <tr className="border-y border-white/[0.06] bg-white/[0.025]">
        <td colSpan={6} className="px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-white/35">
          {label}
        </td>
      </tr>
      {items.map((line) => (
        <tr key={line.id} className="border-b border-white/[0.045] text-white/65 hover:bg-white/[0.025]">
          <td className="max-w-[260px] px-4 py-2 align-top">
            <div className="flex min-w-0 items-center gap-2">
              {line.isNew && (
                <span className="rounded-sm border border-emerald-500/25 bg-emerald-500/10 px-1 text-[9px] uppercase text-emerald-300">
                  New
                </span>
              )}
              <span className="truncate font-medium text-white/80">{line.part}</span>
            </div>
            <LifecycleText line={line} />
          </td>
          <td className="max-w-[220px] px-3 py-2 align-top text-white/45">
            <span className="line-clamp-2">{line.supplierRoute}</span>
          </td>
          <td className="px-3 py-2 text-right align-top tabular-nums text-white/70">{usd(line.cost)}</td>
          <td className="max-w-[280px] px-3 py-2 align-top">
            {line.bestOffer ? (
              <div>
                <p className="truncate text-white/70">{offerLabel(line.bestOffer)}</p>
                {!line.bestOffer.verified && (
                  <p className="mt-0.5 text-[10px] text-amber-300/70">Distributor offer needs confirmation.</p>
                )}
              </div>
            ) : (
              <span className="text-white/30">No buyable offer</span>
            )}
          </td>
          <td className="px-3 py-2 align-top">
            <div className="flex flex-col gap-1">
              <SourceBadge status={line.sourceStatus} />
              <span className="text-[10px] text-white/35">{line.sourceLabel}</span>
              {line.needsConfirmation && (
                <span className="text-[10px] text-amber-300/70">Confirm before RFQ</span>
              )}
            </div>
          </td>
          <td className="px-4 py-2 text-right align-top">
            {line.bestOffer ? (
              <a
                href={buyHref(line.bestOffer, line)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex rounded-sm border border-blue-500/25 bg-blue-500/10 px-2 py-1 text-[11px] font-medium text-blue-200 hover:bg-blue-500/20"
              >
                Open
              </a>
            ) : (
              <span className="text-[10px] text-white/25">Pending</span>
            )}
          </td>
        </tr>
      ))}
    </>
  )
}
