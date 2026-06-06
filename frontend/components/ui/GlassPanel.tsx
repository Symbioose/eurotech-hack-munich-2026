import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
  className?: string
}

export function GlassPanel({ children, className = '' }: Props) {
  return (
    <div
      className={`
        relative rounded-lg overflow-hidden
        bg-white/[0.03] border border-white/[0.08]
        backdrop-blur-sm
        ${className}
      `}
    >
      {children}
    </div>
  )
}
