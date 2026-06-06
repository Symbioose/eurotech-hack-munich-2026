'use client'
import { useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { ProjectsGrid } from '@/components/home/ProjectsGrid'

const HeroScene = dynamic(() => import('@/components/home/HeroScene').then((m) => ({ default: m.HeroScene })), {
  ssr: false,
})

export default function HomePage() {
  const projectsRef = useRef<HTMLDivElement>(null)
  const [heroComplete, setHeroComplete] = useState(false)

  function scrollToProjects() {
    projectsRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div style={{ overflowY: 'auto', height: '100vh' }}>
      {/* Hero — full viewport */}
      <div style={{ position: 'relative', width: '100vw', height: '100vh', background: '#f5f4f0' }}>
        {/* Wordmark */}
        <div style={{ position: 'absolute', top: 28, left: 32, zIndex: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: '#111', letterSpacing: '0.04em' }}>
            Physical Cursor
          </span>
        </div>

        {/* Three.js canvas */}
        <HeroScene onComplete={() => setHeroComplete(true)} />

        {/* Scroll progress bar */}
        <div style={{
          position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)',
          width: 120, height: 1, background: '#ddd', borderRadius: 1,
        }}>
          <div
            id="hero-progress"
            style={{ height: '100%', width: '0%', background: '#111', borderRadius: 1, transition: 'width 0.05s' }}
          />
        </div>

        {/* Down arrow — fades in when hero animation is complete */}
        <button
          onClick={scrollToProjects}
          style={{
            position: 'absolute', bottom: 64, left: '50%', transform: 'translateX(-50%)',
            opacity: heroComplete ? 1 : 0,
            transition: 'opacity 0.8s ease',
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#888', fontSize: 12, letterSpacing: '0.1em',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
          }}
        >
          <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.15em' }}>Projects</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 5v14M5 12l7 7 7-7" />
          </svg>
        </button>
      </div>

      {/* Projects section — below the hero */}
      <div
        ref={projectsRef}
        style={{ background: '#f5f4f0', minHeight: '100vh', padding: '48px 32px' }}
      >
        <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#888', marginBottom: 24 }}>
          Projects
        </p>
        <ProjectsGrid />
      </div>
    </div>
  )
}
