# Multi-Agent Pipeline

This document is the runtime source of truth for Manu's backend, UI orchestration, MCP tool ownership, data contracts and demo safety defaults.

It reflects the current code under `frontend/` on the `feat/agent-orchestration-mcp` branch.

---

## Runtime Summary

Manu is an interruptible smart-city hardware compiler.

The app does not ask one large LLM prompt to invent a device. It runs a bounded pipeline:

```text
Chat input
  -> Context Gate
  -> Context Agent
  -> Compliance MCP
  -> Component Agent
  -> Hardware MCP
  -> BOM Resolver
  -> DfMA Engine
  -> Risk Checkpoint if critical
  -> Apply Fix if user accepts
  -> Supplier MCP
  -> Scene MCP
  -> UI hydration
```

Current user-facing flow:

```text
Problem
  -> Deployment Context
  -> Component Graph
  -> BOM
  -> DfMA warning
  -> Apply Fix
  -> 3D smart-city node
  -> X-Ray / Explode
  -> GBA supplier route
```

Important runtime fact:

- `/api/pipeline/generate` runs with `{ interruptOnRisk: true }`.
- If DfMA finds a critical warning, the pipeline stops at `stage:checkpoint:risk`.
- Supplier routing and final 3D scene generation happen after the user applies the fix, or immediately only when there is no critical warning.

This is intentional for the demo: the warning and fix are the "expert moment".

---

## What Is LLM, MCP, Deterministic Code

| Stage | Code owner | Runtime path | Can fallback? | Notes |
|---|---|---|---|---|
| Context Gate | `frontend/lib/context-gate-server.ts` + `context-gate.ts` | LLM JSON gate normalized by deterministic checks | Yes, to local gate | Blocks only when required context is missing. Delegated answers like `jsp fait comme tu veux` use a documented default context. |
| Context Agent | `frontend/lib/pipeline/context-agent.ts` | LLM JSON extraction if `OPENAI_API_KEY`; otherwise parser | Yes, parser | Normalized by `normalizeDeploymentContext` so null/empty fields do not crash downstream rules. |
| Compliance | `frontend/mcp/compliance-server.mjs` | MCP tool `compliance.search_requirements` | Yes, `resolveCompliance` | Reads `frontend/data/compliance-rules.json`. |
| Component Agent | `frontend/lib/pipeline/component-agent.ts` | LLM catalog selection if key exists; otherwise rule-based graph | Yes, rules | Output is validated by `validateComponentGraph`; fix IDs are excluded until DfMA applies them. |
| Hardware Expert | `frontend/mcp/hardware-server.mjs` | MCP tool `hardware.match_assembly_pattern` | Yes, `resolveAssemblyPattern` | Reads `frontend/data/assembly-patterns.json`. |
| BOM Resolver | `frontend/lib/pipeline/bom-resolver.ts` | Deterministic catalog lookup | No LLM | Reads `frontend/data/component-catalog.json`; prices are catalog assumptions. |
| DfMA Engine | `frontend/lib/pipeline/dfma-engine.ts` | Deterministic rule engine | No LLM | Reads `frontend/data/dfma-rules.json`; emits fix actions. |
| Supplier Route | `frontend/mcp/supplier-server.mjs` | MCP tool `supplier.route_bom_to_gba` | Yes, RFQ resolver | Reads `frontend/data/supplier-graph.json`. |
| Scene Graph | `frontend/mcp/scene-server.mjs` | MCP tool `scene.generate_scene_graph` | No silent fallback in orchestrator | This tool is required through `runtime.callMcpRequired`. If scene MCP fails, the visual path is treated as failed rather than silently faking 3D. |

The legacy `frontend/app/api/chat` route and `frontend/lib/claude-stream.ts` are not the main workspace pipeline. The workspace uses `runPipelineInStore` -> `/api/context/analyze` -> `/api/pipeline/generate` -> `/api/pipeline/apply-fix`.

---

## API Surface

### `POST /api/context/analyze`

File: `frontend/app/api/context/analyze/route.ts`

Input:

```json
{ "prompt": "string" }
```

Output:

```ts
type ContextGateResult = {
  status: 'ready' | 'needs_input'
  canonicalPrompt: string
  missingFields: string[]
  questions: { id: string; question: string }[]
  confidence: number
  source: 'llm' | 'fallback'
}
```

Behavior:

- Calls `analyzeContextGateWithAgent`.
- Uses the OpenAI JSON agent when `OPENAI_API_KEY` exists.
- Falls back to `evaluateContextGate` when there is no key or the LLM call fails.
- Normalizes LLM field aliases such as `site_type`, `sitetype`, `mounting_surface`, `mountingsurface`, `cityjurisdiction` into canonical IDs.
- If deterministic field checks see required context, an over-cautious LLM cannot block generation.
- If the user delegates choices (`jsp`, `je sais pas`, `fais comme tu veux`, `up to you`, `decide for me`, etc.), it returns a documented default Hong Kong dense-city context and status `ready`.

### `POST /api/pipeline/generate`

File: `frontend/app/api/pipeline/generate/route.ts`

Input:

```json
{ "prompt": "string" }
```

Output: Server-Sent Events.

Events:

```text
stage:context
stage:compliance
stage:components
stage:assembly
stage:bom
stage:dfma
stage:checkpoint:risk
stage:rfq
stage:scene
stage:complete
error
```

The route calls `runPipeline(prompt, emit, { interruptOnRisk: true })`.

When `stage:checkpoint:risk` fires, the returned `PipelineState` has:

```json
{
  "pipelineStatus": "awaiting_risk_decision",
  "interruption": {
    "type": "risk",
    "warningId": "IP_INSUFFICIENT",
    "message": "Weatherproofing risk"
  },
  "rfq": { "supplier_questions": [], "gba_route": [] },
  "scene": { "nodes": [] }
}
```

### `POST /api/pipeline/apply-fix`

File: `frontend/app/api/pipeline/apply-fix/route.ts`

Input:

```json
{
  "warningId": "IP_INSUFFICIENT",
  "pipelineState": "PipelineState"
}
```

Output: updated `PipelineState`.

Behavior:

1. Adds the DfMA fix components to the existing component graph.
2. Revalidates assembly with Hardware MCP.
3. Rebuilds BOM.
4. Re-runs DfMA.
5. Regenerates supplier route with Supplier MCP.
6. Regenerates scene with required Scene MCP.
7. Returns `pipelineStatus: "complete"`.

### `POST /api/pipeline/fallback`

File: `frontend/app/api/pipeline/fallback/route.ts`

Input:

```json
{ "prompt": "string" }
```

Output: deterministic `PipelineState`.

This is a recovery endpoint for the frontend if the streaming connection fails. There is no checked-in `fallback/buildguard-pipeline.json`; the fallback is computed from parsers, rules, catalog data and MCP-required scene generation.

---

## UI Orchestration

File: `frontend/lib/pipeline-client.ts`

`runPipelineInStore(content, files?)` is the main chat entrypoint.

It does the following:

1. Adds uploaded file messages, if any.
2. Adds the user message.
3. If there is a pending context gate, appends the new answer to `pendingGate.originalPrompt`:

   ```text
   <previous accumulated prompt>

   Additional context from user:
   <new answer>
   ```

4. Calls `/api/context/analyze`.
5. If the gate returns `needs_input`, stores `contextGate`, writes a `context_agent.clarify_context` tool-call message and adds the formatted questions.
6. If the gate returns `ready`, clears `contextGate`, starts the expert pipeline and streams stage events.
7. On `stage:checkpoint:risk`, hydrates partial state, shows the warning card and moves to `awaiting_risk_decision`.
8. On `stage:complete`, hydrates final state and marks the conversation complete.

Tool-call status rules:

- Context gate tool call is `completed` when source is `llm`.
- Context gate tool call is `fallback` when source is local fallback.
- MCP tool calls are shown as `completed` for `status: "ok"` and `fallback` for `status: "fallback"`.

Conversation states:

```ts
type ConversationState =
  | 'awaiting_context'
  | 'context_ready'
  | 'running_experts'
  | 'awaiting_risk_decision'
  | 'applying_fix'
  | 'complete'
```

---

## Data Contracts

Source file: `frontend/lib/pipeline/types.ts`

### `DeploymentContext`

```ts
type DeploymentContext = {
  city: string
  site: string
  surface: string
  regulation: string | null
  environment: string[]
  climate: {
    humidity: string | null
    rainfall: string | null
    wind: string | null
  }
  mounting: string[]
  power: string[]
  connectivity: string[]
  privacy: string[]
  goal: string
}
```

### `ComponentGraph`

```ts
type ComponentGraph = {
  node_type: string
  selected_component_ids: string[]
}
```

### `BOM`

```ts
type BOMRow = {
  component_id: string
  part: string
  supplier_route: string
  cost_usd: number
  scene_id: string | null
  source?: SourceMetadata
}

type BOM = {
  rows: BOMRow[]
  total_cost_usd: number
}
```

### `DfmaWarning`

```ts
type DfmaWarning = {
  id: string
  category: 'structural' | 'thermal' | 'environmental' | 'coverage' | 'power'
  severity: 'critical' | 'warning' | 'note'
  title: string
  explanation: string
  affected_component_ids: string[]
  fix: {
    label: string
    add_component_ids: string[]
    add_scene_only_ids?: string[]
    cost_delta_usd: number
    rfq_topic_tags: string[]
  }
}
```

### `SceneGraph`

```ts
type SceneGraph = {
  nodes: SceneNode[]
}

type SceneNode = {
  component_id: string
  scene_id: string
  label: string
  category?: string
  tags?: string[]
  position: [number, number, number]
  explodeOffset: [number, number, number]
  color: string
  geometry: 'box' | 'cylinder' | 'sphere'
  scale: [number, number, number]
  assembly: SceneAssembly
}
```

### `SceneAssembly`

```ts
type SceneAssembly = {
  placement:
    | 'root'
    | 'internal'
    | 'external'
    | 'mount'
    | 'seal'
    | 'fastener'
    | 'drainage'
    | 'power-surface'
  parent_scene_id: string | null
  anchor_face: 'center' | 'inside' | 'front' | 'back' | 'top' | 'bottom' | 'left' | 'right'
  contact:
    | 'reference-volume'
    | 'contained'
    | 'standoff-mounted'
    | 'tray-mounted'
    | 'surface-mounted'
    | 'flush-mounted'
    | 'probe-mounted'
    | 'pass-through'
    | 'edge-mounted'
}
```

The frontend maps snake_case `parent_scene_id` into UI `parentSceneId` in `frontend/lib/pipeline/to-ui.ts`.

---

## Source-Of-Truth Data Files

All hardware prices, component IDs, assembly patterns, DfMA fixes and supplier routes come from checked-in JSON.

| File | Current count | Purpose |
|---|---:|---|
| `frontend/data/component-catalog.json` | 100+ components, all with scene metadata | Component IDs, categories, tags, prices, supplier routes, scene positions and colors |
| `frontend/data/supplier-graph.json` | 6 suppliers, 4 route stops, 5 base RFQ questions | GBA supplier path and topic-based RFQ templates |
| `frontend/data/component-selection-rules.json` | data-driven intent rules | Deterministic catalog selection without prompt-specific code branches |
| `frontend/data/assembly-patterns.json` | 7+ patterns | Hardware assembly matching and constraints |
| `frontend/data/dfma-rules.json` | 1 check, 1 fix key | Deterministic manufacturability warnings and fix actions |
| `frontend/data/compliance-rules.json` | 3 requirements | Hong Kong compliance and claim-boundary requirements |

No component, supplier, price or route should be invented outside these files.

---

## MCP Servers And Tool Registry

MCP client file: `frontend/lib/mcp/client.ts`

The client starts a new local stdio MCP process for each tool call:

```ts
const SERVER_SCRIPT = {
  compliance: 'compliance-server.mjs',
  hardware: 'hardware-server.mjs',
  supplier: 'supplier-server.mjs',
  scene: 'scene-server.mjs',
  sourceResearch: 'source-research-server.mjs',
}
```

Tool registry file: `frontend/lib/pipeline/agent-registry.ts`

Allowed runtime tools:

| Agent | Allowed tool key | MCP server | MCP tool name |
|---|---|---|---|
| `compliance_hk_agent` | `compliance.search_requirements` | `compliance` | `search_requirements` |
| `hardware_expert_agent` | `hardware.match_assembly_pattern` | `hardware` | `match_assembly_pattern` |
| `supplier_gba_agent` | `supplier.route_bom_to_gba` | `supplier` | `route_bom_to_gba` |
| `scene_3d_agent` | `scene.generate_scene_graph` | `scene` | `generate_scene_graph` |

`createAgentRuntime.assertAllowed` prevents an agent from calling a tool not in its allowlist.

Fallback policy:

- `callMcpWithFallback` is used for compliance, hardware and supplier.
- `callMcpRequired` is used for scene.
- A scene failure is not silently replaced with boxes by the orchestrator.

---

## Context Gate Details

Files:

- `frontend/lib/context-gate.ts`
- `frontend/lib/context-gate-server.ts`
- `frontend/__tests__/context-gate.test.ts`
- `frontend/__tests__/pipeline-client-gate.test.ts`

Required context fields:

- `city`
- `site`
- `surface`
- `goal`

Optional context fields:

- `power`
- `connectivity`
- `privacy`

Important behavior:

- Optional fields never block generation.
- Accented deployment vocabulary is normalized, so `façade` matches `facade`.
- LLM aliases are canonicalized, so `site_type`, `sitetype`, `mounting_surface`, `mountingsurface`, `cityjurisdiction`, `measured_signal` are normalized.
- If the LLM says `needs_input` but deterministic field checks see the required fields, generation proceeds.
- If the LLM returns a clarification sentence as `canonicalPrompt`, but deterministic checks say the original prompt is ready, the original prompt is preserved.
- If the user delegates missing choices (`jsp fait comme tu veux`, `je sais pas`, `up to you`, etc.), the gate uses this default:

```text
Assume a Hong Kong dense-city deployment: a battery-powered LoRa smart-city sensor node mounted on an outdoor concrete facade of a residential high-rise, detecting crack propagation, moisture ingress, vibration anomalies and tilt shifts, with no camera and privacy-preserving sensing.
```

This default is intentional. It keeps the demo moving when the user explicitly asks the system to choose.

---

## Context Agent Details

File: `frontend/lib/pipeline/context-agent.ts`

The Context Agent asks for only `DeploymentContext` JSON. It must not suggest components, prices or suppliers.

Runtime:

- With `OPENAI_API_KEY`: calls `callJsonAgent`.
- Without key: uses `parseContextFromPrompt`.
- Always normalizes through `normalizeDeploymentContext`.

Parser heuristics in `parse-context.ts` are not a fake BuildGuard fixture. They derive:

- city from known city terms (`Hong Kong`, `HK`, `Singapore`, `Shenzhen`, `Munich`)
- site from the first sentence or `N-year-old building`
- surface from `facade`, `roof`, `ceiling`, `outdoor`, etc.
- privacy defaults to `no camera` when the prompt does not mention camera/video
- battery and LoRa/NB-IoT defaults when the prompt implies low-maintenance facade sensor

---

## Component Agent Details

Files:

- `frontend/lib/pipeline/component-agent.ts`
- `frontend/lib/pipeline/inclusion-rules.ts`
- `frontend/data/component-selection-rules.json`

The LLM can propose a component graph, but `validateComponentGraph` enforces catalog grounding:

- unknown component IDs are dropped
- DfMA fix IDs are excluded before the fix step
- rule-based required IDs are added back
- camera is removed unless the context explicitly asks for camera

The expanded smart-city library covers facade, flood/drainage, roadside, parking, occupancy, waste, utility and environmental-monitoring nodes. Deterministic selection uses `component-selection-rules.json` plus catalog tags, so non-BuildGuard prompts still produce catalog-grounded graphs when no LLM key is configured.

BuildGuard base graph from current rules:

```json
[
  "weatherproof-enclosure",
  "mounting-bracket",
  "crack-displacement-sensor",
  "vibration-sensor",
  "tilt-sensor",
  "moisture-sensor",
  "edge-compute-board",
  "lora-nbiot-module",
  "battery-pack"
]
```

Base BOM total from catalog:

```text
$213
```

---

## DfMA And Apply Fix

File: `frontend/lib/pipeline/dfma-engine.ts`

Current check:

```text
IP_INSUFFICIENT
```

It fires when:

- deployment surface is outdoor/facade/exterior
- humidity exposure is detected from climate/environment/goal
- component graph contains `moisture-sensor` or `crack-displacement-sensor`
- required fix components are not all present

Fix key in `dfma-rules.json`:

```json
{
  "add_component_ids": [
    "ip67-gasket-kit",
    "ptfe-membrane",
    "316l-stainless-fasteners"
  ],
  "add_scene_only_ids": [
    "drainage-lip"
  ]
}
```

Cost logic:

- `cost_delta_usd` is computed from `add_component_ids` only.
- `drainage-lip` has catalog cost `0` and is present for scene/readability.
- Base BuildGuard BOM is `$213`.
- After fix it is `$227`.

---

## Scene Graph And 3D Rendering

Runtime scene source:

- `frontend/mcp/scene-server.mjs` maps selected component IDs to catalog scene metadata.
- `frontend/lib/pipeline/orchestrator.ts` requires `scene.generate_scene_graph` through `callMcpRequired`.
- `frontend/lib/pipeline/scene-resolver.ts` mirrors scene assembly inference for local validation/tests and for code paths that need deterministic scene resolution.
- `frontend/lib/pipeline/scene-agent.ts` is retained but is not the orchestrator's final scene path.

Rendering:

- `frontend/components/center/BuildGuardScene.tsx` creates the React Three Fiber scene.
- `frontend/components/center/BuildGuardNode.tsx` renders scene nodes.
- `frontend/lib/scene/part-details.ts` adds procedural visual details: screws, vents, LEDs, PCB chips, traces, battery terminals, antenna, gasket strips, membrane, fasteners, drainage channel, sensor apertures and cable gland.

Physics/plausibility model:

- Scene nodes are not CAD solids.
- They are parametric primitives with explicit assembly metadata.
- Every visible component has a `SceneAssembly` record declaring placement, parent, anchor face and contact type.
- Explode mode draws parent-child tethers from `assembly.parentSceneId`.
- The enclosure is the root reference volume.
- The bracket is mounted behind the enclosure.
- PCB, battery and radio are inside.
- crack/moisture/tilt/vibration sensors are on the front face.
- fix components attach to the enclosure, sensor port or bracket.

Guardrail:

> The app creates a reviewable 3D smart-city hardware brief, not final CAD.

---

## Supplier Route

File: `frontend/data/supplier-graph.json`

Current route:

1. Hong Kong pilot integrator: `hk-pilot-integrator`
2. Shenzhen electronics EMS: `sz-ems-electronics`
3. Dongguan enclosure and metal partner: `dg-enclosure-metal`
4. Hong Kong / Guangzhou compliance and logistics: `hk-gz-compliance`

Current supplier profiles:

- `Citybase Digital Solutions` — Hong Kong — smart building IoT integration
- `JLCPCB / EasyEDA` — Shenzhen — PCB manufacturing and SMT assembly
- `NextPCB` — Shenzhen — PCB prototyping and low-volume EMS
- `Dongguan Yiyuan Plastic` — Dongguan — IP67 enclosures and injection moulding
- `Dongguan Sunco Metal` — Dongguan — metal fabrication, brackets, stainless fasteners
- `TUV Rheinland Greater China` — Hong Kong — CE/FCC/HKCA and RF compliance testing

These are route/profile entries for a hackathon readiness pack. They are not live quotes or commercial commitments.

---

## Traceability And Tests

Important tests:

- `frontend/__tests__/context-gate.test.ts`
- `frontend/__tests__/pipeline-client-gate.test.ts`
- `frontend/__tests__/agent-runtime.test.ts`
- `frontend/__tests__/mcp-servers.test.ts`
- `frontend/__tests__/pipeline.test.ts`
- `frontend/__tests__/scene-assembly.test.ts`
- `frontend/__tests__/scene-physics.test.ts`
- `frontend/__tests__/part-details.test.ts`

The current regression suite verifies:

- context gate does not repeat questions after sufficient context
- delegated answer `jsp fait comme tu veux` proceeds with defaults
- LLM field aliases are canonicalized
- optional fields do not block generation
- scene MCP returns assembly metadata
- scene node IDs remain stable
- DfMA handles humidity and accented `façade`
- strict MCP scene path fails instead of silently faking the final 3D scene

---

## Hardcode Policy

There are intentional constants in this repo. They are not hidden data fabrication; they are either UI defaults, checked-in catalog knowledge or demo safety defaults.

See `docs/runtime-and-defaults-audit.md` for the exhaustive audit.

Rules:

1. Do not silently invent hardware.
2. Do not silently invent supplier names.
3. Do not silently invent prices.
4. Do not silently fake final 3D scene output if Scene MCP fails.
5. Do keep explicit, documented defaults that make the hackathon demo resilient when the user asks the system to decide.

---

## What We Are Not Claiming

- final CAD
- certified structural safety
- replacement of Registered Inspectors
- live supplier quotes
- arbitrary hardware generation for every object family
- physically simulated finite-element validation
- full marketplace

Say instead:

> Manu creates the first reviewable hardware brief: deployment context, catalog component graph, BOM, DfMA risk, fix pack, supplier route and physically plausible 3D scene graph.
