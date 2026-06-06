# Multi-Agent Pipeline

Physical Cursor conceptualises a smart-city hardware node through a **multi-agent pipeline**: LLM agents interpret the urban problem and select from a verified catalog; deterministic code resolves BOM, validates deployment risks, maps 3D geometry and applies fixes.

This document is the source of truth for backend architecture, data contracts and demo integration.

---

## Why This Architecture

A single chat prompt can invent components, prices and supplier names. That is easy to challenge in front of a hardware-savvy jury.

The pipeline separates concerns:

| Layer | Role | LLM? |
|---|---|---|
| Interpretation | Urban problem → deployment context → catalog selection | Yes |
| Grounding | BOM, prices, specs from catalog only | No |
| Validation | DfMA / deployment risk checks | No |
| Sourcing | RFQ questions and GBA route from supplier graph | Yes (questions only) |
| Presentation | 3D explode layout from component IDs | No |

Defense line:

> Physical Cursor does not invent hardware. It interprets deployment context, selects from a catalog, validates with rules and routes structured demand to a supplier graph.

---

## Pipeline Overview

```text
User prompt
    │
    ▼
┌─────────────────┐
│  CONTEXT AGENT  │  LLM — DeploymentContext JSON only
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ COMPONENT AGENT │  LLM — ComponentGraph JSON (catalog IDs only)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  BOM RESOLVER   │  Code — catalog lookup → BOM + demo cost
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   DFMA ENGINE   │  Code — warnings + fix actions (no LLM)
└────────┬────────┘
         │
         ├──────────────────┐
         ▼                  ▼
┌─────────────────┐  ┌─────────────────┐
│   RFQ AGENT     │  │ SCENE RESOLVER  │
│  LLM + graph    │  │  Code — 3D map  │
└────────┬────────┘  └────────┬────────┘
         │                    │
         └────────┬───────────┘
                  ▼
           UI: context, 3D, BOM, warning, RFQ, GBA route
```

User-facing flow (unchanged):

```text
Problem → Deployment Context → 3D Node → X-Ray → Risk → Apply Fix → GBA Route → Export
```

Backend flow (what actually runs):

```text
Prompt → Context Agent → Component Agent → BOM Resolver → DFMA Engine → RFQ Agent + Scene Resolver
```

---

## Source-of-Truth Files

All hardware references, prices and supplier routes must come from checked-in JSON. Agents and code must not invent values outside these files.

| File | Purpose |
|---|---|
| `data/component-catalog.json` | Component IDs, names, categories, specs, demo prices, 3D mesh keys |
| `data/supplier-graph.json` | GBA route templates, supplier roles, regions, RFQ topic tags |
| `data/dfma-rules.ts` (or `.json`) | Deterministic check functions and fix actions |
| `data/fallback/buildguard-pipeline.json` | Pre-validated full pipeline output for demo fallback |

---

## Agent 1 — Context Agent

**Input:** User's urban problem description (plain text).

**Output:** `DeploymentContext` JSON only. No components, no BOM, no suppliers.

**Job:**

- Read the user's urban problem description.
- Extract structured deployment constraints.
- Output valid JSON matching the schema below.

**Rules:**

- Do not suggest components.
- Do not invent prices or specs.
- Do not explain reasoning unless asked.
- If a field is unknown, use `null` or an empty array — do not guess regulatory schemes.

### DeploymentContext schema

```json
{
  "city": "Hong Kong",
  "site": "52-year-old residential building",
  "surface": "outdoor facade",
  "regulation": "Mandatory Building Inspection Scheme",
  "environment": ["humidity", "rain", "typhoon wind", "pollution"],
  "climate": {
    "humidity": "high",
    "rainfall": "heavy",
    "wind": "typhoon-exposed"
  },
  "mounting": ["facade-mounted", "low-maintenance", "limited access"],
  "power": ["battery-powered", "no mains assumed"],
  "connectivity": ["LoRa", "NB-IoT"],
  "privacy": ["no camera", "no audio", "structural data only"],
  "goal": "early warning between inspections"
}
```

### BuildGuard reference output

See `buildguard-node.md` for the canonical BuildGuard `DeploymentContext`.

---

## Agent 2 — Component Agent

**Input:**

- `DeploymentContext` JSON
- `component-catalog.json`

**Output:** `ComponentGraph` JSON listing selected catalog component IDs only.

**Job:**

- Receive deployment context and the full component catalog.
- Select which catalog components fit the context.
- Apply inclusion rules (see below).
- Output a `ComponentGraph` with selected IDs.

**Rules:**

- Do not invent components outside the catalog.
- Do not assign prices — BOM Resolver handles that.
- Output structured JSON only.

### Inclusion rules (examples)

| Context signal | Rule |
|---|---|
| `privacy` contains `no camera` | Select `mmwave-presence` or structural sensors; exclude `camera-module` |
| `surface` is `outdoor facade` | Require `weatherproof-enclosure`, `mounting-bracket` |
| `goal` includes crack / tilt / moisture | Select matching sensor IDs from catalog |
| `power` includes `battery-powered` | Require `battery-pack`; exclude mains-only PSU |
| `connectivity` includes `LoRa` | Select `lora-module`; exclude Wi-Fi-only if battery-constrained |

Rules can be enforced in code after the LLM call as a validation pass.

### ComponentGraph schema

```json
{
  "node_type": "buildguard-facade-node",
  "selected_component_ids": [
    "weatherproof-enclosure",
    "crack-displacement-sensor",
    "vibration-sensor",
    "tilt-sensor",
    "moisture-sensor",
    "edge-compute-board",
    "lora-nbiot-module",
    "battery-pack",
    "mounting-bracket"
  ]
}
```

---

## Step 3 — BOM Resolver (deterministic code)

**Not an LLM agent.** Pure catalog lookup.

**Input:** `ComponentGraph` + `component-catalog.json`

**Output:** `BOM` JSON

**Job:**

- Map each `selected_component_id` to its catalog row.
- Sum demo costs from catalog fields.
- Attach supplier route tags from catalog (region + category, not invented names).

### BOM schema

```json
{
  "rows": [
    {
      "component_id": "weatherproof-enclosure",
      "part": "Weatherproof enclosure",
      "supplier_route": "Dongguan enclosure/plastics",
      "cost_usd": 28
    }
  ],
  "total_cost_usd": 213
}
```

**Rule:** Never invent component references, prices or specs. The catalog is the only source of truth.

---

## Step 4 — DFMA Engine (deterministic code)

**Not an LLM agent.** Rule engine — same responsibility as the World Model simulation layer described in `worldmodel.md`.

**Input:**

- `DeploymentContext`
- `ComponentGraph`
- `BOM`
- `dfma-rules`

**Output:** `DfmaResult` JSON

**Job:**

- Check the component graph against deployment constraints.
- Flag hardware / deployment risks.
- Attach deterministic fix actions per warning.
- No LLM involved.

### DfmaResult schema

```json
{
  "warnings": [
    {
      "id": "IP_INSUFFICIENT",
      "category": "environmental",
      "severity": "critical",
      "title": "Weatherproofing risk",
      "explanation": "Moisture sensor and crack gauge exposed to HK humidity and typhoon rain — no IP-rated gasket, drainage path or protected sensor membrane.",
      "affected_component_ids": ["weatherproof-enclosure", "moisture-sensor", "crack-displacement-sensor"],
      "fix": {
        "label": "Add IP67 gasket + PTFE membrane + drainage lip",
        "add_component_ids": ["ip67-gasket-kit", "ptfe-membrane", "drainage-lip"],
        "cost_delta_usd": 14,
        "rfq_topic_tags": ["weatherproofing", "corrosion", "membrane"]
      }
    }
  ],
  "passed_checks": ["BATTERY_PRESENT", "NO_CAMERA_PRIVACY_OK"]
}
```

### Apply Fix

`Apply Fix` is deterministic:

1. User clicks fix on warning `IP_INSUFFICIENT`.
2. DFMA fix action adds `add_component_ids` to the component graph.
3. BOM Resolver re-runs on the updated graph.
4. Scene Resolver adds gasket / membrane / drainage meshes.
5. RFQ questions gain topics from `rfq_topic_tags`.

Demo cost: **$213 → $227** (from catalog, not LLM).

---

## Agent 5 — RFQ Agent

**Input:**

- `DeploymentContext`
- `ComponentGraph`
- `DfmaResult` (warnings + fix if applied)
- `supplier-graph.json`

**Output:** `RfqPack` JSON (UI renders plain English from this)

**Job:**

- Generate supplier questions grounded in components and warnings.
- Select GBA pilot route from `supplier-graph.json` — do not invent partners.
- Output structured JSON.

**Rules:**

- Never invent supplier names outside the supplier graph.
- Never invent prices.
- Questions must reference real component or warning IDs from upstream steps.

### RfqPack schema

```json
{
  "supplier_questions": [
    {
      "topic": "weatherproofing",
      "question": "What IP rating and test method can you certify for the facade enclosure?",
      "related_component_ids": ["weatherproof-enclosure"]
    },
    {
      "topic": "membrane",
      "question": "Can you supply a PTFE vent membrane rated for high-humidity facade deployment?",
      "related_component_ids": ["moisture-sensor", "ptfe-membrane"]
    }
  ],
  "gba_route": [
    {
      "step": 1,
      "role": "Hong Kong pilot integrator",
      "region": "Hong Kong",
      "supplier_id": "hk-pilot-integrator",
      "description": "Property manager / owners' corporation / Registered Inspector coordination"
    },
    {
      "step": 2,
      "role": "Shenzhen electronics EMS",
      "region": "Shenzhen",
      "supplier_id": "sz-ems-electronics",
      "description": "PCB, sensors, MCU, radio module"
    },
    {
      "step": 3,
      "role": "Dongguan enclosure and metal partner",
      "region": "Dongguan",
      "supplier_id": "dg-enclosure-metal",
      "description": "Weatherproof housing, mounting bracket, gasket, fasteners"
    },
    {
      "step": 4,
      "role": "Hong Kong / Guangzhou compliance and logistics",
      "region": "Hong Kong / Guangzhou",
      "supplier_id": "hk-gz-compliance",
      "description": "RF module, battery shipping, pilot documentation"
    }
  ]
}
```

---

## Step 6 — Scene Resolver (deterministic code)

**Not an LLM agent.**

**Input:** `ComponentGraph` + `component-catalog.json` (3D mesh keys per ID)

**Output:** `SceneGraph` JSON for the Three.js / React Three Fiber layer

**Job:**

- Map each component ID to explode position, label and mesh key.
- Mark affected components when a warning is active (e.g. enclosure turns red).
- Add fix meshes when Apply Fix runs.

---

## Orchestration

### API shape (recommended)

```text
POST /api/pipeline/generate
  body: { prompt: string }
  returns: PipelineResult (all stages, streamed or batched)

POST /api/pipeline/apply-fix
  body: { warning_id: string, pipeline_state: PipelineState }
  returns: updated PipelineResult
```

### Streaming for demo UX

Emit stage events so the UI can animate the left panel:

```text
stage:context     → DeploymentContext
stage:components  → ComponentGraph
stage:bom         → BOM
stage:dfma        → DfmaResult
stage:rfq         → RfqPack
stage:scene       → SceneGraph
```

### Hackathon fallback

If any LLM agent fails or returns invalid JSON:

1. Log the error server-side.
2. Load `data/fallback/buildguard-pipeline.json`.
3. Continue the demo without breaking on stage.

The jury should see the pipeline architecture; demo day reliability matters more than handling every edge-case prompt.

---

## Global Rules

1. **Never invent** component references, prices or specs.
2. **Catalog is the only source of truth** for hardware.
3. **Supplier graph is the only source of truth** for GBA route partners.
4. **Each agent call outputs structured JSON** unless explicitly instructed otherwise (RFQ renders to plain English in the UI only).
5. **Do not explain reasoning** in agent outputs unless asked.
6. **DfMA and BOM are always deterministic** — no LLM in validation or pricing.
7. **Context before components** — Context Agent must never output catalog IDs.

---

## UI Mapping

| Pipeline stage | UI surface |
|---|---|
| Context Agent | LEFT panel — Deployment Context cards |
| Component Agent + Scene Resolver | CENTER — 3D BuildGuard Node, X-Ray / Explode |
| BOM Resolver | RIGHT panel — BOM table |
| DFMA Engine | RIGHT panel — warning card; CENTER — red enclosure |
| Apply Fix | CENTER — gasket / membrane / drainage; RIGHT — BOM + cost update |
| RFQ Agent | RIGHT panel — supplier questions + GBA route |
| Export | Readiness Pack summary |

### Progress bar steps

```text
1. Prompt entered
2. Context Agent — deployment context
3. Component Agent — component graph
4. 3D node + X-Ray
5. BOM sync
6. DFMA warning
7. Apply Fix
8. RFQ + GBA route
9. Export Readiness Pack
```

---

## Relationship to World Model

`worldmodel.md` describes the simulation / stress-test layer. In this repo that layer **is** the DFMA Engine (step 4).

Same contract:

```text
Input:  DeploymentContext + ComponentGraph
Output: SimulationWarning[] with deterministic fixes
```

The World Model team and backend team share `DfmaResult` / `SimulationWarning` types. See `TASKS.md` for the interface contract.

---

## What We Are Not Claiming

- LLM agents do not generate final CAD.
- LLM agents do not certify structural safety.
- Catalog prices are demo assumptions, not live supplier quotes.
- RFQ Agent generates questions, not binding quotes.
- Component Agent selects; it does not design new parts.

---

## Related Docs

- `buildguard-node.md` — canonical demo object, BOM, warning and fix
- `demo-and-build-plan.md` — user flow, videos, MVP scope
- `product-brief.md` — product story and moat
- `worldmodel.md` — DfMA check categories and engineering rationale
- `jury-audience-context.md` — how to pitch this architecture to judges
