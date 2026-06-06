'use client'
import { useProjectStore } from '@/lib/store'
import type { ViewMode } from '@/lib/types'

const MODES: { mode: ViewMode; label: string }[] = [
  { mode: 'normal', label: 'Normal' },
  { mode: 'xray', label: 'X-Ray' },
  { mode: 'explode', label: 'Explode' },
]

export function ViewControls() {
  const viewMode = useProjectStore((s) => s.viewMode)
  const setViewMode = useProjectStore((s) => s.setViewMode)

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 flex gap-1 z-10">
      {MODES.map(({ mode, label }) => (
        <button
          key={mode}
          onClick={() => setViewMode(mode)}
          className={`text-xs px-3 py-1 rounded transition-colors ${
            viewMode === mode
              ? 'bg-white/10 text-white border border-white/20'
              : 'text-white/40 hover:text-white/60'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
