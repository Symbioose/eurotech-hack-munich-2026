# TASKS — Physical Cursor (EuroTech Munich 2026)

Hackathon: June 6-7, 2026  
Team scope: everything except the World Model (simulation/validation layer)

---

## Strategy

The demo is scripted. The BuildGuard prompt and its outputs are fully pre-defined in the docs.  
Architecture: multi-agent pipeline — see `docs/multi-agent-pipeline.md`.  
LLM only for Context Agent, Component Agent and RFQ Agent. BOM, DFMA and 3D scene are deterministic code.  
Don't over-engineer — hardcode catalog + fallback JSON; add live LLM where it creates visible value for the jury.

---

## P0 — Foundation (do first, unblocks everything)

- [ ] **F0.1** Init frontend project (Next.js + Tailwind + Three.js/React Three Fiber)
- [ ] **F0.2** 3-panel layout skeleton: LEFT (prompt/context) | CENTER (3D) | RIGHT (BOM/warnings) + BOTTOM (progress bar)
- [ ] **F0.3** Define data contract with world model team: `SimulationWarning[]` input shape, timing, mock stub

---

## P1 — Static demo shell (makes the demo work end-to-end with hardcoded data)

- [ ] **S1.1** Prompt input + "Generate" button
- [ ] **S1.2** Hardcode deployment context output (from `buildguard-node.md`) + animated reveal
- [ ] **S1.3** Hardcode BOM table (10 rows, $213 total)
- [ ] **S1.4** Hardcode weatherproofing warning card (THERMAL_RISK / IP_INSUFFICIENT)
- [ ] **S1.5** Hardcode Apply Fix result: BOM adds 3 rows, cost $213 → $227, RFQ questions update
- [ ] **S1.6** GBA supplier route display (4 stops: HK integrator / SZ EMS / DG enclosure / HK-GZ compliance)
- [ ] **S1.7** Bottom progress bar (10 steps, advances manually during demo)
- [ ] **S1.8** Export / summary screen (Smart City Readiness Pack — static PDF or screenshot)

---

## P2 — 3D BuildGuard Node (the visual centerpiece)

- [ ] **3D.1** Static 3D model of BuildGuard Node in center panel (box-level abstraction is fine, not CAD)
- [ ] **3D.2** X-Ray / Explode toggle: components separate with labels
- [ ] **3D.3** Component click → highlight corresponding BOM row (and vice versa)
- [ ] **3D.4** Weatherproofing warning: enclosure turns red / pulses
- [ ] **3D.5** Apply Fix: gasket ring, membrane vent, drainage lip appear on model
- [ ] **3D.6** Camera orbit + zoom (mouse/trackpad)

---

## P3 — Multi-agent pipeline backend (needed for the technical demo)

- [ ] **B0** Data files: `component-catalog.json`, `supplier-graph.json`, `fallback/buildguard-pipeline.json`
- [ ] **B1** Context Agent — `POST /api/pipeline/generate` stage 1: prompt → `DeploymentContext` JSON (LLM)
- [ ] **B2** Component Agent — stage 2: `DeploymentContext` + catalog → `ComponentGraph` JSON (LLM + inclusion-rule validation)
- [ ] **B3** BOM Resolver — stage 3: `ComponentGraph` → `BOM` from catalog lookup (code)
- [ ] **B4** DFMA Engine — stage 4: `DeploymentContext` + `ComponentGraph` → `DfmaResult` / `SimulationWarning[]` (code; align with world model team)
- [ ] **B5** RFQ Agent — stage 5: warnings + graph → `RfqPack` JSON (LLM; route from `supplier-graph.json` only)
- [ ] **B6** Scene Resolver — stage 6: `ComponentGraph` → `SceneGraph` for 3D layer (code)
- [ ] **B7** Apply Fix endpoint: `POST /api/pipeline/apply-fix` — `warning_id` → updated BOM + scene + cost delta (deterministic)
- [ ] **B8** Pipeline orchestrator with stage events + fallback to `buildguard-pipeline.json` on LLM failure

---

## P4 — Polish & demo readiness

- [ ] **P4.1** Step-by-step guided demo mode (keyboard/click advances the flow smoothly for live presentation)
- [ ] **P4.2** Loading states + animated transitions between steps
- [ ] **P4.3** Mobile-off / full-screen layout (jury will see this on a laptop/projector)
- [ ] **P4.4** Error fallback: if LLM call fails, silently use hardcoded data (never break on stage)

---

## P5 — Videos (final deliverables)

- [ ] **V1** Record technical demo (2 min) — follow `demo-and-build-plan.md` script exactly
- [ ] **V2** Record business video (2 min) — follow `demo-and-build-plan.md` script
- [ ] **V3** Upload both to repo / submission

---

## Order of attack

```
F0 (foundation) → S1 (static shell) → 3D.1/3D.2 (model + explode) → 3D.3/3D.4/3D.5 (interactions) → B0/B1-B8 (multi-agent pipeline) → P4 (polish) → V1/V2 (videos)
```

Ship the static shell first. A full demo with hardcoded data beats a half-broken LLM integration.

---

## World model interface contract (to align with that team ASAP)

```typescript
// What we need from them
type SimulationWarning = {
  id: string;
  category: "structural" | "thermal" | "environmental" | "coverage" | "power";
  severity: "critical" | "warning" | "note";
  title: string;
  explanation: string;
  affectedComponents: string[];
  fix: {
    label: string;
    componentChanges: ComponentChange[];
    bomChanges: BOMChange[];
    costDelta: number;
    rfqQuestionsAdded: string[];
  };
};

// Mock stub for local dev
const MOCK_WARNING: SimulationWarning = {
  id: "IP_INSUFFICIENT",
  category: "environmental",
  severity: "critical",
  title: "Weatherproofing risk",
  explanation: "Moisture sensor and crack gauge exposed to HK humidity and typhoon rain — no IP-rated gasket or drainage path.",
  affectedComponents: ["weatherproof-enclosure", "moisture-sensor", "crack-sensor"],
  fix: {
    label: "Add IP67 gasket + PTFE membrane + drainage lip",
    componentChanges: [{ id: "weatherproof-enclosure", note: "add gasket seal" }],
    bomChanges: [
      { part: "IP67 gasket kit", supplier: "Dongguan enclosure supplier", cost: 8 },
      { part: "PTFE membrane", supplier: "Shenzhen distributor", cost: 4 },
      { part: "316L stainless fasteners", supplier: "Dongguan metal fab", cost: 2 }
    ],
    costDelta: 14,
    rfqQuestionsAdded: [
      "IP rating and test method for the enclosure",
      "Gasket material and compression spec",
      "Drainage channel dimensions"
    ]
  }
};
```
