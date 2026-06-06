'use client'
import type { ReactNode } from 'react'

type Props = {
  title: string
  icon: ReactNode
  count?: number
  open: boolean
  onToggle: () => void
  children: ReactNode
}

export function CollapsibleSection({ title, icon, count, open, onToggle, children }: Props) {
  return (
    <div className="border-b border-white/[0.05]">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2 py-2 text-left group"
      >
        <span
          className={`text-white/25 text-[9px] transition-transform duration-150 ${
            open ? 'rotate-90' : ''
          }`}
        >
          ▶
        </span>
        <span className="text-white/40 group-hover:text-white/70 transition-colors">{icon}</span>
        <span className="text-[10px] uppercase tracking-widest text-white/45 group-hover:text-white/65 flex-1 transition-colors">
          {title}
        </span>
        {count != null && count > 0 && (
          <span className="text-[9px] text-white/25 tabular-nums">{count}</span>
        )}
      </button>
      {open && <div className="pb-3 pl-1">{children}</div>}
    </div>
  )
}
