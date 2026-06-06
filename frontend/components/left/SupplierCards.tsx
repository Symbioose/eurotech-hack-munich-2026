'use client'
import { useProjectStore } from '@/lib/store'
import { SUPPLIERS } from '@/lib/suppliers-data'
import { GBA_ROUTE_STOPS } from '@/lib/buildguard-data'

export function SupplierCards() {
  const showSuppliers = useProjectStore((s) => s.showSuppliers)
  if (!showSuppliers) return null

  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-white/30 mb-2">GBA Supplier Route</p>
      <div className="space-y-2">
        {GBA_ROUTE_STOPS.map((stop, i) => {
          const suppliers = SUPPLIERS.filter((s) => s.stop === stop.stop)
          return (
            <div key={stop.stop} className="flex gap-2">
              <div className="flex flex-col items-center">
                <div className="w-4 h-4 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-[9px] text-[#3b82f6]">{i + 1}</div>
                {i < GBA_ROUTE_STOPS.length - 1 && <div className="w-px flex-1 bg-white/[0.06] my-1" />}
              </div>
              <div className="flex-1 pb-2">
                <p className="text-xs text-white/80 font-medium">{stop.label}</p>
                <p className="text-[10px] text-white/40 mb-1">{stop.desc}</p>
                {suppliers.map((s) => (
                  <div key={s.id} className="text-[10px] text-white/50 bg-white/[0.02] rounded px-2 py-0.5 mb-0.5">
                    {s.name} · {s.city}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
