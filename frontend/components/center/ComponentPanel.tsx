'use client'
import { useState } from 'react'
import { useProjectStore } from '@/lib/store'
import { TRAINED_WORLD_MODEL_COMPONENT_IDS } from '@/lib/world-model-simulation'

function riskColor(risk: number): string {
  if (risk > 0.65) return '#ef4444'
  if (risk > 0.35) return '#facc15'
  return '#22c55e'
}

export function ComponentPanel() {
  const [collapsed, setCollapsed] = useState(true)
  const sceneComponents = useProjectStore((s) => s.sceneComponents)
  const highlightedComponentId = useProjectStore((s) => s.highlightedComponentId)
  const setHighlightedComponent = useProjectStore((s) => s.setHighlightedComponent)
  const showAllTooltips = useProjectStore((s) => s.showAllTooltips)
  const setShowAllTooltips = useProjectStore((s) => s.setShowAllTooltips)
  const simulation = useProjectStore((s) => s.simulation)

  if (sceneComponents.length === 0) return null

  const showRisk = simulation.status !== 'idle' && Object.keys(simulation.risksByComponent).length > 0

  return (
    <div
      style={{
        position: 'absolute',
        right: '10px',
        top: '10px',
        zIndex: 20,
        width: '148px',
      }}
    >
      <button
        onClick={() => setCollapsed((c) => !c)}
        style={{
          width: '100%',
          height: '26px',
          background: 'rgba(15, 15, 25, 0.82)',
          border: '1px solid rgba(255,255,255,0.14)',
          borderRadius: collapsed ? '6px' : '6px 6px 0 0',
          padding: '0 10px',
          color: 'rgba(255,255,255,0.55)',
          fontSize: '12px',
          cursor: 'pointer',
          letterSpacing: '0.06em',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          userSelect: 'none',
        }}
      >
        <span style={{ fontSize: '10px', letterSpacing: '0.06em' }}>COMPONENTS</span>
        <span style={{ fontSize: '18px', lineHeight: 1 }}>
          {collapsed ? '▾' : '▴'}
        </span>
      </button>

      {!collapsed && (
        <div
          style={{
            background: 'rgba(8, 8, 14, 0.88)',
            border: '1px solid rgba(255,255,255,0.14)',
            borderTop: 'none',
            borderRadius: '0 0 6px 6px',
            backdropFilter: 'blur(10px)',
            maxHeight: '260px',
            overflowY: 'auto',
          }}
        >
          <button
            onClick={() => {
              const next = !showAllTooltips
              setShowAllTooltips(next)
              if (next) setHighlightedComponent(null)
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              width: '100%',
              padding: '5px 10px',
              background: showAllTooltips ? 'rgba(255,255,255,0.07)' : 'transparent',
              border: 'none',
              borderBottom: '1px solid rgba(255,255,255,0.12)',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'background 0.15s',
            }}
          >
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '2px',
                background: showAllTooltips ? '#3b82f6' : 'rgba(255,255,255,0.25)',
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: '10px',
                color: showAllTooltips ? '#f8fafc' : 'rgba(255,255,255,0.65)',
                fontWeight: 600,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              All Components
            </span>
          </button>
          {sceneComponents.map((comp) => {
            const risk = showRisk && TRAINED_WORLD_MODEL_COMPONENT_IDS.has(comp.id)
              ? simulation.risksByComponent[comp.id] ?? null
              : null
            const dotColor = risk !== null ? riskColor(risk) : comp.color
            const isSelected = highlightedComponentId === comp.id

            return (
              <button
                key={comp.id}
                onClick={() => {
                  setShowAllTooltips(false)
                  setHighlightedComponent(isSelected ? null : comp.id)
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: '5px 10px',
                  background: isSelected ? 'rgba(255,255,255,0.07)' : 'transparent',
                  border: 'none',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.15s',
                }}
              >
                <span
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    background: dotColor,
                    flexShrink: 0,
                    boxShadow: risk !== null ? `0 0 5px ${dotColor}88` : 'none',
                  }}
                />
                <span
                  style={{
                    fontSize: '10px',
                    color: isSelected ? '#f8fafc' : 'rgba(255,255,255,0.55)',
                    fontWeight: isSelected ? 600 : 400,
                    letterSpacing: '0.01em',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {comp.label}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
