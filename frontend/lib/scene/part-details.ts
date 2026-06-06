type Vec3 = [number, number, number]

export type PartDetail = {
  role: string
  geometry: 'box' | 'cylinder' | 'sphere' | 'torus'
  position: Vec3
  rotation?: Vec3
  scale: Vec3
  color: string
  opacity?: number
  metalness?: number
  roughness?: number
  emissive?: string
}

function box(role: string, position: Vec3, scale: Vec3, color: string): PartDetail {
  return { role, geometry: 'box', position, scale, color, roughness: 0.35 }
}

function cylinder(
  role: string,
  position: Vec3,
  scale: Vec3,
  color: string,
  rotation: Vec3 = [Math.PI / 2, 0, 0]
): PartDetail {
  return { role, geometry: 'cylinder', position, rotation, scale, color, metalness: 0.25, roughness: 0.3 }
}

function sphere(role: string, position: Vec3, scale: Vec3, color: string): PartDetail {
  return { role, geometry: 'sphere', position, scale, color, roughness: 0.25 }
}

function torus(role: string, position: Vec3, scale: Vec3, color: string): PartDetail {
  return { role, geometry: 'torus', position, rotation: [Math.PI / 2, 0, 0], scale, color, roughness: 0.4 }
}

export function getPartDetails(partId: string, scale: Vec3): PartDetail[] {
  const sx = scale[0]
  const sy = scale[1]
  const sz = scale[2]
  const frontZ = sz / 2 + 0.012

  switch (partId) {
    case 'enclosure':
      return [
        box('front-panel', [0, 0, frontZ], [sx * 0.78, sy * 0.76, 0.018], '#0f172a'),
        ...[-1, 1].flatMap((x) =>
          [-1, 1].map((y) =>
            cylinder('screw-head', [x * sx * 0.41, y * sy * 0.39, frontZ + 0.018], [0.035, 0.012, 0.035], '#94a3b8')
          )
        ),
        ...[-0.18, 0, 0.18].map((x) =>
          box('vent-slot', [x, -sy * 0.25, frontZ + 0.018], [0.11, 0.018, 0.012], '#38bdf8')
        ),
        sphere('status-led', [sx * 0.29, sy * 0.26, frontZ + 0.025], [0.026, 0.026, 0.026], '#22c55e'),
      ]
    case 'compute':
      return [
        box('processor-chip', [-sx * 0.18, 0.02, sz / 2 + 0.016], [0.18, 0.14, 0.025], '#111827'),
        box('radio-shield', [sx * 0.2, -0.02, sz / 2 + 0.016], [0.16, 0.12, 0.022], '#d1d5db'),
        ...[-0.18, 0, 0.18].map((x) =>
          box('copper-trace', [x, sy * 0.27, sz / 2 + 0.018], [0.11, 0.01, 0.008], '#f59e0b')
        ),
      ]
    case 'battery':
      return [
        box('terminal', [-sx * 0.24, sy * 0.44, sz / 2 + 0.012], [0.08, 0.035, 0.018], '#f8fafc'),
        box('terminal', [sx * 0.24, sy * 0.44, sz / 2 + 0.012], [0.08, 0.035, 0.018], '#f8fafc'),
        box('charge-band', [0, 0, sz / 2 + 0.014], [sx * 0.78, 0.026, 0.016], '#84cc16'),
      ]
    case 'radio':
      return [
        box('rf-shield', [0, 0, sz / 2 + 0.015], [sx * 0.58, sy * 0.5, 0.018], '#e5e7eb'),
        cylinder('antenna', [sx * 0.58, 0, 0], [0.018, sx * 0.65, 0.018], '#e11d48', [0, 0, Math.PI / 2]),
      ]
    case 'bracket':
      return [
        ...[-1, 1].flatMap((x) =>
          [-1, 1].map((y) =>
            cylinder('mounting-hole', [x * sx * 0.34, y * sy * 0.36, sz / 2 + 0.014], [0.055, 0.018, 0.055], '#111827')
          )
        ),
      ]
    case 'solar':
      return [
        ...[-0.3, 0, 0.3].map((x) =>
          box('solar-cell', [x, sy / 2 + 0.015, 0], [sx * 0.21, 0.016, sz * 0.86], '#0f172a')
        ),
        ...[-0.18, 0.18].map((z) =>
          box('solar-trace', [0, sy / 2 + 0.02, z], [sx * 0.84, 0.012, 0.01], '#67e8f9')
        ),
      ]
    case 'gasket':
      return [
        box('gasket-ring', [0, sy * 0.48, sz / 2 + 0.012], [sx, 0.045, 0.018], '#22c55e'),
        box('gasket-ring', [0, -sy * 0.48, sz / 2 + 0.012], [sx, 0.045, 0.018], '#22c55e'),
        box('gasket-ring', [sx * 0.48, 0, sz / 2 + 0.012], [0.045, sy, 0.018], '#22c55e'),
        box('gasket-ring', [-sx * 0.48, 0, sz / 2 + 0.012], [0.045, sy, 0.018], '#22c55e'),
      ]
    case 'membrane':
      return [
        cylinder('membrane-disc', [0, 0, sz / 2 + 0.01], [sx * 0.55, 0.018, sx * 0.55], '#bef264'),
        sphere('pressure-dot', [0, 0, sz / 2 + 0.028], [0.018, 0.018, 0.018], '#f7fee7'),
      ]
    case 'drainage-lip':
      return [
        box('drain-channel', [0, 0, sz / 2 + 0.018], [sx * 0.82, sy * 0.45, 0.018], '#052e16'),
        ...[-0.25, 0, 0.25].map((x) =>
          box('weep-hole', [x, 0, sz / 2 + 0.035], [0.06, sy * 0.26, 0.012], '#bbf7d0')
        ),
      ]
    case 'fasteners':
      return [-1, 1].flatMap((x) =>
        [-1, 1].map((y) =>
          cylinder('fastener-head', [x * sx * 0.38, y * sy * 0.42, sz / 2 + 0.012], [0.055, 0.018, 0.055], '#e2e8f0')
        )
      )
    case 'crack-sensor':
      return [
        box('probe-tip', [0, sy * 0.42, sz / 2 + 0.018], [sx * 0.72, 0.045, 0.018], '#bfdbfe'),
        box('probe-tip', [0, -sy * 0.42, sz / 2 + 0.018], [sx * 0.72, 0.045, 0.018], '#bfdbfe'),
      ]
    case 'vibration-sensor':
    case 'tilt-sensor':
    case 'moisture-sensor':
    case 'mmwave':
    case 'air-quality':
      return [
        sphere('sensor-aperture', [0, 0, sz / 2 + 0.018], [sx * 0.28, sx * 0.28, sx * 0.28], '#e0f2fe'),
        box('sensor-label-strip', [0, -sy * 0.34, sz / 2 + 0.016], [sx * 0.72, 0.018, 0.014], '#bae6fd'),
      ]
    case 'cable-gland':
      return [
        torus('gland-collar', [0, 0, sz / 2 + 0.012], [sx * 0.48, 0.014, sx * 0.48], '#cbd5e1'),
        cylinder('cable-stub', [0, 0, sz / 2 + 0.12], [sx * 0.3, 0.2, sx * 0.3], '#111827'),
      ]
    default:
      return []
  }
}
