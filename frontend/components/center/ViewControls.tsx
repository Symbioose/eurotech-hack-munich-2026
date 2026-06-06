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
  const rotationPaused = useProjectStore((s) => s.rotationPaused)
  const setRotationPaused = useProjectStore((s) => s.setRotationPaused)

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-1 z-10">
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
      <div className="w-px h-3 bg-white/20 mx-0.5" />
      <button
        onClick={() => setRotationPaused(!rotationPaused)}
        title={rotationPaused ? 'Resume rotation' : 'Pause rotation'}
        className={`text-xs px-2 py-1 rounded transition-colors ${
          rotationPaused
            ? 'bg-white/10 text-white border border-white/20'
            : 'text-white/40 hover:text-white/60'
        }`}
      >
        {rotationPaused ? '▶' : '⏸'}
      </button>
    </div>
  )
}
