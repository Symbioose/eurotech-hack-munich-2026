'use client'
import { useRef, useState, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html, Line, RoundedBox, Text } from '@react-three/drei'
import * as THREE from 'three'
import { useProjectStore } from '@/lib/store'
import type { Component3D, ComponentDamageDetail } from '@/lib/types'
import { getPartDetails, type PartDetail } from '@/lib/scene/part-details'
import { TRAINED_WORLD_MODEL_COMPONENT_IDS } from '@/lib/world-model-simulation'


type ComponentMeshProps = {
  comp: Component3D
  viewMode: string
  isHighlighted: boolean
  isWarning: boolean
  fixApplied: boolean
  simulationRisk: number | null
  simulationDetails: ComponentDamageDetail[] | null
  parentPosition?: [number, number, number]
}

function riskColor(risk: number) {
  const value = Math.max(0, Math.min(1, risk))
  const green = new THREE.Color('#22c55e')
  const yellow = new THREE.Color('#facc15')
  const red = new THREE.Color('#ef4444')
  const color = value < 0.5
    ? green.lerp(yellow, value * 2)
    : yellow.lerp(red, (value - 0.5) * 2)
  return color.getStyle()
}

function ComponentTooltip({
  label,
  risk,
  details,
  compPosition,
}: {
  label: string
  risk: number
  details: ComponentDamageDetail[]
  compPosition: [number, number, number]
}) {
  const color = riskColor(risk)
  const [cx, cy, cz] = compPosition
  const len = Math.sqrt(cx * cx + cy * cy + cz * cz)
  const nx = len > 0.05 ? cx / len : 1
  const ny = len > 0.05 ? cy / len : 0
  const nz = len > 0.05 ? cz / len : 0
  const dist = 0.9
  const anchor: [number, number, number] = [nx * dist, ny * dist + 0.15, nz * dist]

  const statusLabel = risk > 0.65 ? 'CRITICAL' : risk > 0.35 ? 'WARNING' : 'DEGRADED'

  return (
    <>
      <Line
        points={[[0, 0, 0], anchor]}
        color={color}
        transparent
        opacity={0.75}
        lineWidth={1.5}
      />
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.022, 8, 4]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1} />
      </mesh>
      <Html
        position={anchor}
        center
        zIndexRange={[5, 0]}
      >
        <div
          style={{
            background: 'rgba(8, 8, 14, 0.93)',
            border: `1px solid ${color}`,
            borderRadius: '7px',
            padding: '8px 11px',
            minWidth: '148px',
            color: '#e2e8f0',
            fontSize: '11px',
            lineHeight: '1.6',
            pointerEvents: 'none',
            backdropFilter: 'blur(10px)',
            boxShadow: `0 0 12px ${color}33`,
            userSelect: 'none',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
            <span style={{ fontWeight: 700, color: '#f8fafc', fontSize: '10.5px', letterSpacing: '0.02em' }}>
              {label}
            </span>
            <span
              style={{
                fontSize: '8.5px',
                fontWeight: 700,
                color,
                border: `1px solid ${color}`,
                borderRadius: '3px',
                padding: '1px 5px',
                letterSpacing: '0.06em',
              }}
            >
              {statusLabel}
            </span>
          </div>
          <div style={{ width: '100%', height: '1px', background: `${color}44`, marginBottom: '5px' }} />
          {details.map((d, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginBottom: '1px' }}>
              <span style={{ color: '#94a3b8', fontSize: '10px' }}>{d.label}</span>
              <span
                style={{
                  fontWeight: 600,
                  fontSize: '10px',
                  color: d.risk > 0.6 ? '#ef4444' : d.risk > 0.3 ? '#facc15' : '#22c55e',
                }}
              >
                {d.value}
              </span>
            </div>
          ))}
        </div>
      </Html>
    </>
  )
}

function ComponentMesh({
  comp,
  viewMode,
  isHighlighted,
  isWarning,
  fixApplied,
  simulationRisk,
  simulationDetails,
  parentPosition,
}: ComponentMeshProps) {
  const groupRef = useRef<THREE.Group>(null)
  const targetVec = useRef(new THREE.Vector3())
  const setHighlighted = useProjectStore((s) => s.setHighlightedComponent)

  const targetPos: [number, number, number] = viewMode === 'explode'
    ? [
        comp.position[0] + comp.explodeOffset[0],
        comp.position[1] + comp.explodeOffset[1],
        comp.position[2] + comp.explodeOffset[2],
      ]
    : comp.position

  useFrame(() => {
    if (!groupRef.current) return
    targetVec.current.set(targetPos[0], targetPos[1], targetPos[2])
    groupRef.current.position.lerp(targetVec.current, 0.08)
  })

  const opacity = viewMode === 'xray' && comp.id === 'enclosure' ? 0.15 : 1
  const simulationColor = simulationRisk === null ? null : riskColor(simulationRisk)
  const color = simulationColor ?? (isWarning && !fixApplied ? '#ef4444' : isHighlighted ? '#3b82f6' : comp.color)

  const labelY = targetPos[1] + (comp.scale[1] ?? 0.5) / 2 + 0.15
  const details = getPartDetails(comp.id, comp.scale)
  const skipBaseBody = comp.id === 'fasteners' || comp.id === 'gasket'

  return (
    <group>
      {viewMode === 'explode' && parentPosition && comp.assembly?.parentSceneId && (
        <Line
          points={[
            [parentPosition[0], parentPosition[1], parentPosition[2]],
            [targetPos[0], targetPos[1], targetPos[2]],
          ]}
          color={comp.assembly.placement === 'seal' || comp.assembly.placement === 'fastener' ? '#22c55e' : '#64748b'}
          transparent
          opacity={0.45}
          lineWidth={1}
        />
      )}
      <group
        ref={groupRef}
        position={comp.position}
        onClick={(e) => { e.stopPropagation(); setHighlighted(comp.id) }}
      >
        {!skipBaseBody && (
          <ComponentBody
            comp={comp}
            color={color}
            opacity={opacity}
            wireframe={viewMode === 'xray' && comp.id !== 'enclosure'}
            simulationRisk={simulationRisk}
          />
        )}
        {details.map((detail, index) => (
          <DetailMesh
            key={`${detail.role}-${index}`}
            detail={detail}
            simulationColor={simulationColor}
            simulationRisk={simulationRisk}
          />
        ))}
        {isHighlighted
          && simulationRisk !== null
          && simulationDetails
          && simulationDetails.length > 0
          && (
          <ComponentTooltip
            label={comp.label}
            risk={simulationRisk}
            details={simulationDetails}
            compPosition={comp.position}
          />
        )}
      </group>
      {(viewMode === 'explode' || isHighlighted) && (
        <Text
          position={[targetPos[0], labelY, targetPos[2]]}
          fontSize={0.07}
          color="rgba(255,255,255,0.7)"
          anchorX="center"
          anchorY="bottom"
        >
          {comp.label}
        </Text>
      )}
    </group>
  )
}

function ComponentBody({
  comp,
  color,
  opacity,
  wireframe,
  simulationRisk,
}: {
  comp: Component3D
  color: string
  opacity: number
  wireframe: boolean
  simulationRisk: number | null
}) {
  const material = (
    <meshStandardMaterial
      color={color}
      transparent={opacity < 1}
      opacity={opacity}
      roughness={comp.id === 'enclosure' ? 0.55 : 0.34}
      metalness={comp.id === 'bracket' || comp.id === 'fasteners' ? 0.8 : 0.12}
      wireframe={wireframe}
      emissive={simulationRisk === null ? '#000000' : color}
      emissiveIntensity={simulationRisk === null ? 0 : 0.08 + simulationRisk * 0.18}
    />
  )

  if (comp.geometry === 'cylinder') {
    return (
      <mesh>
        <cylinderGeometry args={[comp.scale[0], comp.scale[0], comp.scale[1], 32]} />
        {material}
      </mesh>
    )
  }

  if (comp.geometry === 'sphere') {
    return (
      <mesh>
        <sphereGeometry args={[comp.scale[0], 32, 16]} />
        {material}
      </mesh>
    )
  }

  const radius = Math.min(comp.scale[0], comp.scale[1], comp.scale[2]) * 0.18
  return (
    <RoundedBox args={comp.scale} radius={Math.max(0.01, radius)} smoothness={4}>
      {material}
    </RoundedBox>
  )
}

function DetailMesh({
  detail,
  simulationColor,
  simulationRisk,
}: {
  detail: PartDetail
  simulationColor: string | null
  simulationRisk: number | null
}) {
  const opacity = detail.opacity ?? 1
  const material = (
    <meshStandardMaterial
      color={simulationColor ?? detail.color}
      transparent={opacity < 1}
      opacity={opacity}
      roughness={detail.roughness ?? 0.35}
      metalness={detail.metalness ?? 0.08}
      emissive={simulationColor ?? detail.emissive ?? '#000000'}
      emissiveIntensity={
        simulationColor && simulationRisk !== null
          ? 0.08 + simulationRisk * 0.18
          : detail.emissive ? 0.8 : 0
      }
    />
  )

  return (
    <mesh position={detail.position} rotation={detail.rotation}>
      {detail.geometry === 'cylinder' && (
        <cylinderGeometry args={[detail.scale[0], detail.scale[2], detail.scale[1], 28]} />
      )}
      {detail.geometry === 'sphere' && (
        <sphereGeometry args={[detail.scale[0], 24, 12]} />
      )}
      {detail.geometry === 'torus' && (
        <torusGeometry args={[detail.scale[0], detail.scale[1], 16, 48]} />
      )}
      {detail.geometry === 'box' && (
        <boxGeometry args={detail.scale} />
      )}
      {material}
    </mesh>
  )
}

export function BuildGuardNode() {
  const groupRef = useRef<THREE.Group>(null)
  const rotationAngle = useRef(0)
  const lastTime = useRef<number | null>(null)
  const snapTarget = useRef<number | null>(null)
  const cameraSnapTarget = useRef<THREE.Vector3 | null>(null)
  const controls = useThree((state) => state.controls) as { target: THREE.Vector3 } | null
  const viewMode = useProjectStore((s) => s.viewMode)
  const highlightedComponentId = useProjectStore((s) => s.highlightedComponentId)
  const activeWarning = useProjectStore((s) => s.activeWarning)
  const fixApplied = useProjectStore((s) => s.fixApplied)
  const rotationPaused = useProjectStore((s) => s.rotationPaused)
  const setRotationPaused = useProjectStore((s) => s.setRotationPaused)
  const sceneComponents = useProjectStore((s) => s.sceneComponents)
  const simulation = useProjectStore((s) => s.simulation)
  const componentPositions = new Map(sceneComponents.map((comp) => [comp.id, comp.position]))
  const showSimulationColors = simulation.status !== 'idle' && Object.keys(simulation.risksByComponent).length > 0

  useEffect(() => {
    if (!highlightedComponentId) {
      // Deselect: reset camera target to origin in explode mode
      if (viewMode === 'explode') cameraSnapTarget.current = new THREE.Vector3(0, 0, 0)
      return
    }
    const comp = sceneComponents.find((c) => c.id === highlightedComponentId)
    if (!comp) return

    const [bx, by, bz] = comp.position
    const [ox, oy, oz] = comp.explodeOffset

    // In explode mode use the full exploded position for the snap angle
    const sx = viewMode === 'explode' ? bx + ox : bx
    const sz = viewMode === 'explode' ? bz + oz : bz

    if (Math.sqrt(sx * sx + sz * sz) > 0.01) {
      const target = -Math.atan2(sx, sz)
      const current = rotationAngle.current
      const delta = ((target - current) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI
      snapTarget.current = current + delta
    }

    if (viewMode !== 'explode') {
      setRotationPaused(true)
    } else {
      // After snap the component will be at world (0, ey, r) — orbit around it
      const ex = bx + ox
      const ey = by + oy
      const ez = bz + oz
      const r = Math.sqrt(ex * ex + ez * ez)
      cameraSnapTarget.current = new THREE.Vector3(0, ey, r)
    }
  }, [highlightedComponentId, sceneComponents, viewMode, setRotationPaused])

  // Reset orbit target when leaving explode mode
  useEffect(() => {
    if (viewMode !== 'explode') cameraSnapTarget.current = new THREE.Vector3(0, 0, 0)
  }, [viewMode])

  useFrame(({ clock }) => {
    if (!groupRef.current) return
    const now = clock.getElapsedTime()

    // Smooth camera orbit target
    if (cameraSnapTarget.current && controls?.target) {
      controls.target.lerp(cameraSnapTarget.current, 0.07)
      if (controls.target.distanceTo(cameraSnapTarget.current) < 0.005) {
        controls.target.copy(cameraSnapTarget.current)
        cameraSnapTarget.current = null
      }
    }

    if (snapTarget.current !== null) {
      rotationAngle.current = THREE.MathUtils.lerp(rotationAngle.current, snapTarget.current, 0.07)
      groupRef.current.rotation.y = rotationAngle.current
      if (Math.abs(rotationAngle.current - snapTarget.current) < 0.003) {
        rotationAngle.current = snapTarget.current
        snapTarget.current = null
      }
      lastTime.current = null
      return
    }

    if (viewMode === 'explode' || rotationPaused) {
      lastTime.current = null
      return
    }
    if (lastTime.current !== null) {
      rotationAngle.current += (now - lastTime.current) * 0.15
    }
    lastTime.current = now
    groupRef.current.rotation.y = rotationAngle.current
  })

  if (sceneComponents.length === 0) return null

  return (
    <group ref={groupRef}>
      {sceneComponents.map((comp) => (
        <ComponentMesh
          key={comp.id}
          comp={comp}
          viewMode={viewMode}
          isHighlighted={highlightedComponentId === comp.id}
          isWarning={activeWarning?.affectedComponents.includes(comp.id) ?? false}
          fixApplied={fixApplied}
          simulationRisk={
            showSimulationColors && TRAINED_WORLD_MODEL_COMPONENT_IDS.has(comp.id)
              ? simulation.risksByComponent[comp.id] ?? 0
              : null
          }
          simulationDetails={
            showSimulationColors && TRAINED_WORLD_MODEL_COMPONENT_IDS.has(comp.id)
              ? simulation.detailsByComponent[comp.id] ?? null
              : null
          }
          parentPosition={
            comp.assembly?.parentSceneId
              ? componentPositions.get(comp.assembly.parentSceneId)
              : undefined
          }
        />
      ))}
    </group>
  )
}
