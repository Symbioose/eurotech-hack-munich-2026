'use client'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'

type Props = {
  onComplete?: () => void
}

export function HeroScene({ onComplete }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const progressRef = useRef(0)
  const onCompleteRef = useRef(onComplete)
  const completedRef = useRef(false)
  onCompleteRef.current = onComplete

  useEffect(() => {
    const cv = canvasRef.current
    if (!cv) return

    const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.2

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 200)
    camera.position.set(0, 14, 26)
    camera.lookAt(0, 2, 0)

    scene.add(new THREE.AmbientLight(0xffffff, 0.6))
    const key = new THREE.DirectionalLight(0xffffff, 2.5)
    key.position.set(6, 14, 8)
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    scene.add(key)
    const fill = new THREE.DirectionalLight(0xffffff, 0.8)
    fill.position.set(-8, 6, -6)
    scene.add(fill)
    const rim = new THREE.DirectionalLight(0xffffff, 1.2)
    rim.position.set(0, 8, -12)
    scene.add(rim)
    const ptNode = new THREE.PointLight(0xffffff, 4, 18)
    ptNode.position.set(0, 6, 0)
    scene.add(ptNode)

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 80),
      new THREE.MeshStandardMaterial({ color: 0xf0efe8, roughness: 1, metalness: 0 })
    )
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    scene.add(floor)

    const gridMat = new THREE.LineBasicMaterial({ color: 0xddddd5, transparent: true, opacity: 0.6 })
    const gs = 60, gd = 30
    for (let i = 0; i <= gd; i++) {
      const t = (i / gd - 0.5) * gs
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-gs / 2, 0.01, t), new THREE.Vector3(gs / 2, 0.01, t)]), gridMat))
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(t, 0.01, -gs / 2), new THREE.Vector3(t, 0.01, gs / 2)]), gridMat))
    }

    const bData: { mesh: THREE.Mesh; el: THREE.LineSegments; targetY: number; h: number; delay: number }[] = []
    const bMat = () => new THREE.MeshStandardMaterial({ color: 0xe8e7e0, roughness: 0.85, metalness: 0.05, emissive: 0x111111, emissiveIntensity: 0.05 })
    const bEdgeMat = new THREE.LineBasicMaterial({ color: 0xcccccc, transparent: true, opacity: 0.7 })

    const positions: [number, number, number][] = []
    for (let i = -5; i <= 5; i++) {
      for (let j = -5; j <= 5; j++) {
        if (Math.abs(i) <= 1 && Math.abs(j) <= 1) continue
        const d = Math.sqrt(i * i + j * j)
        if (Math.random() < 0.1 && d > 3) continue
        positions.push([i * 2.8 + Math.random() * 0.5 - 0.25, j * 2.8 + Math.random() * 0.5 - 0.25, d])
      }
    }

    positions.forEach(([x, z, dist], i) => {
      const h = Math.max(0.8, (5.5 - dist * 0.4) + Math.random() * 5)
      const w = 0.6 + Math.random() * 1.4, d = 0.6 + Math.random() * 1.4
      const geo = new THREE.BoxGeometry(w, h, d)
      const mesh = new THREE.Mesh(geo, bMat())
      mesh.position.set(x, -h, z)
      mesh.castShadow = true
      mesh.receiveShadow = true
      scene.add(mesh)
      const el = new THREE.LineSegments(new THREE.EdgesGeometry(geo), bEdgeMat.clone())
      el.position.set(x, -h, z)
      scene.add(el)
      bData.push({ mesh, el, targetY: h / 2, h, delay: i / positions.length })
    })

    const nodeGroup = new THREE.Group()
    nodeGroup.position.set(0, 7, 0)
    scene.add(nodeGroup)

    const M = (c: number, r = 0.25, m = 0.7, e = 0x111111, ei = 0.1) =>
      new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, emissive: e, emissiveIntensity: ei })

    const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.72, 1.0), M(0xfafaf8, 0.15, 0.8, 0x333333, 0.08))
    body.castShadow = true
    nodeGroup.add(body)

    const panel = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.1, 0.5), M(0x222222, 0.4, 0.3, 0x000000, 0.2))
    panel.position.set(0, 0.31, 0.1)
    nodeGroup.add(panel)

    const led1 = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 5, roughness: 0 }))
    led1.position.set(-0.55, 0.32, 0.1)
    nodeGroup.add(led1)
    const led2 = led1.clone()
    led2.position.set(-0.42, 0.32, 0.1)
    nodeGroup.add(led2)

    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.0, 8), M(0xdddddd, 0.1, 0.95, 0x444444, 0.05))
    ant.position.set(0.55, 0.86, 0)
    ant.castShadow = true
    nodeGroup.add(ant)

    const antBall = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 12), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 4, roughness: 0 }))
    antBall.position.set(0.55, 1.38, 0)
    nodeGroup.add(antBall)

    const sens = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.2, 24), M(0xcccccc, 0.3, 0.5, 0x222222, 0.1))
    sens.position.set(-0.38, 0, 0.52)
    sens.rotation.x = Math.PI / 2
    nodeGroup.add(sens)

    const sensLens = new THREE.Mesh(new THREE.CircleGeometry(0.14, 24), M(0x111111, 0.05, 0.0, 0x333333, 0.3))
    sensLens.position.set(-0.38, 0, 0.63)
    nodeGroup.add(sensLens)

    const mount = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.8, 0.12), M(0xaaaaaa, 0.5, 0.4))
    mount.position.set(0, -0.76, 0)
    nodeGroup.add(mount)

    const base = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.08, 0.6), M(0xbbbbbb, 0.6, 0.3))
    base.position.set(0, -1.2, 0)
    nodeGroup.add(base)

    const ring1 = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.012, 8, 80), new THREE.MeshStandardMaterial({ color: 0x888888, emissive: 0x444444, emissiveIntensity: 0.5, transparent: true, opacity: 0 }))
    ring1.rotation.x = Math.PI / 2
    nodeGroup.add(ring1)

    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(2.9, 0.008, 8, 80), new THREE.MeshStandardMaterial({ color: 0x666666, emissive: 0x333333, emissiveIntensity: 0.4, transparent: true, opacity: 0 }))
    ring2.rotation.x = Math.PI / 3
    nodeGroup.add(ring2)

    const nodeParts = [
      { mesh: body, start: new THREE.Vector3(-9, 3, 1) },
      { mesh: panel, start: new THREE.Vector3(-9, 4, 1) },
      { mesh: ant, start: new THREE.Vector3(7, 5, 2) },
      { mesh: antBall, start: new THREE.Vector3(7, 5, 2) },
      { mesh: sens, start: new THREE.Vector3(-7, 1, -4) },
      { mesh: sensLens, start: new THREE.Vector3(-7, 1, -4) },
      { mesh: mount, start: new THREE.Vector3(0, -5, 0) },
      { mesh: base, start: new THREE.Vector3(0, -6, 0) },
      { mesh: led1, start: new THREE.Vector3(-9, 4, 1) },
      { mesh: led2, start: new THREE.Vector3(-9, 4, 1) },
    ]
    nodeParts.forEach((p) => p.mesh.position.copy(p.start))

    const connLines: { line: THREE.Line; mat: THREE.LineBasicMaterial; to: THREE.Vector3; dot: THREE.Mesh; t: number; speed: number }[] = []
    let linesSpawned = false

    function spawnLines() {
      const nw = new THREE.Vector3()
      nodeGroup.getWorldPosition(nw)
      bData.filter((b) => b.mesh.position.y > 0).slice(0, 10).forEach((b) => {
        const to = new THREE.Vector3(b.mesh.position.x, b.targetY + b.h * 0.5, b.mesh.position.z)
        const geo = new THREE.BufferGeometry().setFromPoints([nw.clone(), to])
        const mat = new THREE.LineBasicMaterial({ color: 0x999999, transparent: true, opacity: 0 })
        const line = new THREE.Line(geo, mat)
        scene.add(line)
        const dot = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x555555, emissiveIntensity: 2 }))
        dot.position.copy(to)
        scene.add(dot)
        connLines.push({ line, mat, to, dot, t: 0, speed: 0.35 + Math.random() * 0.25 })
      })
    }

    function eio(t: number) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t }
    function lerp(a: number, b: number, t: number) { return a + (b - a) * t }

    const clock = new THREE.Clock()
    let elapsed = 0
    let animId: number

    function animate() {
      animId = requestAnimationFrame(animate)
      const dt = Math.min(clock.getDelta(), 0.05)
      elapsed += dt
      const p = progressRef.current

      const p1 = Math.min(1, p / 0.38)
      const p2 = Math.min(1, Math.max(0, (p - 0.38) / 0.28))
      const p3 = Math.min(1, Math.max(0, (p - 0.66) / 0.34))
      const e1 = eio(p1), e2 = eio(p2), e3 = eio(p3)

      nodeParts.forEach((part, i) => {
        const frac = Math.min(1, Math.max(0, (e1 - i * 0.06) * 1.8))
        part.mesh.position.lerpVectors(part.start, new THREE.Vector3(0, 0, 0), frac)
      })

      nodeGroup.rotation.y += dt * (0.35 + e2 * 0.8)
      nodeGroup.position.y = lerp(7, 2.8, e2)
      ring1.rotation.z += dt * 0.5
      ring2.rotation.z -= dt * 0.35
      ring1.material.opacity = lerp(0, 0.55, e2)
      ring2.material.opacity = lerp(0, 0.4, e2)

      const pulse = 0.5 + Math.sin(elapsed * 2.5) * 0.5
      ptNode.intensity = lerp(1, 3 + pulse * 2, e2)
      antBall.material.emissiveIntensity = 3 + pulse * 5
      led1.material.emissiveIntensity = 3 + Math.sin(elapsed * 4) * 3
      led2.material.emissiveIntensity = 3 + Math.sin(elapsed * 4 + 1.2) * 3

      bData.forEach((b) => {
        const frac = Math.min(1, Math.max(0, (e3 - b.delay * 0.55) * 2.8))
        const cy = lerp(-b.h, b.targetY, frac)
        b.mesh.position.y = cy
        b.el.position.y = cy
        ;(b.mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.03 + frac * 0.08
      })

      if (p3 > 0.75 && !linesSpawned) {
        linesSpawned = true
        spawnLines()
      }

      connLines.forEach((cl) => {
        cl.t = Math.min(1, cl.t + dt * cl.speed)
        cl.mat.opacity = Math.min(0.4, cl.t * 1.5)
        const nw = new THREE.Vector3()
        nodeGroup.getWorldPosition(nw)
        const mid = new THREE.Vector3().lerpVectors(nw, cl.to, cl.t)
        cl.line.geometry.setFromPoints([nw, mid])
        cl.dot.position.copy(mid)
      })

      const bar = document.getElementById('hero-progress')
      if (bar) bar.style.width = (p * 100) + '%'

      if (p >= 0.98 && !completedRef.current) {
        completedRef.current = true
        onCompleteRef.current?.()
      }

      camera.position.x = Math.sin(elapsed * 0.05) * 2.5
      camera.position.z = 26 + Math.cos(elapsed * 0.04) * 1.5
      camera.lookAt(0, 3, 0)
      renderer.render(scene, camera)
    }

    animate()

    function onWheel(e: WheelEvent) {
      if (progressRef.current < 1) {
        e.preventDefault()
        progressRef.current = Math.min(1, Math.max(0, progressRef.current + e.deltaY * 0.0007))
      }
    }

    let touchY = 0
    function onTouchStart(e: TouchEvent) { touchY = e.touches[0].clientY }
    function onTouchMove(e: TouchEvent) {
      const dy = touchY - e.touches[0].clientY
      touchY = e.touches[0].clientY
      progressRef.current = Math.min(1, Math.max(0, progressRef.current + dy * 0.003))
    }

    function onResize() {
      renderer.setSize(window.innerWidth, window.innerHeight)
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
    }

    window.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(animId)
      renderer.dispose()
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{ display: 'block', width: '100vw', height: '100vh' }}
    />
  )
}
