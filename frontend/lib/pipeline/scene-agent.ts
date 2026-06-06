import type {
  BOM,
  ComponentCatalog,
  ComponentGraph,
  DeploymentContext,
  DfmaResult,
  SceneGraph,
  SceneNode,
} from './types'
import { extractJsonObject } from './parse-json'
import { callJsonAgent, hasOpenAIKey } from './llm'
import { resolveScene } from './scene-resolver'

const VALID_GEOMETRIES = new Set(['box', 'cylinder', 'sphere'])

const SYSTEM = `You are the 3D Scene Agent for Physical Cursor.

You receive a smart-city hardware node description — deployment context, selected components with their physical category, BOM and DfMA risks — and you output a 3D scene graph for React Three Fiber.

Your job is to design a physically plausible layout for the assembled hardware node so engineers and investors can visualise how the components fit together.

---

COORDINATE SYSTEM
- Origin [0, 0, 0] is the centre of the assembled device.
- Y axis is UP. Positive Y = top of device.
- Z axis faces the VIEWER. Positive Z = front face (what the camera sees first).
- X axis is RIGHT.

ENCLOSURE IS THE REFERENCE
- The enclosure (category: enclosure) is ALWAYS at position [0, 0, 0] and explodeOffset [0, 0, 0].
- Its scale defines the bounding box of the device. Typical enclosure scale: [1.2, 1.6, 0.8].
- All internal components must stay within the enclosure half-extents (±0.55 X, ±0.75 Y, ±0.35 Z).
- External sensors that probe the surface or environment can exceed those bounds (Z > 0.4).

PHYSICAL PLACEMENT RULES
- Battery (category: power, battery tag): heavy, bottom of device — Y < −0.3, Z near 0.
- Compute board (category: compute): central flat PCB — near [0, 0, 0.1], small Z scale.
- Radio / LoRa / NB-IoT (category: connectivity): near an edge — |X| > 0.2, inside enclosure.
- Structural sensors (crack, tilt, vibration): these contact the structure — Z ≈ 0.35–0.45, may exceed enclosure face.
- Environmental sensors (moisture, air, temperature): at a vent port on the front face — Z ≈ 0.38–0.42, spread around the face.
- Mounting bracket (category: mechanical, mounting tag): flat plate behind the device — Z ≈ −0.5, explodeOffset Z ≈ −2.0.
- Fix components (category: fix): thin elements on the enclosure surface or near the component they fix.
  - Gasket: thin flat cylinder on the enclosure lip — Y near top, Z ≈ 0.35.
  - Membrane: small thin disc at a sensor port — near the moisture/crack sensor.
  - Drainage lip: thin strip at the bottom of the enclosure front face — Y ≈ −0.75, Z ≈ 0.35.
- Solar panel (solar tag): top of device, angled forward — Y ≈ 0.9, Z ≈ 0.4.

EXPLODE OFFSETS
When "Explode" mode is active, each component shifts by its explodeOffset so the internal structure is readable.
- Offsets are ADDED to position. Move each component clearly away from origin.
- Inner components: 1.0–1.6 units in their dominant axis.
- External sensors: 1.2–2.0 units forward (+Z) and sideways.
- Bracket: −1.8 to −2.2 on Z.
- Enclosure: always [0, 0, 0].
- Make sure no two components share the same explode target — spread them clearly.

SCALE [width, height, depth]
- Enclosure: largest element, ~[1.2, 1.6, 0.8]
- Compute board: flat PCB, ~[0.6–0.8, 0.4–0.6, 0.04–0.07]
- Battery: rectangular pack, ~[0.7–0.9, 0.35–0.5, 0.25–0.35]
- Radio module: small PCB, ~[0.25–0.35, 0.12–0.18, 0.06–0.10]
- Small sensors (tilt, moisture, temperature): ~[0.08–0.15, 0.12–0.25, 0.08–0.15]
- Medium sensors (vibration, air quality): ~[0.18–0.28, 0.14–0.22, 0.08–0.14]
- Crack sensor (probe-style): ~[0.12–0.18, 0.4–0.6, 0.08–0.12]
- Bracket: wide thin plate, ~[1.2–1.6, 0.08–0.15, 0.5–0.7]
- Gasket: thin flat ring (cylinder), ~[0.5–0.65, 0.03–0.06, 0.5–0.65]
- Membrane: small thin disc (box), ~[0.1–0.14, 0.1–0.14, 0.015–0.025]
- Drainage lip: thin strip (box), ~[0.7–1.0, 0.04–0.08, 0.15–0.25]

COLORS (hardware conventions — use these as a guide, adapt to the device)
- Enclosure: dark slate #334155 or #1e293b
- Compute / MCU board: amber #b45309 or PCB green #166534
- Battery: dark green #4d7c0f
- Radio / LoRa / connectivity: crimson #be123c
- Structural sensors (crack, vibration, tilt): blues — #1d4ed8, #7c3aed, #0891b2
- Environmental sensors (moisture, air, temperature): teals/greens — #059669, #0d9488, #65a30d
- Presence sensors (PIR, mmWave): violet #8b5cf6 or indigo #6366f1
- Mounting bracket: medium grey #6b7280
- Fix components: bright green #22c55e, #16a34a, #a3e635 (they are new additions, make them stand out)
- Solar panel: dark teal #155e75
- Camera: red #dc2626
- PoE module: teal #0f766e

GEOMETRY
- "box" for enclosures, PCBs, batteries, brackets, rectangular sensors, membrane, drainage.
- "cylinder" for round sensors, cable glands, gaskets (thin flat cylinder with equal X and Z scale).
- "sphere" only for very small indicator nodes.

---

OUTPUT — return ONLY valid JSON, no markdown, no explanation:
{
  "nodes": [
    {
      "component_id": string,
      "scene_id": string,
      "label": string,
      "position": [x, y, z],
      "explodeOffset": [x, y, z],
      "color": string,
      "geometry": "box" | "cylinder" | "sphere",
      "scale": [w, h, d]
    }
  ]
}

Include a node for EVERY component_id listed in the input. Do not add ids that are not in the list.
Use the scene_id provided for each component EXACTLY as given — do not rename or reslug it.`

type ComponentSummary = {
  id: string
  scene_id: string
  part: string
  category: string
  tags: string[]
}

function buildUserMessage(
  ctx: DeploymentContext,
  componentGraph: ComponentGraph,
  bom: BOM,
  dfma: DfmaResult,
  catalog: ComponentCatalog
): string {
  const catalogById = new Map(catalog.components.map((c) => [c.id, c]))

  const components: ComponentSummary[] = componentGraph.selected_component_ids.map((id) => {
    const entry = catalogById.get(id)
    return {
      id,
      scene_id: entry?.scene?.scene_id ?? id,
      part: entry?.part ?? id,
      category: entry?.category ?? 'unknown',
      tags: entry?.tags ?? [],
    }
  })

  const atRiskIds = new Set(dfma.warnings.flatMap((w) => w.affected_component_ids))

  const payload = {
    deployment: {
      site: ctx.site,
      surface: ctx.surface,
      environment: ctx.environment,
      mounting: ctx.mounting,
      goal: ctx.goal,
    },
    selected_components: components,
    bom_total_usd: bom.total_cost_usd,
    dfma_warnings: dfma.warnings.map((w) => ({
      title: w.title,
      severity: w.severity,
      affected_component_ids: w.affected_component_ids,
    })),
    at_risk_component_ids: [...atRiskIds],
  }

  return JSON.stringify(payload, null, 2)
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function toVec3(raw: unknown): [number, number, number] {
  if (!Array.isArray(raw) || raw.length < 3) return [0, 0, 0]
  return [
    clamp(Number(raw[0]) || 0, -5, 5),
    clamp(Number(raw[1]) || 0, -5, 5),
    clamp(Number(raw[2]) || 0, -5, 5),
  ]
}

function toGeometry(raw: unknown): 'box' | 'cylinder' | 'sphere' {
  return VALID_GEOMETRIES.has(raw as string) ? (raw as 'box' | 'cylinder' | 'sphere') : 'box'
}

function toHexColor(raw: unknown): string {
  if (typeof raw === 'string' && /^#[0-9a-fA-F]{3,6}$/.test(raw)) return raw
  return '#64748b'
}

export function validateSceneGraph(
  raw: unknown,
  componentGraph: ComponentGraph,
  catalog: ComponentCatalog
): SceneGraph {
  // Catalog fallback for any node the LLM missed or generated invalid data for
  const fallback = resolveScene(componentGraph, catalog)
  const fallbackById = new Map(fallback.nodes.map((n) => [n.component_id, n]))

  const validNodes: SceneNode[] = []
  const covered = new Set<string>()

  const maybeNodes =
    raw && typeof raw === 'object' && Array.isArray((raw as { nodes?: unknown }).nodes)
      ? (raw as { nodes: unknown[] }).nodes
      : []

  for (const node of maybeNodes) {
    if (!node || typeof node !== 'object') continue
    const n = node as Record<string, unknown>
    const id = typeof n.component_id === 'string' ? n.component_id : null
    if (!id || !componentGraph.selected_component_ids.includes(id)) continue
    if (covered.has(id)) continue

    const fb = fallbackById.get(id)
    covered.add(id)
    validNodes.push({
      component_id: id,
      scene_id: fb?.scene_id ?? (typeof n.scene_id === 'string' && n.scene_id ? n.scene_id : id),
      label: typeof n.label === 'string' && n.label ? n.label : fb?.label ?? id,
      position: toVec3(n.position),
      explodeOffset: toVec3(n.explodeOffset),
      color: toHexColor(n.color),
      geometry: toGeometry(n.geometry),
      scale: toVec3(n.scale),
      assembly: fb?.assembly ?? {
        placement: 'external',
        parent_scene_id: 'enclosure',
        anchor_face: 'front',
        contact: 'surface-mounted',
      },
    })
  }

  // Fill any missing components from catalog fallback
  for (const id of componentGraph.selected_component_ids) {
    if (covered.has(id)) continue
    const fb = fallbackById.get(id)
    if (fb) validNodes.push(fb)
  }

  return { nodes: validNodes }
}

export async function runSceneAgent(
  ctx: DeploymentContext,
  componentGraph: ComponentGraph,
  bom: BOM,
  dfma: DfmaResult,
  catalog: ComponentCatalog
): Promise<SceneGraph> {
  if (!hasOpenAIKey()) {
    return resolveScene(componentGraph, catalog)
  }

  const userMessage = buildUserMessage(ctx, componentGraph, bom, dfma, catalog)
  // 2048 tokens: up to ~20 components each with 7 fields fits comfortably
  const text = await callJsonAgent(SYSTEM, userMessage, 2048)
  const raw = extractJsonObject<unknown>(text)
  return validateSceneGraph(raw, componentGraph, catalog)
}
