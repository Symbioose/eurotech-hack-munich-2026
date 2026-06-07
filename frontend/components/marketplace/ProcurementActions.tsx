import type { BuildPack, ReadinessFlag } from '@/lib/marketplace/build-pack'

type ProcurementActionsProps = {
  pack: BuildPack
  refreshing: boolean
  onBuyParts: () => void
  onExportRfq: () => void
  onRefreshSources: () => void
}

const WARNING_STYLES: Record<ReadinessFlag['severity'], string> = {
  info: 'border-sky-500/25 bg-sky-500/10 text-sky-100',
  warning: 'border-amber-500/30 bg-amber-500/10 text-amber-100',
  critical: 'border-rose-500/35 bg-rose-500/10 text-rose-100',
}

const WARNING_LABELS: Record<ReadinessFlag['severity'], string> = {
  info: 'Info',
  warning: 'Warning',
  critical: 'Critical',
}

function ActionButton({
  children,
  disabled,
  onClick,
  reason,
  primary = false,
}: {
  children: string
  disabled: boolean
  onClick: () => void
  reason?: string
  primary?: boolean
}) {
  const classes = primary
    ? 'border-blue-500/35 bg-blue-500/15 text-blue-100 hover:bg-blue-500/25'
    : 'border-white/[0.08] bg-white/[0.04] text-white/75 hover:bg-white/[0.08]'

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={disabled ? reason : undefined}
      className={`rounded-md border px-3 py-2 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${classes}`}
    >
      {children}
    </button>
  )
}

export function ProcurementActions({
  pack,
  refreshing,
  onBuyParts,
  onExportRfq,
  onRefreshSources,
}: ProcurementActionsProps) {
  return (
    <section className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-4">
      <div className="grid gap-2 sm:grid-cols-3">
        <ActionButton
          primary
          disabled={!pack.actions.buyParts.enabled || refreshing}
          onClick={onBuyParts}
          reason={refreshing ? 'Sourcing refresh is running.' : pack.actions.buyParts.reason}
        >
          {pack.actions.buyParts.label}
        </ActionButton>
        <ActionButton
          disabled={!pack.actions.sendRfq.enabled || refreshing}
          onClick={onExportRfq}
          reason={refreshing ? 'Sourcing refresh is running.' : pack.actions.sendRfq.reason}
        >
          {pack.actions.sendRfq.label}
        </ActionButton>
        <ActionButton
          disabled={!pack.actions.refreshSourcing.enabled || refreshing}
          onClick={onRefreshSources}
          reason={refreshing ? 'Sourcing refresh is already running.' : pack.actions.refreshSourcing.reason}
        >
          {refreshing ? 'Refreshing Sources' : 'Refresh Sourcing'}
        </ActionButton>
      </div>

      {pack.warnings.length > 0 && (
        <div className="mt-3 space-y-2">
          {pack.warnings.map((warning) => (
            <div
              key={`${warning.kind}-${warning.title}`}
              className={`rounded-md border px-3 py-2 ${WARNING_STYLES[warning.severity]}`}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest">
                  {WARNING_LABELS[warning.severity]}
                </p>
                <p className="text-[9px] uppercase tracking-widest opacity-60">{warning.kind}</p>
              </div>
              <p className="mt-1 text-xs font-medium text-white/85">{warning.title}</p>
              <p className="mt-0.5 text-[11px] leading-snug text-white/55">{warning.message}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
