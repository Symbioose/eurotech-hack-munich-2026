import type { BuildPack } from '@/lib/marketplace/build-pack'
import { SourceBadge } from './SourceBadge'

type BuildPackHeaderProps = {
  pack: BuildPack
}

function usd(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value)
}

function headerSourceStatus(pack: BuildPack) {
  if (pack.summary.sourceState === 'ready') return 'seeded'
  if (pack.summary.sourceState === 'unverified') return 'candidate'
  if (pack.summary.sourceState === 'checking') return 'unknown'
  return pack.summary.sourceState
}

export function BuildPackHeader({ pack }: BuildPackHeaderProps) {
  const positiveDelta = pack.summary.costDelta > 0 ? pack.summary.costDelta : 0
  const stats = [
    { label: 'Readiness', value: `${pack.summary.readinessScore}%` },
    { label: 'Total cost', value: usd(pack.summary.totalCost) },
    { label: 'Parts', value: pack.summary.partCount.toString() },
    { label: 'Buyable', value: pack.summary.buyableCount.toString() },
    { label: 'Unverified', value: pack.summary.unverifiedCount.toString() },
  ]

  return (
    <header className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/35">
            Build Pack Marketplace
          </p>
          <h1 className="mt-1 truncate text-xl font-semibold text-white/90">{pack.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-white/45">
            <span>{pack.summary.sourceLabel}</span>
            <SourceBadge status={headerSourceStatus(pack)} />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 rounded-md border border-blue-500/20 bg-blue-500/10 px-3 py-2">
          <span className="text-[10px] uppercase tracking-widest text-blue-200/60">Ready</span>
          <span className="text-2xl font-semibold tabular-nums text-blue-200">
            {pack.summary.readinessScore}
          </span>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-5">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-md border border-white/[0.06] bg-black/15 px-3 py-2">
            <dt className="text-[9px] uppercase tracking-widest text-white/30">{stat.label}</dt>
            <dd className="mt-1 text-sm font-medium tabular-nums text-white/80">{stat.value}</dd>
          </div>
        ))}
      </dl>

      {positiveDelta > 0 && (
        <p className="mt-3 text-[11px] text-amber-300/80">
          Reinforcement cost: +{usd(positiveDelta)} vs baseline BOM
        </p>
      )}
    </header>
  )
}
