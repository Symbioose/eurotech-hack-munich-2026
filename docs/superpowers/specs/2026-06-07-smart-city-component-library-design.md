# Smart City Component Library Design

## Decision

Build a real smart-city component library for Manu without changing the pitch.

The library will make BuildGuard one example among many. It will give the agent a broad, grounded set of parts to select from, render in 3D, price into a BOM and route into RFQ/supplier workflows.

Target scope for this iteration:

- 100 smart-city components total, including the current catalog.
- Smart-city only, with Hong Kong/GBA-compatible sourcing language.
- No claim of final CAD, live supplier quotes or certified design.
- No fake verification. Components can be `verified`, `seeded` or `candidate`, and the UI/export must keep that distinction.

## Problem

The current pipeline is technically grounded, but the runtime surface still looks too narrow:

- `frontend/data/component-catalog.json` has 26 components.
- `frontend/data/assembly-patterns.json` has 2 patterns.
- `frontend/lib/pipeline/inclusion-rules.ts` covers a small set of intents.
- `frontend/lib/scene/part-details.ts` adds rich visual detail mostly by BuildGuard-specific `scene_id`.

This weakens the technical deep dive because the demo can look like a BuildGuard-specific object generator rather than a smart-city hardware compiler.

## Goals

1. Let the Component Agent choose from a broad smart-city library instead of falling back to unverified custom parts for common urban hardware.
2. Keep the existing product story: first reviewable hardware brief, not final CAD.
3. Make generated devices visibly different in 3D across use cases.
4. Keep all catalog selections auditable through checked-in data and MCP tools.
5. Preserve deterministic fallback behavior when no OpenAI key is configured.

## Non-Goals

- Do not change the pitch, README one-liner or BuildGuard demo narrative.
- Do not build arbitrary physical-product generation outside smart city.
- Do not mark all 100 components as externally verified.
- Do not add live pricing, checkout, supplier commitments or certification claims.
- Do not replace the existing DfMA checkpoint; broaden it only where useful.

## Source Truth Model

Every catalog component keeps the existing shape:

```ts
type CatalogComponent = {
  id: string
  part: string
  category: string
  supplier_route: string
  cost_usd: number
  tags: string[]
  source?: SourceMetadata
  scene: SceneMetadata | null
}
```

The `source.source_status` field must be used honestly:

- `verified`: source-backed entry with real manufacturer/MPN, datasheet or distributor URL in `parts-registry.json`.
- `seeded`: curated generic component suitable for system design, BOM estimate and 3D visualization, but not a sourced purchasing line.
- `candidate`: agent/user-proposed or research-candidate component that needs confirmation before RFQ.

The first implementation should focus on a useful mix:

- 20-35 `verified` or registry-backed parts where realistic to add quickly.
- 65-80 `seeded` generic smart-city components with clear source status.
- 0 fake `verified` entries.

## Component Families

The 100-component library should cover these families:

- Core node infrastructure: enclosures, chassis, DIN rail, pole housings, vents, cable glands, gaskets, seals.
- Mounting and mechanical: wall brackets, pole clamps, rooftop tripods, ceiling mounts, anti-vibration pads, tamper screws.
- Compute: MCU boards, edge AI modules, industrial SBCs, secure elements, storage.
- Connectivity: LoRa, NB-IoT/LTE-M, Wi-Fi, Ethernet/PoE, GNSS, BLE, mesh, antennas.
- Power: battery packs, LiFePO4 cells, solar trickle panels, charge controllers, PoE splitters, DC converters, supercapacitors.
- Structural monitoring: crack, strain, vibration, tilt, displacement, acoustic emission.
- Environmental monitoring: temperature, humidity, pressure, rain, wind, UV, air quality, particulate, gas.
- Noise and public realm: acoustic level, vibration/noise, light level, pedestrian presence.
- Water and drainage: water level, flow, turbidity, conductivity, pH, leak, flood, pump relay.
- Mobility and curbside: traffic radar, magnetometer, parking occupancy, vehicle counter, bike counter.
- Transit and indoor: mmWave presence, PIR, CO2, people counting without facial recognition, display/status modules.
- Energy and utility: current transformer, smart meter reader, voltage monitor, cabinet temperature, relay.
- Waste and sanitation: ultrasonic bin level, load cell, odor/VOC, lid sensor.
- Safety and maintenance: tamper switch, service button, status LED, buzzer, watchdog, health sensor.
- DfMA/weatherproofing fixes: membranes, conformal coating, heat spreaders, corrosion-resistant fasteners, drainage features.

## Catalog Tags

Tags should become the practical interface between context, rules, MCP tools and scene generation.

Required tag groups:

- Intent tags: `air-quality`, `noise`, `flood`, `drainage`, `traffic`, `parking`, `occupancy`, `waste`, `energy`, `structural`, `weather`, `safety`, `transit`.
- Deployment tags: `outdoor`, `indoor`, `facade`, `rooftop`, `roadside`, `pole`, `ceiling`, `underground`, `utility-cabinet`, `water-contact`.
- Function tags: `sensor`, `compute`, `connectivity`, `power`, `mounting`, `enclosure`, `weatherproofing`, `indicator`, `actuator`.
- Constraint tags: `privacy-safe`, `privacy-sensitive`, `low-power`, `mains`, `battery`, `solar`, `poe`, `corrosion`, `sealed`.
- Selection tags: `required-outdoor`, `required-pole`, `required-ceiling`, `required-water`, `fix`.

## Component Selection

Update `frontend/lib/pipeline/inclusion-rules.ts` so deterministic selection becomes broad enough for the deep dive.

Selection should work in layers:

1. Add a base enclosure/chassis appropriate to the deployment.
2. Add compute if the prompt implies sensing, alerts, control or inference.
3. Add power from explicit context, or sensible defaults from deployment.
4. Add connectivity from explicit context, or low-power wide-area defaults for outdoor nodes.
5. Add sensors by intent keyword and tag.
6. Add mechanical/weatherproofing support by deployment.
7. Exclude privacy-sensitive components unless requested.

Example prompts that must produce distinct graphs:

- Facade structural monitoring -> crack, vibration, tilt, moisture, enclosure, bracket, LPWAN, battery.
- Roadside flood monitoring -> water level, rain, conductivity or turbidity, pole enclosure, solar/battery, LPWAN.
- Underground mall occupancy -> mmWave/PIR/CO2, ceiling mount, mains or PoE, privacy-safe connectivity.
- Smart bin monitoring -> ultrasonic level, load cell, odor/VOC, lid switch, battery, enclosure.
- Curbside parking -> magnetometer or radar, pole/roadside mounting, LPWAN, battery/solar.
- Utility cabinet monitoring -> current/voltage, cabinet temperature, tamper, DIN rail, mains/PoE.

## MCP Interface

Keep the current pipeline ownership model, but make the hardware MCP more useful for the library.

Add catalog-oriented tools to `frontend/mcp/hardware-server.mjs`:

- `search_components({ query, tags?, category?, limit? })`
- `recommend_components({ deploymentContext, limit? })`
- `get_component({ id })`
- `list_component_families()`

The Component Agent can continue using the catalog directly, but the MCP tools give the technical demo a clean inspection surface: the jury can see the agent searching a real component library instead of receiving a hidden JSON blob.

The orchestrator does not need a new stage in this iteration. It can still run:

```text
Context -> Compliance -> Component Agent -> Hardware MCP assembly validation -> BOM -> DfMA -> Supplier -> Scene
```

## Assembly Patterns

Expand `frontend/data/assembly-patterns.json` from 2 patterns to at least 7:

- `outdoor-battery-facade-iot-node`
- `indoor-privacy-preserving-ceiling-node`
- `roadside-pole-environment-node`
- `rooftop-weather-energy-node`
- `drainage-water-monitor-node`
- `utility-cabinet-monitor-node`
- `waste-bin-monitor-node`

Each pattern should define:

- `applies_when`
- required components by family/tag intent
- recommended component IDs
- deployment constraints
- assembly steps

The existing resolver can continue matching by keywords, but this iteration should add selected-component tag matching so patterns still resolve when the user prompt uses different wording from the catalog IDs.

## 3D Scene Design

The scene must remain parametric primitives, not CAD.

Update the visual system so components look good even when they are not BuildGuard parts:

- Keep catalog `scene` metadata for deterministic layout.
- Add generic visual details by category and tags in `frontend/lib/scene/part-details.ts`.
- Preserve existing BuildGuard-specific details.
- Add detail generators for common tags:
  - `air-quality`: vent grille and sensor aperture.
  - `water-contact`: probe tips and cable seal.
  - `radar`/`mmwave`: front radome.
  - `antenna`: whip or patch antenna.
  - `solar`: panel cells.
  - `battery`: terminals and charge band.
  - `waste`: bin-lid sensor shape.
  - `traffic`: radar face or road-facing module.
  - `din-rail`: rail clip.
  - `tamper`: microswitch detail.

If the current `getPartDetails(partId, scale)` signature is too narrow, change it to accept the component's category/tags while preserving compatibility:

```ts
getPartDetails(comp, scale)
```

## Scene Layout

Catalog entries need coherent scene placement.

Rules:

- Every generated graph should have one root: enclosure, chassis, pole housing, bin body or cabinet.
- Internal electronics live inside the root.
- External sensors attach to front/top/bottom depending on tag.
- Mounts and brackets attach behind or below the root.
- Water-contact components attach below or outside.
- Pole/roadside devices should not all look like facade boxes.

This iteration can use curated scene positions per catalog component. A later iteration can add a layout solver.

## DfMA

Do not overbuild DfMA in this pass. The implementation priority is library breadth, selection and 3D rendering. Add only high-signal deterministic checks after those are working:

- Outdoor weatherproofing risk for outdoor sensors without sealing/weatherproofing fixes.
- Water-contact ingress/corrosion risk for drainage/flood nodes.
- Privacy risk if camera is selected for occupancy/crowd prompts without explicit camera permission.
- Power mismatch note when battery-only design includes high-power sensors.

Existing BuildGuard weatherproofing behavior must remain unchanged.

## Supplier And RFQ

Do not create fake live suppliers.

Supplier route can remain generic GBA-focused, but RFQ questions should become component-tag aware:

- outdoor/weatherproofing -> IP rating, gasket, membrane, corrosion.
- battery/solar -> runtime, charging, battery shipping.
- RF/connectivity -> module certification, antenna placement.
- water-contact -> probe material, sealing, calibration.
- privacy-safe occupancy -> no imaging, data retention, coverage geometry.
- utility/energy -> isolation, safety, enclosure rating.

## Tests

Add or update tests to prove the library is functional:

- Catalog has at least 100 components.
- Every component has unique ID, category, tags, source status and valid scene metadata or explicit `scene: null`.
- Deterministic selection produces distinct graphs for at least 6 smart-city prompts.
- Camera is excluded unless explicitly requested.
- Hardware MCP `search_components` and `recommend_components` return catalog IDs only.
- Scene resolver returns coherent root/parent assembly for representative graphs.
- BuildGuard prompt still produces the expected core components and DfMA checkpoint.

## Demo Deep Dive Story

The technical deep dive can say:

> BuildGuard is not hardcoded. The agent selects from a checked-in smart-city component library. Components carry tags, source status, BOM assumptions and scene metadata. The same pipeline can produce facade, flood, occupancy, waste, parking or utility nodes while keeping the generated brief auditable.

Guardrail:

> Some entries are source-backed; others are seeded engineering assumptions for concept-stage briefs. The source status is explicit, and candidate parts are not presented as purchase-ready.

## Acceptance Criteria

- `frontend/data/component-catalog.json` contains at least 100 components.
- The existing BuildGuard flow and costs remain stable unless deliberately updated in tests.
- At least 6 non-BuildGuard prompts produce distinct component graphs without relying on unverified extras.
- The 3D scene shows recognizable differences across at least 4 device families.
- Hardware MCP exposes searchable/recommendable catalog tools.
- Tests pass for pipeline, MCP servers and scene assembly.
- Docs mention the expanded library without changing the product pitch.
