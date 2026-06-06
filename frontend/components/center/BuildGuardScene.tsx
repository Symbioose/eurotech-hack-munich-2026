'use client'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment } from '@react-three/drei'
import { Suspense } from 'react'
import { BuildGuardNode } from './BuildGuardNode'
import { useProjectStore } from '@/lib/store'

export function BuildGuardScene() {
  const showNode = useProjectStore((s) => s.showNode)

  return (
    <Canvas
      camera={{ position: [0, 1, 4], fov: 45 }}
      style={{ width: '100%', height: '100%' }}
      gl={{ antialias: true, alpha: true }}
    >
      <color attach="background" args={['#0a0a0a']} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 5, 5]} intensity={1} />
      <pointLight position={[-5, -5, -5]} intensity={0.3} color="#3b82f6" />
      <Suspense fallback={null}>
        {showNode && <BuildGuardNode />}
        <Environment preset="night" />
      </Suspense>
      <OrbitControls
        makeDefault
        enablePan={false}
        minDistance={2}
        maxDistance={8}
      />
    </Canvas>
  )
}
