# Physical Cursor

**Physical Cursor for Smart City Nodes** is our EuroTech Hong Kong Hackathon project.

Track:

> **Smart City**

Goal:

> Win the Smart City track, then finish top 3 overall.

## One-Liner

> Physical Cursor turns dense-city problems into reviewable smart-city hardware briefs: deployment context, 3D node, component graph, BOM, hardware risk fix and Hong Kong/GBA supplier route.

## What We Are Building

Smart cities need thousands of physical devices, but the entry point is too hard:

- the idea is vague
- there is no hardware expert at the start
- there is no component map
- there is no deployment context
- there is no supplier-ready RFQ
- cost estimates are unreliable
- time-to-pilot is slow
- investors and operators struggle to understand the physical product from a slide or text file

Physical Cursor solves the first mile:

```text
Problem
-> Deployment Context
-> 3D Smart City Node
-> X-Ray / Explode
-> BOM + Sensor Graph
-> Hardware Risk
-> Apply Fix
-> GBA Supplier Route
```

It does **not** generate final CAD or replace hardware engineers. It creates the first reviewable hardware brief experts and suppliers can evaluate.

## Demo Proof: BuildGuard Node

**BuildGuard Node is the proof of Physical Cursor, not the whole company.**

BuildGuard is a low-maintenance facade sensor node for aging Hong Kong residential buildings between Mandatory Building Inspection cycles.

Demo prompt:

```text
A 52-year-old Hong Kong residential building needs a low-maintenance facade sensor node that monitors crack propagation, vibration anomalies, tilt shifts and moisture ingress, and creates early warnings before the next Mandatory Building Inspection.
```

Physical Cursor turns this into:

- deployment context
- 3D BuildGuard Node
- X-Ray / Explode view
- component graph
- BOM v0
- weatherproofing risk
- Apply Fix update
- RFQ questions
- Hong Kong/GBA supplier route

Killer line:

> Mandatory inspection tells you what is wrong every 10 years. BuildGuard tells you what is changing between inspections.

## Why Hong Kong / GBA

Hong Kong is the trusted front door:

- dense city testbed
- aging residential buildings
- smart-city operators and programs
- property managers, inspectors and building rehabilitation stakeholders

GBA is the manufacturing engine:

- Shenzhen electronics
- Dongguan enclosures and metal partners
- Hong Kong / Guangzhou compliance and logistics

## Deliverables

Hackathon deliverables:

- GitHub repository
- 2-minute business video
- 2-minute technical demo video

## Docs

Read:

- [`docs/README.md`](docs/README.md)
- [`docs/product-brief.md`](docs/product-brief.md)
- [`docs/buildguard-node.md`](docs/buildguard-node.md)
- [`docs/demo-and-build-plan.md`](docs/demo-and-build-plan.md)
- [`docs/agent-prompt.md`](docs/agent-prompt.md)

## Guardrails

Do not claim:

- final CAD
- certified structural safety
- replacement of Registered Inspectors
- live supplier quotes
- full marketplace in 48 hours
- arbitrary hardware generation

Say instead:

> Physical Cursor creates the first reviewable hardware brief: deployment context, 3D node, BOM, risk map, RFQ and supplier route.
