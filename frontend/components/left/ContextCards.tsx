'use client'
import { useProjectStore } from '@/lib/store'

export function ContextCards() {
  const contextFields = useProjectStore((s) => s.contextFields)
  if (contextFields.length === 0) return null

  return (
    <div className="space-y-1">
      <p className="text-[10px] uppercase tracking-widest text-white/30 mb-2">Deployment Context</p>
      {contextFields.map((f) => (
        <div key={f.label} className="flex gap-2 text-xs">
          <span className="text-white/30 shrink-0 w-24">{f.label}</span>
          <span className="text-white/70">{f.value}</span>
        </div>
      ))}
    </div>
  )
}
