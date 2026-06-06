'use client'
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import { useProjectStore } from '@/lib/store'
import type { Component3D } from '@/lib/types'

type ComponentMeshProps = {
  comp: Component3D
  viewMode: string
  isHighlighted: boolean
  isWarning: boolean
  fixApplied: boolean
}

function ComponentMesh({ comp, viewMode, isHighlighted, isWarning, fixApplied }: ComponentMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null)
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
    if (!meshRef.current) return
    targetVec.current.set(targetPos[0], targetPos[1], targetPos[2])
    meshRef.current.position.lerp(targetVec.current, 0.08)
  })

  const opacity = viewMode === 'xray' && comp.id === 'enclosure' ? 0.15 : 1
  const color = isWarning && !fixApplied ? '#ef4444' : isHighlighted ? '#3b82f6' : comp.color

  const labelY = targetPos[1] + (comp.scale[1] ?? 0.5) / 2 + 0.15

  return (
    <group>
      <mesh
        ref={meshRef}
        position={comp.position}
        onClick={(e) => { e.stopPropagation(); setHighlighted(comp.id) }}
      >
        {comp.geometry === 'cylinder' ? (
          <cylinderGeometry args={[comp.scale[0], comp.scale[0], comp.scale[1], 16]} />
        ) : (
          <boxGeometry args={comp.scale} />
        )}
        <meshStandardMaterial
          color={color}
          transparent={opacity < 1}
          opacity={opacity}
          roughness={0.4}
          metalness={comp.id === 'bracket' ? 0.8 : 0.1}
          wireframe={viewMode === 'xray' && comp.id !== 'enclosure'}
        />
      </mesh>
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

export function BuildGuardNode() {
  const groupRef = useRef<THREE.Group>(null)
  const viewMode = useProjectStore((s) => s.viewMode)
  const highlightedComponentId = useProjectStore((s) => s.highlightedComponentId)
  const activeWarning = useProjectStore((s) => s.activeWarning)
  const fixApplied = useProjectStore((s) => s.fixApplied)
  const sceneComponents = useProjectStore((s) => s.sceneComponents)

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
        />
      ))}
    </group>
  )
}
