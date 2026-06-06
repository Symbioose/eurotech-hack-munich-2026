# Demo And Build Plan

## User Flow

User:

> Smart City innovation lead, property manager, building rehabilitation program, or accelerator manager.

Goal:

> Turn an aging-building problem into a reviewable smart-city hardware brief.

Flow (user-facing):

```text
1. User enters the aging-building problem.
2. Context Agent extracts deployment context (LEFT panel).
3. Component Agent selects catalog components; BOM Resolver fills the BOM (RIGHT panel).
4. BuildGuard Node appears in 3D (CENTER).
5. User opens X-Ray / Explode view.
6. Components sync with BOM rows on click.
7. DFMA Engine surfaces weatherproofing risk; enclosure turns red.
8. User clicks Apply Fix.
9. Seal/gasket appears; BOM, cost and RFQ update (deterministic).
10. RFQ Agent shows supplier questions and GBA route.
11. User exports a Smart City Readiness Pack.
```

Backend pipeline (runs behind steps 2–10):

```text
Prompt → Context Agent → Component Agent → BOM Resolver → DFMA Engine → RFQ Agent + Scene Resolver
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
Deployment context JSON appears: Hong Kong, facade, MBIS, humidity, typhoon, no camera.

0:30 Component Agent
Component graph from catalog — not invented parts.

0:38 BOM Resolver
BOM rows and $213 total from catalog lookup.

0:45 3D Generation
BuildGuard Node appears in 3D.

0:55 X-Ray / Explode
Show enclosure, crack sensor, vibration sensor, tilt sensor, moisture sensor, compute, radio, battery, bracket.

1:05 BOM Sync
Click crack sensor and moisture sensor; BOM rows highlight.

1:15 DFMA Engine
Weatherproofing warning appears; enclosure turns red. Say: deterministic rules, not LLM.

1:25 Apply Fix
Add gasket, protected membrane and drainage lip; BOM/cost/RFQ update ($213 → $227).

1:40 RFQ Agent
Supplier questions + GBA route from supplier graph.

1:50 Close
Physical Cursor: context → catalog selection → rule validation → supplier route.
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
Physical Cursor runs a multi-agent pipeline: context extraction, catalog-based component selection, deterministic risk checks, then GBA route.

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
- **Context Agent** — deployment context JSON from user prompt
- **Component Agent** — component graph from `component-catalog.json`
- **BOM Resolver** — catalog lookup, demo costs ($213 / $227)
- **DFMA Engine** — one weatherproofing warning + deterministic Apply Fix
- **RFQ Agent** — supplier questions + GBA route from `supplier-graph.json`
- **Scene Resolver** — component ID → 3D mesh / explode layout
- 3D BuildGuard Node + X-Ray / Explode mode
- component click → BOM row highlight
- export / summary screen (Smart City Readiness Pack)
- fallback JSON if any LLM agent fails on stage

Do not build:

- final CAD
- LLM-invented components, prices or supplier names
- real supplier scraping
- real quotes
- full marketplace
- multiple product families
- certified structural analysis
- replacement for MBIS or Registered Inspectors

Data files to add (see `multi-agent-pipeline.md`):

- `data/component-catalog.json`
- `data/supplier-graph.json`
- `data/fallback/buildguard-pipeline.json`
