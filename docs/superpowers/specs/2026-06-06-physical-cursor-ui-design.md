# Physical Cursor — UI Design Spec

> Archived early UI spec. This file is not the runtime source of truth. Current implementation details, fallback policy and hardcode/default audit live in `docs/multi-agent-pipeline.md` and `docs/runtime-and-defaults-audit.md`.

Date: 2026-06-06  
Stack: Next.js (App Router), React Three Fiber, liquid-glass-js, ShaderGradient, Tailwind CSS

---

## Pages

### `/` — Projects Home

Grid of project cards. "New Project" card always first. Past projects loaded from localStorage.

Each card:
- Miniature 3D preview (static thumbnail or canvas snapshot)
- Project title (derived from first user message)
- Date created
- Status badge (Generating / Complete)

No auth. State persisted in localStorage as `projects: Project[]`.

---

### `/project/[id]` — Main Tool

Three-column layout, full viewport height, no scroll.

```
┌──────────────────────────────────────────────────────────────────┐
│ Header: "Physical Cursor"  [project title]     [Export Pack]     │
├─────────────┬──────────────────────────┬─────────────────────────┤
│ LEFT 280px  │ CENTER flex              │ RIGHT 360px             │
│             │                          │                         │
│ Deployment  │  React Three Fiber       │  Chat feed              │
│ Context     │  3D BuildGuard Node      │  (AI + user messages)   │
│ cards       │                          │  Warning cards          │
│             │  [Normal][X-Ray][Explode]│  Apply Fix buttons      │
│ ─────────── │                          │  File upload            │
│ BOM table   │  ShaderGradient bg       │  Input + send           │
│             │                          │                         │
│ ─────────── │                          │                         │
│ Supplier    │                          │                         │
│ route cards │                          │                         │
├─────────────┴──────────────────────────┴─────────────────────────┤
│ Progress bar: Context → 3D → X-Ray → Risk → Fix → Supplier → Export│
└──────────────────────────────────────────────────────────────────┘
```

---

## Design System

- Background: `#0a0a0a`
- Panels: liquid glass via `liquid-glass-js` (frosted dark glass, subtle border glow)
- Gradient: `ShaderGradient` behind the 3D CENTER panel (dark blue/purple, subtle, slow animation)
- Text: white (`#ffffff`) primary, `#888` secondary
- Accent: `#3b82f6` (blue) for active states, warnings in amber `#f59e0b`, critical in red `#ef4444`
- Typography: Inter or Geist (Next.js default)
- No rounded corners beyond 8px — clean, pro tool aesthetic

---

## Chat (RIGHT panel)

### Interaction model

Bidirectional. The AI drives the generation pipeline through conversation.

Flow:
1. User types problem (or uploads files: PDFs, images, specs)
2. AI extracts deployment context → LEFT panel populates with context cards
3. AI generates component graph → 3D appears in CENTER
4. AI narrates each component as the 3D explodes
5. World model fires warnings → warning card appears in chat with severity badge
6. User clicks [Apply Fix] in chat → 3D updates, BOM updates, cost changes
7. AI shows GBA supplier route → supplier cards appear in LEFT
8. AI offers export → [Export Smart City Readiness Pack] button in chat

The AI can ask clarifying questions at any step (e.g. "Is this node battery-powered or mains?").  
The user can ask follow-up questions or request changes ("make it solar-powered instead").

### Message types in chat feed

- `user` — user text message
- `ai` — AI text response (streaming)
- `context-card` — structured deployment context extract
- `warning-card` — DfMA warning with severity + affected components
- `action-button` — [Apply Fix], [Export Pack], [View X-Ray]
- `file-upload` — uploaded file reference

### File upload

Accept: PDF, PNG, JPG, DOCX. Sent to backend, content extracted, passed as context to LLM.

---

## LEFT panel

Three sections, separated by subtle dividers:

**Deployment Context**  
Cards populated as AI extracts from prompt. Each card: label + value (e.g. "Environment: humidity, rain, typhoon wind"). Cards animate in one by one.

**BOM Table**  
10 rows. Columns: Part | Supplier Route | Cost. Clicking a row highlights the corresponding component in the 3D. After Apply Fix: 3 new rows appear, total updates from $213 → $227.

**Supplier Route**  
4 cards: HK pilot integrator / SZ EMS / DG enclosure / HK-GZ compliance. Each card shows: company name (real, pre-scraped), location, product scope. Cards appear after AI reaches step 7.

---

## CENTER panel — 3D

Built with React Three Fiber.

**Normal mode**: assembled BuildGuard Node, slow rotation, mounted on facade surface.

**X-Ray mode**: enclosure becomes semi-transparent, internal components visible with labels.

**Explode mode**: components separate radially with labels floating next to each part. Clicking a component: highlights it (glow) + highlights corresponding BOM row in LEFT.

**Apply Fix**: gasket ring, PTFE membrane vent, drainage lip animate onto the model. Enclosure color transitions from red (warning) back to normal.

**ShaderGradient** background: slow-moving dark gradient (navy/indigo/black), gives depth behind the node.

3D model approach: procedural geometry in R3F (not imported CAD). Each component is a labeled primitive (box, cylinder, etc.) with material and position defined in a `BUILDGUARD_COMPONENTS` config.

---

## Data Flow

```
User message (chat)
  → POST /api/chat
    → LLM (Claude API, streaming)
      → streams deployment context → LEFT updates
      → streams component graph → 3D builds
      → calls world model team's API → warning returned
      → streams fix options → chat shows [Apply Fix]
      → streams supplier route → LEFT updates
  ← SSE stream of chat events
```

Apply Fix:
```
[Apply Fix] clicked
  → POST /api/fix { warningId }
    → returns { bomChanges, costDelta, componentChanges, rfqQuestions }
  ← 3D animates, BOM updates, cost updates
```

World model integration:
```typescript
// Called from /api/chat after ComponentGraph is generated
const warnings = await fetch(WORLD_MODEL_URL, {
  method: 'POST',
  body: JSON.stringify({ deploymentContext, componentGraph })
})
// Falls back to MOCK_WARNING if world model is unavailable
```

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14 (App Router) |
| 3D | React Three Fiber + @react-three/drei |
| Glass UI | liquid-glass-js |
| Gradient | ShaderGradient |
| Styling | Tailwind CSS |
| LLM | Claude API (claude-sonnet-4-6, streaming) |
| State | Zustand (project state, chat messages, 3D state) |
| Persistence | localStorage (projects list) |
| Supplier data | Pre-scraped JSON (static file, no live scraping at runtime) |

---

## Supplier Data Strategy

Pre-scrape before demo. For each of the 4 GBA supplier stops, find 2-3 real companies:

- HK pilot integrators: search HK smart building / IoT integrators
- Shenzhen EMS: JLCPCB, PCBWay, NextPCB level
- Dongguan enclosure/metal: search Dongguan enclosure manufacturers
- HK/GZ compliance: certification bodies, logistics

Output: `data/suppliers.json` — static file bundled with the app.

---

## Hardcoded Demo Data

All BuildGuard Node data is pre-defined in `data/buildguard.ts`:
- `DEPLOYMENT_CONTEXT` — the 9 context fields
- `COMPONENT_GRAPH` — 10 components with positions, labels, materials
- `BOM` — 10 rows + 3 fix rows
- `MOCK_WARNING` — IP_INSUFFICIENT warning
- `GBA_ROUTE` — 4 supplier stops

Archived instruction, no longer valid: early spec suggested silent hardcoded fallback. Current runtime uses documented parser/rule/catalog recovery paths, and final Scene MCP generation is required rather than silently faked.

---

## Export

"Smart City Readiness Pack" — triggered from chat button or header.  
Generates a single-page summary: deployment context + BOM + warning + fix + supplier route.  
Format: browser print-to-PDF or `jsPDF` generated in-browser.  
No backend needed for export.

---

## Out of Scope (POC)

- User authentication
- Real-time supplier scraping
- Multiple product families
- Certified structural analysis
- Live supplier quotes
- Multi-user collaboration
