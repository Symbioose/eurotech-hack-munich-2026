# Demo And Build Plan

## User Flow

User:

> Smart City innovation lead, property manager, building rehabilitation program, or accelerator manager.

Goal:

> Turn an aging-building problem into a reviewable smart-city hardware brief.

Flow:

```text
1. User enters the aging-building problem.
2. Physical Cursor extracts deployment context.
3. BuildGuard Node appears in 3D.
4. User opens X-Ray / Explode view.
5. Components appear and sync with BOM.
6. Weatherproofing risk turns enclosure red.
7. User clicks Apply Fix.
8. Seal/gasket appears; BOM, cost and RFQ update.
9. GBA supplier route appears.
10. User exports a Smart City Readiness Pack.
```

## Interface Layout

Keep the interface simple:

```text
LEFT: prompt + generated deployment context
CENTER: interactive 3D BuildGuard Node
RIGHT: components / BOM / warning / supplier route
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

0:15 Prompt
Paste the BuildGuard aging-building prompt.

0:25 Deployment Context
Show Hong Kong building, facade, MBIS, humidity, typhoon rain, limited access, no camera.

0:40 3D Generation
BuildGuard Node appears in 3D.

0:55 X-Ray / Explode
Show enclosure, crack sensor, vibration sensor, tilt sensor, moisture sensor, compute, radio, battery, bracket.

1:10 BOM Sync
Click crack sensor and moisture sensor; BOM rows highlight.

1:25 Risk
Weatherproofing warning appears; enclosure turns red.

1:35 Apply Fix
Add gasket, protected membrane and drainage lip; BOM/cost/RFQ update.

1:50 GBA Route
Show Hong Kong pilot integrator, Shenzhen EMS, Dongguan enclosure partner, HK/GZ compliance.

2:00 Close
Physical Cursor turns dense-city problems into reviewable smart-city hardware briefs.
```

## Business Video - 2 Minutes

Goal:

> Explain why this is a startup worth sending to Hong Kong.

Timeline:

```text
0:00 Problem
Smart cities need physical infrastructure, but hardware is slow before it can even be tested.

0:20 Hong Kong Pain
Aging buildings and MBIS create a concrete Smart City problem.

0:35 Product
Physical Cursor turns the problem into deployment context, 3D node, BOM, risk fix and GBA route.

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

- prompt input
- deployment context extraction
- 3D BuildGuard Node
- X-Ray / Explode mode
- component click -> BOM row highlight
- one weatherproofing DfMA warning
- Apply Fix update
- BOM and cost update
- RFQ questions update
- GBA supplier route
- export / summary screen

Do not build:

- final CAD
- real supplier scraping
- real quotes
- full marketplace
- multiple product families
- certified structural analysis
- replacement for MBIS or Registered Inspectors

