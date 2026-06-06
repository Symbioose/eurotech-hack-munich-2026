'use client'
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Line, RoundedBox, Text } from '@react-three/drei'
import * as THREE from 'three'
import { useProjectStore } from '@/lib/store'
import type { Component3D } from '@/lib/types'
import { getPartDetails, type PartDetail } from '@/lib/scene/part-details'

type ComponentMeshProps = {
  comp: Component3D
  viewMode: string
  isHighlighted: boolean
  isWarning: boolean
  fixApplied: boolean
  parentPosition?: [number, number, number]
}

function ComponentMesh({ comp, viewMode, isHighlighted, isWarning, fixApplied, parentPosition }: ComponentMeshProps) {
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
  const color = isWarning && !fixApplied ? '#ef4444' : isHighlighted ? '#3b82f6' : comp.color

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
          />
        )}
        {details.map((detail, index) => (
          <DetailMesh key={`${detail.role}-${index}`} detail={detail} />
        ))}
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
}: {
  comp: Component3D
  color: string
  opacity: number
  wireframe: boolean
}) {
  const material = (
    <meshStandardMaterial
      color={color}
      transparent={opacity < 1}
      opacity={opacity}
      roughness={comp.id === 'enclosure' ? 0.55 : 0.34}
      metalness={comp.id === 'bracket' || comp.id === 'fasteners' ? 0.8 : 0.12}
      wireframe={wireframe}
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

function DetailMesh({ detail }: { detail: PartDetail }) {
  const opacity = detail.opacity ?? 1
  const material = (
    <meshStandardMaterial
      color={detail.color}
      transparent={opacity < 1}
      opacity={opacity}
      roughness={detail.roughness ?? 0.35}
      metalness={detail.metalness ?? 0.08}
      emissive={detail.emissive ?? '#000000'}
      emissiveIntensity={detail.emissive ? 0.8 : 0}
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
  const viewMode = useProjectStore((s) => s.viewMode)
  const highlightedComponentId = useProjectStore((s) => s.highlightedComponentId)
  const activeWarning = useProjectStore((s) => s.activeWarning)
  const fixApplied = useProjectStore((s) => s.fixApplied)
  const sceneComponents = useProjectStore((s) => s.sceneComponents)
  const componentPositions = new Map(sceneComponents.map((comp) => [comp.id, comp.position]))

  useFrame(({ clock }) => {
    if (!groupRef.current || viewMode === 'explode') return
    groupRef.current.rotation.y = clock.getElapsedTime() * 0.15
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
