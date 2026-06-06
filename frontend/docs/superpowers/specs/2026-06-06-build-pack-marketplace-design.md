# Build Pack Marketplace Design

Date: 2026-06-06

## Goal

Turn the existing hardware analysis output into a credible, demo-ready procurement experience.

The user should not only see a bill of materials. They should see a commandable Build Pack: a validated hardware kit with component purchase links, RFQ material, supplier routing, and clear sourcing confidence.

## Product Positioning

The marketplace is a Build Pack page, not a fake ecommerce checkout.

Primary story:

1. User describes a physical product.
2. The pipeline extracts context, checks compliance, selects components, builds a BOM, catches DfMA risks, applies fixes, and renders the 3D device.
3. The user opens the Build Pack Marketplace.
4. The marketplace makes the design actionable through buy links, RFQ export, supplier route, and source refresh.

The page should communicate in under 20 seconds:

- what the kit contains
- how much the BOM costs
- which parts are buyable now through distributor links
- which parts need RFQ or source confirmation
- what supplier route can turn the design into a pilot

## Non-Goals

- Do not simulate real checkout, payment, or shipping.
- Do not invent stock, live prices, supplier guarantees, or verification status.
- Do not hardcode demo-only marketplace rows in React components.
- Do not replace the current orchestrator or sourcing pipeline.
- Do not create a new persistence model unless the existing store becomes insufficient.

## Existing Foundation

The project already has the core data needed:

- `PipelineState` includes deployment context, BOM, DfMA, RFQ, scene, supplier route, and source metadata.
- `lib/pipeline/sourcing.ts` builds MPN, manufacturer, lifecycle, datasheet, and distributor offers from `parts-registry.json`.
- `BOMTable` already exposes per-part buy links through `/api/go`.
- `/api/go` already provides an owned marketplace redirect funnel with host allowlisting and click logging.
- `/api/research/refresh` already refreshes compliance and hardware candidate sources.
- `lib/export.ts` already exports PDF, JSON, and CSV procurement artifacts.

The marketplace should compose these pieces into a clearer end-user journey.

## UX Design

### Entry Point

Add a visible `Order Build Pack` CTA in the workspace once the pipeline has a completed BOM.

Placement:

- add the primary CTA near the existing `Export` action in the header
- do not add a second persistent CTA in the left panel for the first implementation

The CTA navigates to:

```text
/project/[id]/marketplace
```

If no pipeline state or BOM is available, the marketplace page should show a concise empty state that links back to the workspace.

### Marketplace Page

The dedicated page has four main zones.

#### Build Pack Header

Show:

- project title
- estimated BOM total
- number of parts
- buyable part count
- unverified part count
- sourcing state summary
- readiness score

The readiness score is a UI summary derived from known data:

- penalize candidate/error/not_configured sourcing rows
- penalize missing offers
- penalize active critical DfMA warnings
- boost if fix is applied and supplier route exists

The score is not a scientific certification. Label it as procurement readiness.

#### Procurement Actions

Primary actions:

- `Buy Parts`: opens or lists the best available distributor links per buyable BOM row.
- `Send RFQ Pack`: uses existing export/RFQ data to produce a supplier-ready pack.
- `Refresh Sourcing`: calls `/api/research/refresh` and marks returned findings as candidate updates.

These are sub-actions under the Build Pack, not separate competing flows.

#### Kit Contents

Show BOM rows grouped by meaningful category:

- sensors
- compute and connectivity
- power
- enclosure and mechanical
- other

Each line should show:

- part name
- MPN
- manufacturer
- lifecycle
- source badge
- best distributor
- estimated unit price
- buy link when available

Rows must preserve source truth:

- `verified`: live or manually verified source
- `seeded`: curated catalog/registry data
- `candidate`: candidate source or estimate requiring confirmation
- `not_configured`: source refresh not configured
- `error`: lookup failed

#### Supplier Route And RFQ

Show the route from `gbaRouteDisplay`, with generic route support for non-GBA contexts.

Show generated RFQ questions grouped by topic when topic metadata is available. If only strings are available in the UI store, show a flat RFQ list and preserve the original question text. The page should make it obvious that this is the handoff to EMS, enclosure, integrator, and compliance partners.

## Data Model

Add a marketplace helper layer:

```text
lib/marketplace/build-pack.ts
```

This module derives a UI-focused `BuildPack` object from existing pipeline/store state.

Initial types:

```ts
type BuildPack = {
  title: string
  summary: BuildPackSummary
  actions: ProcurementAction[]
  groups: KitGroup[]
  supplierRoute: GbaRouteDisplayStep[]
  rfqQuestions: RfqQuestionDisplay[]
  warnings: ReadinessFlag[]
}
```

The exact field names can change during implementation if the existing project types make a different shape cleaner, but the boundary must remain:

- helpers calculate
- components render
- APIs perform effects

React components should not duplicate best-offer selection, readiness scoring, grouping, or source status logic.

## Sourcing Truth Policy

The demo must be impressive because it is honest and actionable.

Rules:

- Prices from seeded catalog or deterministic offer multipliers remain estimates.
- Distributor links can be real search/product links, wrapped by `/api/go`.
- Unknown stock stays unknown.
- Tavily refresh results are candidate updates unless reviewed or connected to a real distributor/pricing API.
- The UI must expose source status near procurement decisions.
- Exports must keep source status and best offer fields.

## Components

Initial component split:

```text
components/marketplace/BuildPackHeader.tsx
components/marketplace/ProcurementActions.tsx
components/marketplace/KitContents.tsx
components/marketplace/SupplierRoutePanel.tsx
components/marketplace/RfqPackPanel.tsx
components/marketplace/SourceBadge.tsx
```

Keep styling consistent with the existing dark cockpit UI. The marketplace should feel denser and operational, not like a marketing landing page.

## Error Handling

- Missing pipeline state: show an empty state with a link back to the workspace.
- Missing BOM: show "No Build Pack generated yet".
- Refresh sourcing failure: keep existing data, show failed status, and do not change source truth.
- No buyable rows: disable `Buy Parts` and explain that RFQ/export is still available.
- No supplier route: show RFQ questions if available and explain that route generation is pending.

## Testing

Add focused tests for:

- Build Pack derivation helper
- best offer selection
- readiness score and flags
- grouping by part category/source data
- marketplace empty state
- marketplace rendering with seeded/candidate rows
- refresh sourcing not-configured path if touched

Before claiming complete, run:

```bash
npm run test
npm run lint
npm run build
```

If any command cannot run, report it clearly.

## Documentation Updates

When implementing this design, update `README.md` with:

- marketplace route
- Build Pack flow
- sourcing truth policy
- how `/api/go` fits the marketplace funnel
- how `/api/research/refresh` behaves with and without `TAVILY_API_KEY`
- verification commands

Avoid adding durable agent rules unless the implementation introduces a new project convention that future contributors must follow.

## Implementation Notes

- Read the relevant Next.js 16 docs under `node_modules/next/dist/docs/` before editing route/page code.
- Reuse existing export and sourcing functions where possible.
- Prefer small typed helpers over ad hoc calculations in components.
- Keep the marketplace page usable without network keys.
- Preserve the current demo path and do not regress the existing workspace flow.
