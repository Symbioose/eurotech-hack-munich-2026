'use client'
import { useProjectStore } from '@/lib/store'

export function SupplierCards() {
  const showSuppliers = useProjectStore((s) => s.showSuppliers)
  const rfqQuestions = useProjectStore((s) => s.rfqQuestions)
  const gbaRoute = useProjectStore((s) => s.gbaRoute)
  if (!showSuppliers || gbaRoute.length === 0) return null

  return (
    <div className="space-y-4">
      {rfqQuestions.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-widest text-white/30 mb-2">RFQ Questions</p>
          <ul className="space-y-1">
            {rfqQuestions.map((q) => (
              <li key={q} className="text-[10px] text-white/50 leading-snug">
                · {q}
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-[10px] uppercase tracking-widest text-white/30 mb-2">GBA Supplier Route</p>
      <div className="space-y-2">
        {gbaRoute.map((stop, i) => (
          <div key={stop.step} className="flex gap-2">
            <div className="flex flex-col items-center">
              <div className="w-4 h-4 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-[9px] text-[#3b82f6]">
                {stop.step}
              </div>
              {i < gbaRoute.length - 1 && <div className="w-px flex-1 bg-white/[0.06] my-1" />}
            </div>
            <div className="flex-1 pb-2">
              <p className="text-xs text-white/80 font-medium">{stop.role}</p>
              <p className="text-[10px] text-white/40 mb-1">{stop.description}</p>
              {stop.suppliers.map((s) => (
                <div
                  key={`${stop.step}-${s.name}`}
                  className="text-[10px] text-white/50 bg-white/[0.02] rounded px-2 py-0.5 mb-0.5"
                >
                  {s.name} · {s.city}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
