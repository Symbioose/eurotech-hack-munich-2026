import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
  className?: string
  variant?: 'light' | 'dark'
}

export function GlassPanel({ children, className = '', variant = 'light' }: Props) {
  const base =
    variant === 'dark'
      ? 'bg-[#111111]'
      : 'bg-white border border-[#e0dfd8]'

  return (
    <div className={`relative rounded-lg overflow-hidden ${base} ${className}`}>
      {children}
    </div>
  )
}
