# Demo And Build Plan

## User Flow

User:

> Smart City innovation lead, property manager, building rehabilitation program, or accelerator manager.

Goal:

> Turn an aging-building problem into a reviewable smart-city hardware brief.

Flow (user-facing):

```text
1. User enters the aging-building problem.
2. Context Gate verifies required context or asks at most three questions.
3. Context Agent extracts deployment context (LEFT panel).
4. Compliance MCP checks relevant Hong Kong claim/deployment constraints.
5. Component Agent selects catalog components; Hardware MCP validates assembly pattern.
6. BOM Resolver fills the BOM (RIGHT panel).
7. DFMA Engine surfaces weatherproofing risk and pauses the pipeline.
8. User clicks Apply Fix.
9. Supplier MCP creates RFQ questions and GBA route.
10. Scene MCP generates the 3D scene graph; BuildGuard Node appears in 3D (CENTER).
11. User opens X-Ray / Explode view and sees assembled, tethered components.
12. User exports a Smart City Readiness Pack.
```

Backend pipeline (runs behind steps 2–10):

```text
Prompt → Context Gate → Context Agent → Compliance MCP → Component Agent → Hardware MCP → BOM Resolver → DFMA Engine → Risk Checkpoint → Apply Fix → Supplier MCP → Scene MCP
```

See `multi-agent-pipeline.md` for schemas, catalog rules and orchestration.

## Interface Layout

Keep the interface simple:

```text
LEFT: prompt + pipeline stage indicator + deployment context
CENTER: interactive 3D BuildGuard Node
RIGHT: component graph / BOM / DFMA warning / RFQ + supplier route
BOTTOM: linear demo progress
```

Do not build a broad platform. Build one sharp demo path.

## Technical Video - 2 Minutes

Goal:

> Show the product working.

Timeline:

```text
0:00 Hook
Smart-city hardware gets blocked before it can even be tested.

0:12 Prompt
Paste the BuildGuard aging-building prompt.

0:20 Context Agent
Deployment context JSON appears: Hong Kong, facade, MBIS, humidity, typhoon, no camera. If the prompt is vague and the user says "fais comme tu veux", the gate uses the explicit Hong Kong dense-city default instead of looping.

0:30 Compliance + Component + Hardware
Tool trace shows Compliance MCP, catalog-only Component Agent and Hardware MCP assembly validation.

0:38 BOM Resolver
BOM rows and $213 total from catalog lookup.

0:45 DfMA checkpoint
Weatherproofing warning appears; pipeline pauses before supplier route and final 3D scene. Say: deterministic rules, not LLM.

1:00 Apply Fix
Add IP67 gasket kit, PTFE membrane, 316L stainless fasteners and drainage lip scene detail; BOM/cost/RFQ update ($213 → $227).

1:15 Supplier + 3D generation
Supplier MCP runs, then Scene MCP returns the scene graph; BuildGuard Node appears in 3D.

1:25 X-Ray / Explode
Show enclosure, crack sensor, vibration sensor, tilt sensor, moisture sensor, compute, radio, battery, bracket, gasket, membrane, fasteners and drainage lip.

1:40 Supplier route
Show supplier questions + GBA route from supplier graph.

1:50 Close
Manu: context → catalog selection → rule validation → physical 3D brief → supplier route.
```

## Business Video - 2 Minutes

Goal:

> Explain why this is a startup worth sending to Hong Kong.

Timeline:

```text
0:00 Problem
Smart cities need thousands of physical devices, but the entry point is too difficult: vague idea, no hardware expert, no component map, no deployment context, no supplier-ready RFQ, unreliable cost estimate and slow time-to-pilot.

0:20 Hong Kong Pain
Aging buildings and MBIS create a concrete Smart City problem.

0:35 Product
Manu runs a multi-agent pipeline: context extraction, catalog-based component selection, deterministic risk checks, then GBA route.

0:55 Buyer
Property managers, building rehabilitation programs, smart-city accelerators, engineering consultants.

1:15 ROI
Test 10 smart-city hardware ideas before spending expert time and supplier calls on the best one.

1:35 Why Hong Kong / GBA
Hong Kong is the trusted pilot/front door. GBA is the manufacturing engine.

1:50 Business Model
Readiness packs, cohort licenses, RFQ workflow, verified supplier graph.

2:00 Close
We own the first mile: the moment a physical product idea becomes concrete enough for experts, suppliers and pilots.
```

## MVP Build Scope

Build:

- prompt input + pipeline stage indicator in LEFT panel
- **Context Gate** — clarification loop + delegated Hong Kong dense-city default
- **Context Agent** — deployment context JSON from user prompt
- **Compliance MCP** — source-backed Hong Kong constraints
- **Component Agent** — component graph from `component-catalog.json`
- **Hardware MCP** — assembly pattern validation
- **BOM Resolver** — catalog lookup, demo costs ($213 / $227)
- **DFMA Engine** — one weatherproofing warning + deterministic Apply Fix
- **Supplier MCP** — supplier questions + GBA route from `supplier-graph.json`
- **Scene MCP** — component ID → scene graph with assembly metadata
- 3D BuildGuard Node + X-Ray / Explode mode
- component click → BOM row highlight
- export / summary screen (Smart City Readiness Pack)
- deterministic recovery path for LLM/context failures
- no silent final-scene fallback if Scene MCP fails

Do not build:

- final CAD
- LLM-invented components, prices or supplier names
- real supplier scraping
- real quotes
- full marketplace
- multiple product families
- certified structural analysis
- replacement for MBIS or Registered Inspectors
- fake text-to-CAD claims
- hidden hardcoded full-pipeline JSON

Current data files (see `multi-agent-pipeline.md`):

- `frontend/data/component-catalog.json`
- `frontend/data/supplier-graph.json`
- `frontend/data/assembly-patterns.json`
- `frontend/data/dfma-rules.json`
- `frontend/data/compliance-rules.json`
