type SourceBadgeProps = {
  status?: string | null
}

const BADGE_STYLES: Record<string, { label: string; className: string; title: string }> = {
  verified: {
    label: 'verified',
    className: 'border-emerald-500/35 bg-emerald-500/10 text-emerald-300',
    title: 'Externally verified source',
  },
  seeded: {
    label: 'seeded',
    className: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
    title: 'Seeded catalog source; confirm availability before purchase',
  },
  candidate: {
    label: 'estimate',
    className: 'border-amber-500/35 bg-amber-500/10 text-amber-300',
    title: 'Candidate source; confirm before buying',
  },
  not_configured: {
    label: 'unsourced',
    className: 'border-white/15 bg-white/[0.04] text-white/45',
    title: 'Sourcing is not configured',
  },
  error: {
    label: 'estimate',
    className: 'border-rose-500/35 bg-rose-500/10 text-rose-300',
    title: 'Source lookup failed; treat as an estimate',
  },
  unknown: {
    label: 'unknown',
    className: 'border-white/15 bg-white/[0.04] text-white/45',
    title: 'Unknown source status',
  },
}

export function SourceBadge({ status }: SourceBadgeProps) {
  const badge = BADGE_STYLES[status ?? 'unknown'] ?? BADGE_STYLES.unknown

  return (
    <span
      title={badge.title}
      className={`inline-flex h-5 items-center rounded-sm border px-1.5 text-[9px] font-medium uppercase tracking-wide ${badge.className}`}
    >
      {badge.label}
    </span>
  )
}
