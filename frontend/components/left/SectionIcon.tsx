type Props = { name: 'pipeline' | 'context' | 'bom' | 'suppliers' | 'sources'; size?: number }

/** Minimal stroke icons for the left-panel sections (VS Code / Cursor style rail). */
export function SectionIcon({ name, size = 15 }: Props) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.4,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  switch (name) {
    case 'pipeline':
      return (
        <svg {...common}>
          <path d="M1.5 8h3l2 4.5 3-9 2 4.5h3" />
        </svg>
      )
    case 'context':
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="6.2" />
          <path d="M8 7.2v3.4" />
          <circle cx="8" cy="5.2" r="0.5" fill="currentColor" stroke="none" />
        </svg>
      )
    case 'bom':
      return (
        <svg {...common}>
          <path d="M5.5 4h8M5.5 8h8M5.5 12h8" />
          <circle cx="2.6" cy="4" r="0.7" />
          <circle cx="2.6" cy="8" r="0.7" />
          <circle cx="2.6" cy="12" r="0.7" />
        </svg>
      )
    case 'suppliers':
      return (
        <svg {...common}>
          <circle cx="3.5" cy="8" r="2" />
          <circle cx="12.5" cy="3.5" r="2" />
          <circle cx="12.5" cy="12.5" r="2" />
          <path d="M5.3 7l5.4-2.6M5.3 9l5.4 2.6" />
        </svg>
      )
    case 'sources':
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="6.2" />
          <path d="M1.8 8h12.4M8 1.8c2 2 2 10.4 0 12.4M8 1.8c-2 2-2 10.4 0 12.4" />
        </svg>
      )
  }
}
