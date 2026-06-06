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
2. **Context Agent** extracts a `DeploymentContext` JSON — no components yet.
3. **Component Agent** selects components from a verified catalog → `ComponentGraph`.
4. **BOM Resolver** (code) looks up prices and specs from the catalog.
5. **DFMA Engine** (code) flags deployment risks and deterministic fix actions.
6. A 3D smart-city node appears; user opens X-Ray / Explode view.
7. **RFQ Agent** generates supplier questions and a GBA route from the supplier graph.
8. User clicks `Apply Fix` — BOM, cost, 3D model and RFQ update deterministically.
9. User exports a Smart City Readiness Pack.

User-facing story stays simple. Backend enforces: **catalog for hardware, rules for risks, supplier graph for routes**.

## Current Demo Object

**BuildGuard Node**

> A low-maintenance facade sensor node for aging Hong Kong residential buildings between Mandatory Building Inspection cycles.

Demo transformation:

> Aging-building problem -> Context Agent -> Component Agent -> BOM -> DFMA warning -> 3D node -> Apply Fix -> RFQ + GBA supplier route.

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
- verified component catalog + inclusion rules (Component Agent)
- deterministic DfMA rule engine (DFMA Engine)
- BOM and RFQ structure
- verified GBA supplier graph (RFQ Agent)
- historical quote and outcome data over time
