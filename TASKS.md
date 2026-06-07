# TASKS - Manu (EuroTech Munich 2026)

Hackathon: June 6-7, 2026
Track: Smart City
Current branch: `feat/agent-orchestration-mcp`

This file reflects the current implementation. It is no longer the initial static-demo backlog.

---

## Current Runtime Contract

The current workspace flow is:

```text
Context Gate
  -> Context Agent
  -> Compliance MCP
  -> Component Agent
  -> Hardware MCP
  -> BOM Resolver
  -> DfMA Engine
  -> Risk Checkpoint
  -> Apply Fix
  -> Supplier MCP
  -> Scene MCP
  -> 3D / BOM / RFQ UI
```

Non-negotiable rules:

- Do not add a hidden full-pipeline fallback JSON.
- Do not silently fake final 3D if Scene MCP fails.
- Do not invent components outside `frontend/data/component-catalog.json`.
- Do not invent prices outside the catalog.
- Do not invent supplier names outside `frontend/data/supplier-graph.json`.
- Keep the context-gate delegated default documented in `docs/runtime-and-defaults-audit.md`.

---

## Implemented

- [x] Next.js frontend with project entry page and workspace.
- [x] Three-panel workspace with chat/tool trace, 3D center panel, context/BOM/supplier panels.
- [x] Context Gate via `/api/context/analyze`.
- [x] Non-repeating clarification flow.
- [x] Delegated user answer handling (`jsp fait comme tu veux`, `up to you`, etc.) with explicit Hong Kong dense-city default.
- [x] Context Agent with OpenAI JSON call plus parser fallback.
- [x] Component Agent with catalog-only validation.
- [x] Compliance MCP server.
- [x] Hardware MCP server.
- [x] Supplier MCP server.
- [x] Scene MCP server.
- [x] MCP tool allowlist in `frontend/lib/pipeline/agent-registry.ts`.
- [x] Agent trace and MCP tool-call status tracking.
- [x] Deterministic BOM resolver.
- [x] Deterministic DfMA rule engine.
- [x] Risk checkpoint before RFQ/final 3D when critical warning exists.
- [x] Apply Fix endpoint.
- [x] Required Scene MCP path in orchestrator.
- [x] Physical scene assembly metadata: placement, parent, anchor face, contact.
- [x] Explode-mode parent-child tethers.
- [x] Procedural 3D details: screws, vents, LED, PCB chips, antenna, gasket, membrane, drainage, fasteners.
- [x] Source refresh / research MCP path for candidate updates.
- [x] Tests for context gate, MCP ownership, DfMA, scene physics, assembly and part details.

---

## Current Demo Prompt

```text
A 52-year-old Hong Kong residential building needs a low-maintenance facade sensor node that monitors crack propagation, vibration anomalies, tilt shifts and moisture ingress, and creates early warnings before the next Mandatory Building Inspection.
```

Expected base BOM:

```text
$213
```

Expected after-fix BOM:

```text
$227
```

Expected critical warning:

```text
IP_INSUFFICIENT - Weatherproofing risk
```

Expected fix:

```text
Add IP67 gasket + PTFE membrane + drainage lip
```

Priced fix components:

- `ip67-gasket-kit` - $8
- `ptfe-membrane` - $4
- `316l-stainless-fasteners` - $2

Scene-only fix component:

- `drainage-lip` - $0

---

## P0 Before Demo

- [ ] Run full verification:

  ```bash
  cd frontend
  npm run test
  npm run lint
  npm run build
  ```

- [ ] Verify context gate endpoint:

  ```bash
  curl -s -X POST http://127.0.0.1:3000/api/context/analyze \
    -H 'Content-Type: application/json' \
    -d '{"prompt":"jsp fait comme tu veux"}'
  ```

  Expected fields:

  ```json
  {
    "status": "ready",
    "missingFields": [],
    "questions": []
  }
  ```

- [ ] Verify demo prompt pipeline through UI:
  - create/open a project
  - use demo prompt
  - confirm DfMA checkpoint appears
  - click Apply Fix
  - confirm 3D scene appears with gasket/membrane/fasteners/drainage
  - confirm supplier route appears

- [ ] Record 2-minute technical video from `docs/demo-and-build-plan.md`.
- [ ] Record 2-minute business video from `docs/demo-and-build-plan.md`.

---

## P1 Useful Improvements If Time Remains

- [ ] Add a visible "Using default Hong Kong dense-city context" message when delegated defaults trigger.
- [ ] Add Playwright visual smoke test once Playwright is installed.
- [ ] Add a "scene MCP failed" UI error state instead of leaving a running tool-call when SSE sends `error`.
- [ ] Move legacy `/api/chat` route behind a clear "deprecated" label or remove it if no longer needed.
- [ ] Expand component catalog to a second Smart City object family only after the BuildGuard demo is stable.

---

## Docs To Keep In Sync

- `README.md`
- `docs/README.md`
- `docs/multi-agent-pipeline.md`
- `docs/runtime-and-defaults-audit.md`
- `docs/buildguard-node.md`
- `docs/demo-and-build-plan.md`
- `docs/product-brief.md`
- `docs/agent-prompt.md`
- `frontend/README.md`
