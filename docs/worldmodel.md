# World Model — Object Simulation & Stress Test Layer

Derniere mise a jour : **2026-06-06**

Statut : **en cours de build pour le hackathon**

In the backend architecture, this layer is implemented as the **DFMA Engine** (step 4) in `multi-agent-pipeline.md`.

---

## What This Is

After Physical Cursor selects components from the catalog (Component Agent), the system needs to validate that the generated node is actually deployable in the extracted deployment context.

This is the simulation layer: a lightweight world model that stress-tests the generated node against the constraints of the real environment where it will live.

The output is not a physics engine. It is a set of structured validation checks that fire deterministic warnings — the same DfMA warnings the jury sees in the demo — but grounded in the deployment context extracted from the prompt.

---

## Why It Matters

Generating a 3D node is not enough. A jury of smart-city operators, hardware engineers or investors will immediately ask:

> "OK, but does it actually work in that environment?"

The simulation layer answers that question concretely:

- Can the camera hold on the ceiling given its weight and the mounting hardware?
- Does the enclosure resist the rain and wind expected in that location?
- Does the camera angle and field of view actually cover the target zone?
- Does the compute board overheat inside the sealed enclosure?
- Does the battery last long enough with this duty cycle?

Without this layer, the DfMA warnings feel like generic advice. With this layer, they feel like they came from a system that actually understands where the device is deployed.

This is the moat phrase:

> We do not just generate components. We validate the generated node against the deployment context before a single part is sourced.

---

## What The Layer Does

The simulation takes two inputs:

1. The `DeploymentContext` extracted from the user's prompt.
2. The `ComponentGraph` generated for the node.

It runs a set of domain-specific checks and returns structured warnings.

### Structural / Mechanical Checks

```
CEILING_LOAD:
  Check that total node mass ≤ rated load of mounting bracket for the target surface.
  Example: camera + enclosure + heat sink > ceiling tile rated load → flag MOUNTING_RISK.

WIND_LOAD:
  Check that enclosure drag profile is within structural limits for expected wind speed.
  Example: outdoor node > 40 cm² frontal area in a typhoon-zone → flag WIND_LOAD_RISK.

VIBRATION_TOLERANCE:
  Check that PCB components are rated for expected vibration (transport + operational).
  Example: dense urban environment next to MTR → flag PCB_VIBRATION_STRESS if no flexible mounts.
```

### Environmental / Weatherproofing Checks

```
IP_RATING:
  Check enclosure IP rating against outdoor humidity and rainfall.
  Example: IP54 enclosure in HK outdoor context (annual rainfall 2400 mm) → flag IP_INSUFFICIENT.

TEMPERATURE_RANGE:
  Check all component operating ranges against min/max ambient temperature.
  Example: Li-ion battery rated to 0°C in a node that may be deployed in a ventilated rooftop
  with winter dips → flag BATTERY_COLD_RISK.

HUMIDITY_INGRESS:
  Check that sensor vents, cable glands and seams are protected.
  Example: humidity sensor with open vent facing horizontal in a humid location → flag MEMBRANE_CLOG_RISK.

CORROSION:
  Check fastener and bracket material against coastal or polluted air context.
  Example: standard steel fasteners in HK marine-humidity zone → flag CORROSION_RISK.
```

### Thermal Checks

```
THERMAL_PATH:
  Check that each component generating > 500 mW has a defined thermal path to ambient.
  Example: edge AI compute dissipating 2W with no heat sink in sealed IP67 enclosure
  → flag THERMAL_RISK (default warning in the demo).

ENCLOSURE_TEMP_RISE:
  Estimate steady-state temperature inside sealed enclosure given total power dissipation
  and ambient temperature.
  Formula: ΔT = P_total / (k × A_surface), where k is enclosure material conductivity.
  Example: small ABS enclosure, 3W total, 38°C ambient → internal temp 72°C → flag OVERHEAT_RISK.

SOLAR_HEATING:
  Check if enclosure faces direct south-east sun in Hong Kong context.
  Example: outdoor node with dark enclosure + direct sun exposure → flag SOLAR_HEATING_RISK.
```

### Positional / Coverage Checks (camera or sensing nodes)

```
FIELD_OF_VIEW:
  Check that sensor angle and mounting height cover the target zone.
  Example: wide-angle camera at 3m ceiling height with 90° FoV → compute ground coverage radius.
  If crowd choke point is outside coverage → flag COVERAGE_GAP.

BLIND_SPOT:
  Check for structural obstructions (columns, signage) in field of view given mounting position.
  Example: mounting at ceiling corner of MTR concourse → flag COLUMN_BLIND_SPOT if column present.

MOUNTING_HEIGHT:
  Check that sensor mounting height is within optimal range for the sensing modality.
  Example: mmWave radar for crowd density optimal at 2.5–4m height → flag SUBOPTIMAL_HEIGHT if outside range.
```

### Power / Battery Checks

```
BATTERY_LIFE:
  Compute average current draw from ComponentGraph and project battery life.
  Example: 500 μA average × battery capacity → estimated months → flag SHORT_BATTERY if < target.

DUTY_CYCLE_FEASIBILITY:
  Check that the target battery life is achievable with plausible duty cycling.
  Example: edge AI running at 100% duty cycle → compute life → flag DUTY_CYCLE_REQUIRED.

SOLAR_SUFFICIENCY:
  If solar top-up is specified, check that panel output in target city covers delta.
  Example: 2W panel in Hong Kong average irradiance → annual kWh → compare to consumption.
```

---

## How Warnings Map To Demo Fixes

Each warning produced by the simulation has a corresponding Apply Fix action:

| Warning | Fix | Effect |
|---|---|---|
| THERMAL_RISK | Add heat sink + thermal paste + enclosure vent | Node 3D updates, BOM adds heat sink line, cost updates |
| IP_INSUFFICIENT | Add IP67 gasket seal + drainage channel | Enclosure note updates, BOM adds gasket kit |
| MOUNTING_RISK | Switch to heavy-duty bracket, add load check note | 3D bracket updates, RFQ adds load rating question |
| COVERAGE_GAP | Reposition node or switch to wider FoV sensor | Sensor module updates, deployment note updates |
| BATTERY_SHORT | Reduce duty cycle or add solar panel | BOM adds panel option, power note updates |
| CORROSION_RISK | Switch to 316L stainless fasteners | BOM material note updates |

---

## What The Layer Is Not

Do not claim this is a full physics engine or a real-time simulation.

Say:

> We extract the deployment context, then run a set of domain-specific structural, thermal, environmental and coverage checks against the generated node. Each check can fire a warning with a concrete fix.

Do not say:

> We simulate the full physical world.

Do not say:

> Our world model predicts real-world behavior with physics accuracy.

The credible framing is:

> A rule-based deployment validator informed by real engineering constraints, not a generic physics engine. Fast enough to run during the generation flow, specific enough to catch the failures that kill smart-city hardware pilots before they start.

---

## Focus For The Demo

For the hackathon, the simulation layer runs for **one object type only**.

Trying to stress-test every possible object (cameras, sensors, screws, generic IoT devices) in 48 hours is not credible. The right scope is:

> Deep, credible simulation for one object family, not shallow simulation for everything.

See `18_Demo_Object_Selection.md` for the candidate objects and the final selection.

---

## Technical Implementation

### Data Model

```typescript
type SimulationInput = {
  deploymentContext: DeploymentContext;
  componentGraph: ComponentGraph;
};

type SimulationWarning = {
  id: string;
  category: "structural" | "thermal" | "environmental" | "coverage" | "power";
  severity: "critical" | "warning" | "note";
  title: string;
  explanation: string;
  affectedComponents: string[];
  fix: SimulationFix;
};

type SimulationFix = {
  label: string;
  componentChanges: ComponentChange[];
  bomChanges: BOMChange[];
  costDelta: number;
  rfqQuestionsAdded: string[];
};

type SimulationResult = {
  warnings: SimulationWarning[];
  passedChecks: string[];
};
```

### Check Engine

Each check is a pure function:

```typescript
type CheckFn = (input: SimulationInput) => SimulationWarning | null;
```

The engine runs all checks, collects non-null results, sorts by severity, and surfaces the top 1-2 warnings for the demo flow.

For the hackathon: 5-8 checks implemented for the selected demo object. Checks are deterministic and seeded with real engineering values for that object family.

### Integration Point

In the multi-agent pipeline (`multi-agent-pipeline.md`), this layer **is** the **DFMA Engine** (step 4).

```
Context Agent → Component Agent → BOM Resolver → [DFMA Engine] → RFQ Agent + Scene Resolver
```

The DFMA Engine receives `DeploymentContext` + `ComponentGraph` + `BOM` and returns `DfmaResult` with warnings and deterministic fix actions.

**UI timing:** The 3D node can render as soon as the Scene Resolver has the `ComponentGraph` (visual impact first). Warnings appear as an overlay once the DFMA Engine completes — which matches the demo flow.

Apply Fix re-runs BOM Resolver and Scene Resolver with `add_component_ids` from the fix action. No LLM involved in validation or pricing.