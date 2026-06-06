# Product Brief - Physical Cursor

## One-Liner

> Physical Cursor turns dense-city problems into site-aware 3D smart-city nodes, then generates the deployment context, BOM, hardware risk fixes and Hong Kong/GBA supplier route.

## Problem

Smart cities need thousands of physical devices: sensors, edge-AI boxes, safety nodes, monitoring devices and public-space infrastructure.

But the entry point is too difficult. Before a city, operator or startup can even test one new smart device, the project usually gets blocked by:

- **vague idea** - the urban problem is clear, but the physical device is not.
- **no hardware expert at the starting point** - teams need mechanical, embedded, enclosure, power, RF and manufacturing input too early.
- **no component map** - nobody can see what sensors, compute, power, enclosure and connectivity the device needs.
- **no compliance / certification expert** - teams do not know what regulatory or deployment questions suppliers will ask.
- **no supplier-ready RFQ** - suppliers cannot answer a fuzzy sketch or generic prompt.
- **cost-estimation errors** - teams discover too late that a component, enclosure, MOQ or certification assumption breaks the economics.
- **no deployment context** - devices are designed "in a room" without humidity, rain, mounting, maintenance, privacy, RF or operator constraints.
- **slow time-to-pilot** - pilots are delayed because the first concrete brief takes too long to assemble.
- **hard to explain to investors and operators** - a slide, sketch or text file is not enough to make a physical infrastructure idea feel real.

Business-video hook:

> Smart cities do not lack ideas. They lack a fast first mile from city problem to reviewable physical device.

## Product

Physical Cursor makes the first version concrete through a **multi-agent pipeline** (see `multi-agent-pipeline.md`):

1. User describes a dense-city problem.
2. **Context Gate** verifies required context, asks at most three questions, or uses the explicit Hong Kong dense-city default when the user delegates choices.
3. **Context Agent** extracts a `DeploymentContext` JSON — no components yet.
4. **Compliance MCP** checks source-backed Hong Kong constraints.
5. **Component Agent** selects components from a verified catalog → `ComponentGraph`.
6. **Hardware MCP** validates the assembly pattern.
7. **BOM Resolver** (code) looks up prices and specs from the catalog.
8. **DFMA Engine** (code) flags deployment risks and deterministic fix actions.
9. The pipeline pauses at the risk checkpoint when a critical warning exists.
10. User clicks `Apply Fix` — component graph, BOM, cost, RFQ inputs and scene inputs update deterministically.
11. **Supplier MCP** generates supplier questions and a GBA route from the supplier graph.
12. **Scene MCP** generates the final 3D scene graph; user opens X-Ray / Explode view.
13. User exports a Smart City Readiness Pack.

User-facing story stays simple. Backend enforces: **catalog for hardware, rules for risks, supplier graph for routes**.

## Current Demo Object

**BuildGuard Node**

> A low-maintenance facade sensor node for aging Hong Kong residential buildings between Mandatory Building Inspection cycles.

Demo transformation:

> Aging-building problem -> Context Gate -> Context Agent -> Compliance MCP -> Component Agent -> Hardware MCP -> BOM -> DfMA warning -> Apply Fix -> Supplier MCP -> Scene MCP 3D node.

## What We Are Not Claiming

We are not claiming:

- final CAD generation
- certified structural safety
- replacement of Registered Inspectors
- real live supplier quotes
- full marketplace in 48 hours
- arbitrary hardware generation

Defense line:

> Physical Cursor does not replace hardware experts. It creates the first reviewable hardware brief experts and suppliers can evaluate.

## Business Model

Beachhead:

- paid Smart City Readiness Packs
- accelerator / innovation cohort licenses
- concierge review for high-value projects

Expansion:

- RFQ workflow subscription
- verified supplier profiles
- supplier lead fees
- quote comparison workspace
- later marketplace / referral revenue

Marketplace thesis:

> Every generated node creates structured demand: components, quantities, constraints, certifications, target price, timeline and pilot context. That demand can be routed to verified suppliers better than a generic supplier directory.

## Moat

The moat is not just 3D generation.

The moat is:

- deployment context model (Context Agent)
- clarification and delegated-default behavior (Context Gate)
- verified component catalog + inclusion rules (Component Agent)
- assembly-pattern validation (Hardware MCP)
- deterministic DfMA rule engine (DFMA Engine)
- required scene graph generation through Scene MCP
- BOM and RFQ structure
- verified GBA supplier graph (Supplier MCP)
- historical quote and outcome data over time
