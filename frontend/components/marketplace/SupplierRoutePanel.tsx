import type { BuildPack } from '@/lib/marketplace/build-pack'

type SupplierRoutePanelProps = {
  pack: BuildPack
}

export function SupplierRoutePanel({ pack }: SupplierRoutePanelProps) {
  return (
    <section className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-4">
      <div className="mb-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/35">Supplier Route</p>
        <p className="mt-0.5 text-xs text-white/45">Greater Bay Area handoff sequence</p>
      </div>

      {pack.supplierRoute.length === 0 ? (
        <div className="rounded-md border border-white/[0.06] bg-black/15 px-3 py-4 text-xs text-white/35">
          No supplier route has been generated for this build pack.
        </div>
      ) : (
        <div className="space-y-3">
          {pack.supplierRoute.map((stop, index) => (
            <div key={`${stop.step}-${stop.role}`} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="flex h-6 w-6 items-center justify-center rounded-full border border-blue-500/35 bg-blue-500/10 text-[11px] font-medium tabular-nums text-blue-200">
                  {stop.step}
                </div>
                {index < pack.supplierRoute.length - 1 && <div className="my-1 w-px flex-1 bg-white/[0.08]" />}
              </div>
              <div className="min-w-0 flex-1 pb-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-white/80">{stop.role}</p>
                  <span className="rounded-sm border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-white/35">
                    {stop.region}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-snug text-white/45">{stop.description}</p>
                {stop.suppliers.length > 0 && (
                  <div className="mt-2 grid gap-1">
                    {stop.suppliers.map((supplier) => (
                      <div
                        key={`${stop.step}-${supplier.name}-${supplier.city}`}
                        className="rounded-md border border-white/[0.06] bg-black/15 px-2 py-1.5"
                      >
                        <p className="truncate text-xs text-white/70">{supplier.name}</p>
                        <p className="mt-0.5 text-[10px] text-white/35">
                          {supplier.city} / {supplier.scope}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
