# Runtime And Defaults Audit

This audit answers the practical question: "Is anything hardcoded?"

Short answer:

- There are intentional constants and checked-in knowledge files.
- There is no hidden `fallback/buildguard-pipeline.json`.
- Component prices, supplier route, DfMA fixes and scene positions are versioned data, not LLM inventions.
- The 3D scene path is not silently faked if Scene MCP fails.

This file lists every important runtime default and whether it is safe.

---

## Audit Result

| Area | File(s) | Hardcoded? | Status | Reason |
|---|---|---:|---|---|
| Demo prompt button | `frontend/components/project/ContextEntryForm.tsx` | Yes | Safe | UI convenience only. User can type any prompt. |
| Context gate field regexes | `frontend/lib/context-gate.ts` | Yes | Safe | Required to keep the gate deterministic and prevent repeated LLM clarification loops. |
| Delegated-context default | `frontend/lib/context-gate.ts` | Yes | Safe and intentional | Used only when the user explicitly delegates choices (`jsp`, `fais comme tu veux`, `up to you`). |
| Context parser heuristics | `frontend/lib/pipeline/parse-context.ts` | Yes | Safe | Rule-based fallback, derived from prompt text, not fixed BuildGuard output. |
| Component catalog | `frontend/data/component-catalog.json` | Yes, as data | Safe | Source-of-truth catalog for hackathon demo. |
| Supplier graph | `frontend/data/supplier-graph.json` | Yes, as data | Safe | Source-of-truth route and RFQ templates. |
| DfMA rules | `frontend/data/dfma-rules.json` | Yes, as data | Safe | Deterministic validation layer. |
| Compliance rules | `frontend/data/compliance-rules.json` | Yes, as data | Safe | Source-backed constraints and claim boundaries. |
| Assembly patterns | `frontend/data/assembly-patterns.json` | Yes, as data | Safe | Hardware expert rule layer. |
| 3D scene positions | `frontend/data/component-catalog.json` | Yes, as data | Safe | Parametric scene graph layout, not final CAD. |
| Part visual details | `frontend/lib/scene/part-details.ts` | Yes | Safe | Visual richness layer: screws, vents, LED, traces, gasket, membrane, drainage. |
| MCP server script names | `frontend/lib/mcp/client.ts` | Yes | Safe | Static local stdio server registry. |
| Agent tool allowlist | `frontend/lib/pipeline/agent-registry.ts` | Yes | Safe | Security/scope boundary. |
| OpenAI model default | `frontend/lib/pipeline/llm.ts` | Yes | Safe | `OPENAI_MODEL` env var can override `gpt-4.1-nano`. |
| Legacy chat prompt | `frontend/app/api/chat/helpers.ts` | Yes | Not source of truth | Main workspace does not use this route. Pipeline docs should point to `/api/pipeline/*`. |
| Full BuildGuard fallback JSON | Not present | No | Safe | Fallback is computed from parser/rules/catalog, not loaded from a fake static pipeline. |

---

## Intentional Defaults

### 1. Delegated Context Default

File: `frontend/lib/context-gate.ts`

Constant:

```text
Assume a Hong Kong dense-city deployment: a battery-powered LoRa smart-city sensor node mounted on an outdoor concrete facade of a residential high-rise, detecting crack propagation, moisture ingress, vibration anomalies and tilt shifts, with no camera and privacy-preserving sensing.
```

Trigger phrases include:

- `jsp`
- `je sais pas`
- `je ne sais pas`
- `fais comme tu veux`
- `fait comme tu veux`
- `comme tu veux`
- `a toi de choisir`
- `choisis`
- `decide for me`
- `do what you want`
- `up to you`
- `use default`
- `use defaults`
- `I don't know`
- `not sure`

Why it exists:

The chat should not loop forever when the user explicitly asks the system to decide. For the hackathon, the safest default is the project thesis: dense-city Hong Kong facade node.

Risk:

If overused, it biases vague prompts toward BuildGuard-style outputs.

Mitigation:

It only triggers on explicit delegation phrases. Normal vague prompts still ask for missing required context.

### 2. Demo Prompt Button

File: `frontend/components/project/ContextEntryForm.tsx`

Prompt:

```text
A 52-year-old Hong Kong residential building needs a low-maintenance facade sensor node that monitors crack propagation, vibration anomalies, tilt shifts and moisture ingress, and creates early warnings before the next Mandatory Building Inspection.
```

Why it exists:

The hackathon demo needs a reliable one-click scenario. It does not replace the free-form prompt input.

### 3. Parser Heuristics

File: `frontend/lib/pipeline/parse-context.ts`

The parser recognizes:

- cities: Hong Kong / HK, Singapore, Shenzhen, Munich
- surfaces: facade, roof, indoor/ceiling, outdoor
- regulation: Mandatory Building Inspection / MBIS
- environmental terms: humid/moisture, rain/storm, typhoon/wind, pollution/urban
- privacy defaults: no camera when prompt does not mention camera/video
- low-maintenance facade defaults: battery, no mains, LoRa, NB-IoT

Why it exists:

The pipeline must remain buildable without an OpenAI key and must normalize incomplete LLM output.

### 4. Catalog Scene Metadata

File: `frontend/data/component-catalog.json`

Each component has:

- `scene_id`
- label
- position
- explode offset
- color
- geometry
- scale

Why it exists:

This is a parametric hardware visualization, not a text-to-CAD model. The catalog is the grounding layer.

### 5. Visual Detail Primitives

File: `frontend/lib/scene/part-details.ts`

Examples:

- enclosure front panel, screw heads, vents, status LED
- PCB processor chip, RF shield, copper traces
- battery terminals and charge band
- antenna
- bracket mounting holes
- gasket strips
- PTFE membrane disc
- drainage channel and weep holes
- fastener heads
- sensor apertures
- cable gland collar and cable stub

Why it exists:

The scene graph alone gives position and shape. The detail layer creates the wow effect without pretending to be CAD.

---

## Data Grounding

### Component Catalog

File: `frontend/data/component-catalog.json`

Current catalog:

- 21 components
- 21 scene-enabled components
- Base BuildGuard BOM: 9 components
- Fix BOM additions: 3 priced components
- Fix scene addition: 1 zero-cost scene component

Base BuildGuard graph:

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

Base cost from catalog:

```text
$213
```

Fix additions:

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

After-fix cost:

```text
$227
```

### Supplier Graph

File: `frontend/data/supplier-graph.json`

Current suppliers:

- `hk-pilot-integrator` — Citybase Digital Solutions — Hong Kong
- `sz-ems-electronics` — JLCPCB / EasyEDA — Shenzhen
- `sz-ems-nextpcb` — NextPCB — Shenzhen
- `dg-enclosure-metal` — Dongguan Yiyuan Plastic — Dongguan
- `dg-enclosure-sunco` — Dongguan Sunco Metal — Dongguan
- `hk-gz-compliance` — TUV Rheinland Greater China — Hong Kong

Current route:

1. Hong Kong pilot integrator
2. Shenzhen electronics EMS
3. Dongguan enclosure and metal partner
4. Hong Kong / Guangzhou compliance and logistics

These are demo route entries. They are not live RFQs or binding quotes.

### DfMA Rules

File: `frontend/data/dfma-rules.json`

Current check:

- `IP_INSUFFICIENT`

It is triggered by outdoor/facade humidity exposure with moisture or crack components before weatherproofing fixes are present.

---

## Fallback And Failure Behavior

### Allowed Fallbacks

Allowed:

- Context gate LLM failure -> local `evaluateContextGate`
- Context Agent missing key -> `parseContextFromPrompt`
- Component Agent missing key -> `ruleBasedComponentGraph`
- Compliance MCP failure -> `resolveCompliance`
- Hardware MCP failure -> `resolveAssemblyPattern`
- Supplier MCP failure -> `runRfqAgent` / deterministic supplier pack path
- Streaming connection failure -> client calls `/api/pipeline/fallback`

### Not Allowed As Silent Fallback

Not allowed:

- Scene MCP failure silently replaced by fake boxes in the orchestrator
- LLM-invented component IDs accepted without catalog validation
- LLM-invented prices accepted into BOM
- LLM-invented supplier names accepted into route

Scene is strict:

```ts
runtime.callMcpRequired<SceneGraph>(
  'scene_3d_agent',
  'scene.generate_scene_graph',
  { componentGraph }
)
```

If this fails, the visual generation path is considered failed. This matches the user requirement: no fake 3D fallback.

---

## Legacy Or Non-Source-Of-Truth Code

### `/api/chat`

Files:

- `frontend/app/api/chat/route.ts`
- `frontend/app/api/chat/helpers.ts`
- `frontend/lib/claude-stream.ts`

Status:

Legacy chat-stream route. The main workspace pipeline does not import `streamChat`; it imports `streamPipeline` and calls `/api/pipeline/generate`.

Risk:

`buildSystemPrompt()` is more demo-script-like than the current grounded pipeline.

Rule:

Do not use `/api/chat` as the technical source of truth. The source of truth is `/api/context/analyze`, `/api/pipeline/generate`, `/api/pipeline/apply-fix`, `frontend/lib/pipeline/*`, `frontend/mcp/*` and `frontend/data/*.json`.

---

## Verification Commands

Use these commands before claiming the runtime/docs match:

```bash
cd frontend
npm run test
npm run lint
npm run build
```

Useful endpoint checks against a local server:

```bash
curl -s -X POST http://127.0.0.1:3000/api/context/analyze \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"jsp fait comme tu veux"}'
```

Expected key fields:

```json
{
  "status": "ready",
  "missingFields": [],
  "questions": []
}
```

Demo prompt gate check:

```bash
curl -s -X POST http://127.0.0.1:3000/api/context/analyze \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"A 52-year-old Hong Kong residential building needs a low-maintenance facade sensor node that monitors crack propagation, vibration anomalies, tilt shifts and moisture ingress, and creates early warnings before the next Mandatory Building Inspection."}'
```

Expected:

```json
{
  "status": "ready",
  "missingFields": [],
  "questions": []
}
```
