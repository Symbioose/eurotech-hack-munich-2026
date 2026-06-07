# HONESTY.md

> Mandatory disclosure for the hackathon. This file lives at the root of your repository. Judges cross-check it against your code and your technical video.
>
> **The deal:** disclosed shortcuts are **not** penalized — that is the entire point of this file. Hidden ones are. Undisclosed pre-built code is heavily penalized, each undisclosed mock carries a small penalty, and a faked demo is heavily penalized. Telling the truth here costs you nothing.

---

## 1. Team — who did what
Judges compare this against `git shortlog -sn`, so keep it honest.

| Member | GitHub handle | Main contributions |
|---|---|---|
| Emile Jouannet | @Symbioose | Project lead. Full pipeline orchestrator, all AI agents (context, component, DFMA, RFQ, scene, intent), MCP servers (compliance, hardware, sourcing, supplier), all JSON data files, marketplace, export, frontend architecture |
| Remi Brenaut | @remiku | 3D BuildGuard visualization (explode / x-ray / per-component risk coloring / damage tooltips / occlusion), simulation loop integration, world-model plan API, UI polish (collapsible panel, All-Components toggle), HONESTY file |
| Amaury Delille | @amaurydelille | Initial Next.js scaffold and Zustand store, simulation UI early iteration, agent orchestration prototype, context gate |
| Joanne Jabbour | @joannejab | Multi-agent system prototype, early 3D scene attempt |

---

## 2. What is fully working
Features that run end-to-end on the live app, with real data and real logic. Be specific: name the feature, what input it takes, what output it produces.

- **AI pipeline (OpenAI GPT-4.1-mini)** — user types a plain-English deployment problem; context agent, component-selection agent, DFMA engine, RFQ agent, and scene agent all make real structured-JSON API calls and stream results back via SSE. No stub responses.
- **World model (PyTorch backend)** — a 2-layer GRU + self-attention network is trained on synthetic HK climate data, produces a persisted `world_model.pt`, then a CEM planner runs adversarial stress protocols and returns per-step failure probabilities per component. The FastAPI backend is auto-started by the Next.js plan-route when not already running.
- **3D node visualization** — Three.js / React Three Fiber renders the smart-city node with explode mode, x-ray, per-component risk colour ramp (green → red), damage tooltips, occlusion check, orbit snap on component select, and a pause/resume rotation control.
- **MCP servers (compliance + hardware + sourcing)** — three Node.js MCP servers answer structured tool calls; each applies rule-based logic against local JSON, then calls the Tavily Search API for live web evidence when `TAVILY_API_KEY` is set.
- **Marketplace redirect with click logging** — every "Buy" click goes through `/api/go`, is logged to `data/_marketplace-clicks.jsonl`, tagged with UTM params, and 302-redirected to the real distributor search page (LCSC / Digi-Key / Octopart).
- **Export** — PDF readiness pack (jsPDF, full A4 layout), machine-readable JSON, and CSV download all work client-side.
- **Context gate** — the pipeline refuses to run if the input is not a hardware deployment problem; the gate uses a real GPT-4.1-mini call.

---

## 3. What is mocked, stubbed, or hardcoded
Every shortcut. Examples: a login that accepts any password, a payment that always succeeds, an "AI" that is an if/else, a database that is an in-memory dictionary, fake JSON returned instead of a real API call.

**Undisclosed mocks carry a small penalty each. Anything you list here = free.**

| What is faked | Where (file:line or folder) | Why we mocked it | What the real version would do |
|---|---|---|---|
| Component catalog | `frontend/data/component-catalog.json` | No time to wire a live distributor API during the hack | Pull live stock and pricing from Octopart / Nexar / LCSC API |
| Compliance rules database | `frontend/data/compliance-rules.json` | HK regulatory APIs (EMSD, PCPD, OFCA) require registration and approval | Live scrape / webhook from official HK government portals, versioned with last-checked timestamp |
| Supplier graph | `frontend/data/supplier-graph.json` | Fictional GBA supplier names; no real procurement integration | Verified supplier network with real contact info, MOQ, and lead-time data |
| Parts pricing | `frontend/lib/pipeline/sourcing.ts` (priceFactor multipliers) | Octopart/LCSC pricing APIs require a paid tier | Real-time price + stock check per MPN via Nexar or LCSC open API |
| Buy-link availability | `frontend/lib/pipeline/sourcing.ts` | Links go to real search-URLs on Digi-Key / LCSC / Octopart but stock is not verified at request time | Verify stock and price at click time via API before rendering the button |
| Affiliate / revenue program | `frontend/app/api/go/route.ts` | UTM tags are appended and clicks are logged, but no real affiliate program is enrolled | Enroll in Digi-Key / Mouser affiliate programs; replace the placeholder ref tag with a real token |
| World-model training data | `backend/training.py` | No real IoT sensor dataset available during the hack | Train on real sensor telemetry from deployed smart-city nodes; the model architecture is ready |
| Assembly patterns | `frontend/data/assembly-patterns.json` | Hand-authored during the hack | Generated from real IPC assembly standard rules |
| Demo object fixture | `frontend/data/demo-object.json` | Pre-seeded canonical scenario so the demo loads instantly without waiting for an LLM call | Any live pipeline run saved to disk |
| HK climate statistics in world model | `backend/training.py` (HK_MONTHLY_CLIMATE constants) | Copied from published HK Observatory averages (1961–2020), not from a live API | Subscribe to HK Observatory open-data feed for live environmental conditions |

---

## 4. External APIs, services & data sources
Everything the project calls or pretends to call. Mark each as real or mocked.

| Service / API / dataset | Used for | Real call or mocked? | Auth (sandbox / test key / none) |
|---|---|---|---|
| OpenAI GPT-4.1-mini | Context agent, component agent, RFQ agent, scene agent, intent classifier, context gate | **Real calls** | Own paid API key (`OPENAI_API_KEY`) |
| Tavily Search API | Live web evidence for compliance and hardware MCP tools | **Real calls** — falls back to static data gracefully when key absent | Own free-tier key (`TAVILY_API_KEY`) |
| Python FastAPI backend (`http://127.0.0.1:8000`) | World-model plan, compare, and stress-test endpoints | **Real calls** — Next.js auto-starts the process | Local process, no external auth |
| LCSC / Digi-Key / Octopart | Buy-link redirect (search-URL, not an API call) | **Search URL only** — no API call is made | None |
| HK Observatory climate averages | Seed distribution parameters for world-model synthetic training data | Used as hard-coded constants — no live API call | None |

---

## 5. Pre-existing code
Anything written **before** kickoff that we brought into this project: prior personal projects, forked open-source code, templates, boilerplate, internal libraries.

**Undisclosed pre-built code is heavily penalized. Anything you list here = free.**

All code in this repository was written during the hackathon window. No personal side-projects, private libraries, or forked repositories were brought in.

The stack uses standard open-source packages installed via npm / uv:

| Item | Source (URL or description) | Roughly how much | License |
|---|---|---|---|
| `openai` (npm) | OpenAI Node.js SDK | Dependency only | Apache-2.0 |
| `@modelcontextprotocol/sdk` | MCP server/client transport | Dependency only | MIT |
| `three` + `@react-three/fiber` + `@react-three/drei` | 3D rendering | Dependency only | MIT |
| `jspdf` | PDF export | Dependency only | MIT |
| `zustand` | Frontend state management | Dependency only | MIT |
| `next` | React framework | Dependency only | MIT |
| `torch` + `fastapi` + `uvicorn` (Python) | Neural network + API server | Dependency only | BSD-3 / MIT |

---

## 6. Known limitations & next steps
What we would build next, and the weak spots we already know about. Naming these honestly is a strength, not a flaw.

- **World model trained on synthetic data only** — the GRU + attention architecture is production-ready but the weights are trained on procedurally generated HK climate sequences, not real sensor logs; accuracy on real deployments is unknown.
- **Component catalog and compliance rules are static** — new components, price changes, EOL notices, and regulation updates require a manual file edit; a live Octopart/Nexar + HK government feed integration would fix this.
- **Single city (Hong Kong / GBA)** — deployment context is filtered to HK; extending to other smart-city contexts (Singapore, Dubai, Munich) requires adding compliance and climate datasets for those cities.
- **No user auth or server-side project persistence** — projects are stored in `localStorage`; a backend database would be needed for team sharing and history.
- **No real supplier verification** — the GBA supplier route is illustrative; real procurement would require verified contacts, NDA flows, and MOQ negotiation.
