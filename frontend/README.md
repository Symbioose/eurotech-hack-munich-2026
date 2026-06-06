# Physical Cursor Frontend

Next.js frontend for **Physical Cursor for Smart City Nodes**.

This is not a generic create-next-app demo. It is the hackathon workspace that turns a dense-city problem into a reviewable smart-city hardware brief.

---

## Run

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

Production checks:

```bash
npm run test
npm run lint
npm run build
```

---

## Environment

Optional:

```bash
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4.1-mini
TAVILY_API_KEY=...
```

Behavior:

- Without `OPENAI_API_KEY`, Context Agent and Component Agent use deterministic parsers/rules.
- Without `TAVILY_API_KEY`, research tools return `not_configured` and do not pretend live research happened.
- Scene generation still uses the local Scene MCP server.

---

## Main Runtime Flow

Workspace chat entrypoint:

```text
lib/pipeline-client.ts
```

API flow:

```text
/api/context/analyze
  -> /api/pipeline/generate
  -> /api/pipeline/apply-fix
  -> /api/world-model/plan
  -> /api/world-model/analyze
  -> /api/world-model/apply-fix
```

Pipeline:

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
```

The legacy `/api/chat` route is not the source of truth for the workspace pipeline.

---

## Key Files

| File | Role |
|---|---|
| `lib/context-gate.ts` | Required-context gate, LLM normalization, delegated defaults |
| `lib/context-gate-server.ts` | Context Gate LLM wrapper |
| `lib/pipeline/orchestrator.ts` | Pipeline state machine and risk checkpoint |
| `lib/pipeline/agent-runtime.ts` | Agent trace, MCP calls, required-vs-fallback tool policy |
| `lib/pipeline/agent-registry.ts` | Agent/tool allowlist |
| `lib/pipeline/context-agent.ts` | Prompt to `DeploymentContext` |
| `lib/pipeline/component-agent.ts` | Catalog-only component graph |
| `lib/pipeline/dfma-engine.ts` | Deterministic manufacturability checks |
| `lib/pipeline/scene-resolver.ts` | Local scene metadata inference used by Scene MCP/tests |
| `lib/world-model/agent.ts` | Deterministic world-model verdict agent |
| `mcp/scene-server.mjs` | Required scene graph MCP |
| `components/center/BuildGuardNode.tsx` | 3D node renderer |
| `components/center/SimulationReportsPanel.tsx` | World-model telemetry charts |
| `components/right/WorldModelVerdictCard.tsx` | Chat decision card for field-risk verdicts |
| `lib/scene/part-details.ts` | Procedural visual detail layer |
| `data/*.json` | Catalog, suppliers, assembly patterns, DfMA and compliance source data |

---

## Hardcode Policy

There are intentional constants and data fixtures:

- demo prompt button in `components/project/ContextEntryForm.tsx`
- delegated Hong Kong dense-city default in `lib/context-gate.ts`
- checked-in catalog/supplier/rule JSON under `data/`
- procedural 3D detail primitives in `lib/scene/part-details.ts`

These are documented in:

```text
../docs/runtime-and-defaults-audit.md
```

Do not add:

- hidden full-pipeline fallback JSON
- LLM-invented component IDs
- LLM-invented prices
- LLM-invented suppliers
- silent fake 3D fallback if Scene MCP fails

---

## World Model Agent

The world model is not only an animation. After `/api/world-model/plan` returns rollout steps, the frontend stores a `SimulationReport`, animates the 3D node, and calls `/api/world-model/analyze`.

The analyzer is deterministic in v1. It reads peak device risk, failure heads, component risk and stress action, then returns a typed verdict:

- `pass`: no hardware change required.
- `warning`: field hardening recommended.
- `critical`: build should be blocked until resilience fix is applied.

DfMA warnings and World Model verdicts are intentionally separate:

- DfMA catches manufacturability risks before production.
- World Model catches simulated field failures over time.

Fixes are applied through the existing pipeline. If a verdict maps to an existing DfMA fix, the app reuses `applyPipelineFix`; otherwise it applies a structured component edit and regenerates BOM, sourcing, RFQ and scene.

Local backend expectation:

- `/api/world-model/plan` proxies to the FastAPI backend in `../backend`.
- If `WORLD_MODEL_API_URL` is unset, the frontend targets `http://127.0.0.1:8000`.
- The route auto-starts `uv run uvicorn main:app --host 0.0.0.0 --port 8000` from `../backend` when needed.

When changing this integration, run:

```bash
npm run test -- __tests__/world-model-agent.test.ts __tests__/world-model-api.test.ts __tests__/pipeline-stream-world-model.test.ts __tests__/world-model-verdict-card.test.tsx __tests__/world-model-simulation.test.ts
npm run lint
npm run build
```

---

## Demo Prompt

```text
A 52-year-old Hong Kong residential building needs a low-maintenance facade sensor node that monitors crack propagation, vibration anomalies, tilt shifts and moisture ingress, and creates early warnings before the next Mandatory Building Inspection.
```

Expected flow:

1. Context Gate returns `ready`.
2. Pipeline runs context/compliance/components/assembly/BOM/DfMA.
3. DfMA emits `IP_INSUFFICIENT`.
4. UI pauses at risk checkpoint.
5. User applies DfMA fix.
6. Supplier MCP and Scene MCP run.
7. 3D scene appears with assembly metadata and fix details.
8. User runs World Model simulation.
9. Reports tab captures telemetry.
10. World Model Agent posts verdict card in chat.
11. User applies resilience fix if recommended.
12. User reruns simulation to compare field risk.

---

## Tests

Important tests:

- `__tests__/context-gate.test.ts`
- `__tests__/pipeline-client-gate.test.ts`
- `__tests__/agent-runtime.test.ts`
- `__tests__/mcp-servers.test.ts`
- `__tests__/pipeline.test.ts`
- `__tests__/scene-assembly.test.ts`
- `__tests__/scene-physics.test.ts`
- `__tests__/part-details.test.ts`
- `__tests__/world-model-agent.test.ts`
- `__tests__/world-model-api.test.ts`
- `__tests__/pipeline-stream-world-model.test.ts`
- `__tests__/world-model-verdict-card.test.tsx`
- `__tests__/world-model-simulation.test.ts`

Run:

```bash
npm run test
```
