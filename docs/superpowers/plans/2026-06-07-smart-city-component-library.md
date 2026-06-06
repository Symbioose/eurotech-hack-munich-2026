# Smart City Component Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a 100-component smart-city library that the Physical Cursor pipeline can search, select, render, price and test without changing the existing pitch.

**Architecture:** Keep the current pipeline shape and strengthen its data layer. The checked-in catalog remains the source of truth; deterministic inclusion rules and hardware MCP tools make the library usable without OpenAI; scene rendering gets category/tag details so non-BuildGuard devices look distinct.

**Tech Stack:** Next.js 16, TypeScript, Vitest, React Three Fiber, local JSON data files, local MCP stdio servers.

---

## File Structure

- Modify: `frontend/data/component-catalog.json`
  Expands the catalog from 26 to at least 100 smart-city components. Existing BuildGuard IDs and prices stay stable.

- Modify: `frontend/data/assembly-patterns.json`
  Adds smart-city assembly patterns for roadside, rooftop, drainage, utility cabinet and waste-bin nodes.

- Modify: `frontend/data/parts-registry.json`
  Adds source-backed registry entries for components that can honestly be treated as `verified` or registry-backed.

- Modify: `frontend/lib/pipeline/inclusion-rules.ts`
  Generalizes deterministic component selection using intent, deployment and privacy tags.

- Modify: `frontend/lib/pipeline/assembly-resolver.ts`
  Adds selected-component tag matching so assembly patterns do not depend only on prompt wording.

- Modify: `frontend/mcp/hardware-server.mjs`
  Adds `recommend_components`, `get_component` and `list_component_families`; tightens `search_components` with `limit`.

- Modify: `frontend/mcp/scene-server.mjs`
  Mirrors assembly inference improvements for new smart-city scene families.

- Modify: `frontend/lib/pipeline/scene-resolver.ts`
  Mirrors scene assembly inference and root handling for deterministic/in-process scene generation.

- Modify: `frontend/lib/scene/part-details.ts`
  Adds generic visual detail generation by category/tags while preserving BuildGuard-specific details.

- Modify: `frontend/components/center/BuildGuardNode.tsx`
  Passes full component metadata or compatible detail context to the detail renderer.

- Modify: `frontend/lib/types.ts`
  Extends UI `Component3D` with optional `category` and `tags` for visual details.

- Modify: `frontend/lib/pipeline/to-ui.ts`
  Preserves category/tags from scene nodes if the scene contract is extended.

- Modify: `frontend/lib/pipeline/types.ts`
  Extends `SceneNode` with optional `category` and `tags`.

- Modify: `frontend/lib/pipeline/rfq-agent.ts`
  Adds tag-aware RFQ questions for water, battery/solar, RF, privacy-safe occupancy and utility nodes.

- Modify: `frontend/mcp/supplier-server.mjs`
  Mirrors RFQ tag logic for MCP supplier route calls.

- Test: `frontend/__tests__/component-library.test.ts`
  New catalog, selection and scene coherence tests.

- Modify: `frontend/__tests__/pipeline.test.ts`
  Adds multi-prompt deterministic pipeline coverage while preserving BuildGuard expectations.

- Modify: `frontend/__tests__/mcp-servers.test.ts`
  Adds hardware MCP catalog tool tests.

- Modify: `frontend/README.md`
  Documents the expanded library and source-status policy without changing the product pitch.

---

### Task 1: Add Catalog Invariant Tests

**Files:**
- Create: `frontend/__tests__/component-library.test.ts`

- [ ] **Step 1: Write failing catalog tests**

Create `frontend/__tests__/component-library.test.ts` with:

```ts
import { describe, expect, it } from 'vitest'
import { loadCatalog } from '../lib/pipeline/load-data'

const SOURCE_STATUSES = new Set(['seeded', 'candidate', 'verified', 'not_configured', 'error'])

describe('smart-city component library', () => {
  const catalog = loadCatalog()

  it('contains at least 100 grounded smart-city components', () => {
    expect(catalog.components.length).toBeGreaterThanOrEqual(100)
  })

  it('uses unique component ids with source status and tags', () => {
    const ids = catalog.components.map((component) => component.id)
    expect(new Set(ids).size).toBe(ids.length)

    for (const component of catalog.components) {
      expect(component.id).toMatch(/^[a-z0-9-]+$/)
      expect(component.part.length).toBeGreaterThan(2)
      expect(component.category.length).toBeGreaterThan(1)
      expect(component.tags.length).toBeGreaterThan(0)
      expect(component.source?.source_status).toBeTruthy()
      expect(SOURCE_STATUSES.has(component.source!.source_status)).toBe(true)
      expect(component.source?.update_strategy.length).toBeGreaterThan(5)
    }
  })

  it('keeps BuildGuard catalog ids and prices stable', () => {
    const byId = new Map(catalog.components.map((component) => [component.id, component]))

    expect(byId.get('weatherproof-enclosure')?.cost_usd).toBe(28)
    expect(byId.get('crack-displacement-sensor')?.cost_usd).toBe(34)
    expect(byId.get('vibration-sensor')?.cost_usd).toBe(18)
    expect(byId.get('tilt-sensor')?.cost_usd).toBe(22)
    expect(byId.get('moisture-sensor')?.cost_usd).toBe(16)
    expect(byId.get('edge-compute-board')?.cost_usd).toBe(44)
    expect(byId.get('lora-nbiot-module')?.cost_usd).toBe(19)
    expect(byId.get('battery-pack')?.cost_usd).toBe(24)
    expect(byId.get('mounting-bracket')?.cost_usd).toBe(8)
  })

  it('has enough parts across smart-city families for the agent to choose from', () => {
    const tags = new Set(catalog.components.flatMap((component) => component.tags))

    for (const required of [
      'air-quality',
      'noise',
      'flood',
      'drainage',
      'traffic',
      'parking',
      'occupancy',
      'waste',
      'energy',
      'structural',
      'weather',
      'utility-cabinet',
      'water-contact',
      'privacy-safe',
    ]) {
      expect(tags.has(required), `${required} tag missing`).toBe(true)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd frontend
npm run test -- __tests__/component-library.test.ts
```

Expected: FAIL because the catalog currently has 26 components.

- [ ] **Step 3: Commit failing test**

Run:

```bash
git add frontend/__tests__/component-library.test.ts
git commit -m "test: add smart city catalog invariants"
```

Expected: commit succeeds with only the new test file.

---

### Task 2: Expand The Component Catalog To 100 Components

**Files:**
- Modify: `frontend/data/component-catalog.json`
- Modify: `frontend/data/parts-registry.json`

- [ ] **Step 1: Add components without changing existing IDs**

Edit `frontend/data/component-catalog.json` so it contains at least 100 components. Keep all existing component objects and append new objects.

Use this source policy for each new component:

```json
"source": {
  "source_status": "seeded",
  "last_checked_at": "2026-06-07",
  "update_strategy": "curated_smart_city_library_seed_confirm_before_rfq"
}
```

For components with real registry data added to `parts-registry.json`, use:

```json
"source": {
  "source_status": "verified",
  "last_checked_at": "2026-06-07",
  "update_strategy": "registry_entry_with_datasheet_or_distributor_review"
}
```

Add these catalog IDs if they are not already present:

```text
outdoor-pole-enclosure
roadside-control-cabinet
din-rail-industrial-enclosure
ceiling-sensor-housing
rooftop-weather-shield
submersible-probe-housing
smart-bin-housing
pole-clamp-kit
ceiling-mount-plate
rooftop-tripod-mount
din-rail-clip
anti-vibration-mounts
tamper-resistant-screws
conformal-coating
thermal-pad-kit
heat-spreader-plate
uv-resistant-window
pressure-equalization-vent
waterproof-bulkhead-connector
strain-gauge-bridge
laser-distance-sensor
acoustic-emission-sensor
concrete-temperature-probe
barometric-pressure-sensor
rain-gauge
anemometer
uv-index-sensor
pm25-sensor
co2-sensor
voc-gas-sensor
no2-gas-sensor
ozone-gas-sensor
sound-level-sensor
ambient-light-sensor
water-level-ultrasonic
water-pressure-sensor
flow-meter-sensor
turbidity-sensor
conductivity-sensor
ph-sensor
leak-detection-rope
flood-float-switch
pump-relay-module
traffic-mmwave-radar
vehicle-magnetometer
parking-occupancy-magnetometer
vehicle-counter-loop-interface
bike-counter-radar
pedestrian-counter-mmwave
privacy-thermal-presence
people-counting-lidar
coarse-image-presence-sensor
smart-meter-optical-reader
current-transformer-clamp
voltage-monitor-module
cabinet-door-tamper-switch
cabinet-temperature-sensor
industrial-relay-output
ultrasonic-bin-level-sensor
bin-load-cell
odor-voc-sensor
bin-lid-open-switch
service-button
maintenance-nfc-tag
watchdog-timer-module
secure-element
edge-ai-accelerator
industrial-sbc
emmc-storage-module
rs485-transceiver
ethernet-poe-module
lte-m-nbiot-module
wifi-ble-module
gnss-module
ble-mesh-module
sub-ghz-antenna
lte-antenna
gnss-patch-antenna
rs485-terminal-block
lifepo4-battery-pack
solar-charge-controller
dc-dc-buck-converter
supercapacitor-bank
mains-ac-dc-module
poe-splitter
battery-fuel-gauge
energy-harvesting-pmic
e-paper-status-display
rgb-status-light-ring
piezo-buzzer
small-oled-display
camera-privacy-shutter
edge-camera-module
stereo-vision-module
thermal-camera-module
gateway-backhaul-router
local-data-logger
```

For every new component, add `scene` metadata with this shape, replacing `scene_id`, `label`, position, color, geometry and scale with values specific to that component:

```json
"scene": {
"scene_id": "water-level-ultrasonic",
"label": "Water Level Ultrasonic",
  "position": [0.0, 0.0, 0.0],
  "explodeOffset": [0.0, 0.0, 0.8],
  "color": "#64748b",
  "geometry": "box",
  "scale": [0.3, 0.2, 0.1]
}
```

Place root housings at `[0, 0, 0]`, internal electronics near z `0.05`, front-facing sensors near z `0.38`, top devices near y `0.75`, bottom/water-contact devices near y `-0.75`, and mounts near z `-0.48`.

- [ ] **Step 2: Add registry entries for source-backed parts**

Add at least 20 entries to `frontend/data/parts-registry.json` for common real modules and generic sourcing links. Use existing registry object shape. Prefer components where manufacturer/MPN is clear, such as:

```text
pm25-sensor
co2-sensor
mmwave-presence
edge-compute-board
microcontroller-board
lora-nbiot-module
lte-m-nbiot-module
wifi-ble-module
gnss-module
secure-element
current-transformer-clamp
voltage-monitor-module
poe-splitter
solar-charge-controller
battery-fuel-gauge
rs485-transceiver
ethernet-poe-module
voc-gas-sensor
water-level-ultrasonic
ultrasonic-bin-level-sensor
```

Use `verified: false` on distributor offers unless the exact product URL is a confirmed product page. Search URLs are allowed, but those offers must not imply live verification.

- [ ] **Step 3: Run catalog invariant tests**

Run:

```bash
cd frontend
npm run test -- __tests__/component-library.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit catalog expansion**

Run:

```bash
git add frontend/data/component-catalog.json frontend/data/parts-registry.json
git commit -m "feat: expand smart city component catalog"
```

Expected: commit succeeds with catalog and registry only.

---

### Task 3: Generalize Deterministic Component Selection

**Files:**
- Modify: `frontend/__tests__/component-library.test.ts`
- Modify: `frontend/lib/pipeline/inclusion-rules.ts`

- [ ] **Step 1: Add failing deterministic selection tests**

Append this block to `frontend/__tests__/component-library.test.ts`:

```ts
import { parseContextFromPrompt } from '../lib/pipeline/context-agent'
import { ruleBasedComponentGraph } from '../lib/pipeline/inclusion-rules'

const graphFor = (prompt: string) => {
  const ctx = parseContextFromPrompt(prompt)
  return ruleBasedComponentGraph(ctx, catalog).selected_component_ids
}

describe('smart-city deterministic component selection', () => {
  it('selects roadside flood monitoring hardware', () => {
    const ids = graphFor(
      'A Hong Kong roadside drainage channel needs an outdoor flood monitoring node that detects water level, rain intensity and conductivity, powered by solar battery and LoRa.'
    )

    expect(ids).toContain('water-level-ultrasonic')
    expect(ids).toContain('rain-gauge')
    expect(ids).toContain('conductivity-sensor')
    expect(ids).toContain('outdoor-pole-enclosure')
    expect(ids).toContain('solar-charge-controller')
  })

  it('selects privacy-safe underground mall occupancy hardware', () => {
    const ids = graphFor(
      'A Singapore underground mall needs a privacy-preserving ceiling node that monitors crowd occupancy, CO2 and pedestrian presence without facial recognition using PoE.'
    )

    expect(ids).toContain('mmwave-presence')
    expect(ids).toContain('co2-sensor')
    expect(ids).toContain('ceiling-mount-plate')
    expect(ids).toContain('ethernet-poe-module')
    expect(ids).not.toContain('camera-module')
  })

  it('selects smart bin monitoring hardware', () => {
    const ids = graphFor(
      'A Hong Kong public waste bin needs a smart sanitation node for fill level, load weight, odor and lid-open events with battery power.'
    )

    expect(ids).toContain('smart-bin-housing')
    expect(ids).toContain('ultrasonic-bin-level-sensor')
    expect(ids).toContain('bin-load-cell')
    expect(ids).toContain('odor-voc-sensor')
    expect(ids).toContain('bin-lid-open-switch')
  })

  it('selects curbside parking and traffic hardware', () => {
    const ids = graphFor(
      'A Shenzhen curbside parking pilot needs a roadside pole node that detects parking occupancy, vehicle counts and traffic speed using radar and magnetometer.'
    )

    expect(ids).toContain('traffic-mmwave-radar')
    expect(ids).toContain('parking-occupancy-magnetometer')
    expect(ids).toContain('vehicle-magnetometer')
    expect(ids).toContain('outdoor-pole-enclosure')
  })

  it('selects utility cabinet energy monitoring hardware', () => {
    const ids = graphFor(
      'A Hong Kong utility cabinet needs a monitoring node for current, voltage, cabinet temperature and door tamper events with mains power.'
    )

    expect(ids).toContain('din-rail-industrial-enclosure')
    expect(ids).toContain('current-transformer-clamp')
    expect(ids).toContain('voltage-monitor-module')
    expect(ids).toContain('cabinet-temperature-sensor')
    expect(ids).toContain('cabinet-door-tamper-switch')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cd frontend
npm run test -- __tests__/component-library.test.ts
```

Expected: FAIL because current inclusion rules do not select the new IDs.

- [ ] **Step 3: Replace keyword selection helpers**

Modify `frontend/lib/pipeline/inclusion-rules.ts` to add these helpers near the existing helper functions:

```ts
function contextText(ctx: DeploymentContext): string {
  return [
    ctx.city,
    ctx.site,
    ctx.surface,
    ctx.goal,
    ctx.regulation ?? '',
    ...ctx.environment,
    ...ctx.mounting,
    ...ctx.power,
    ...ctx.connectivity,
    ...ctx.privacy,
  ]
    .join(' ')
    .toLowerCase()
}

function addIfExists(catalogIds: Set<string>, selected: Set<string>, id: string) {
  if (catalogIds.has(id)) selected.add(id)
}

function addMany(catalogIds: Set<string>, selected: Set<string>, ids: string[]) {
  for (const id of ids) addIfExists(catalogIds, selected, id)
}

function includesAnyText(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword))
}
```

- [ ] **Step 4: Extend `ruleBasedComponentGraph` with smart-city intents**

Inside `ruleBasedComponentGraph`, keep the existing BuildGuard logic and add intent blocks after the current crack/vibration/tilt/moisture selections:

```ts
const fullText = contextText(ctx)

if (includesAnyText(fullText, ['flood', 'drainage', 'water level', 'stormwater', 'channel'])) {
  addMany(catalogIds, selected, [
    'outdoor-pole-enclosure',
    'water-level-ultrasonic',
    'rain-gauge',
    'conductivity-sensor',
    'waterproof-bulkhead-connector',
  ])
}

if (includesAnyText(fullText, ['occupancy', 'crowd', 'presence', 'pedestrian'])) {
  addMany(catalogIds, selected, ['mmwave-presence', 'pir-motion-sensor'])
  if (includesAnyText(fullText, ['co2', 'air quality'])) addIfExists(catalogIds, selected, 'co2-sensor')
  if (includesAnyText(fullText, ['ceiling', 'mall', 'indoor', 'underground'])) {
    addMany(catalogIds, selected, ['ceiling-sensor-housing', 'ceiling-mount-plate'])
  }
}

if (includesAnyText(fullText, ['waste', 'bin', 'sanitation', 'trash', 'rubbish'])) {
  addMany(catalogIds, selected, [
    'smart-bin-housing',
    'ultrasonic-bin-level-sensor',
    'bin-load-cell',
    'odor-voc-sensor',
    'bin-lid-open-switch',
  ])
}

if (includesAnyText(fullText, ['parking', 'traffic', 'vehicle', 'curbside', 'roadside'])) {
  addMany(catalogIds, selected, [
    'outdoor-pole-enclosure',
    'traffic-mmwave-radar',
    'parking-occupancy-magnetometer',
    'vehicle-magnetometer',
  ])
}

if (includesAnyText(fullText, ['utility cabinet', 'electrical cabinet', 'current', 'voltage', 'meter'])) {
  addMany(catalogIds, selected, [
    'din-rail-industrial-enclosure',
    'current-transformer-clamp',
    'voltage-monitor-module',
    'cabinet-temperature-sensor',
    'cabinet-door-tamper-switch',
    'din-rail-clip',
  ])
}

if (includesAnyText(fullText, ['air quality', 'pollution', 'pm2.5', 'pm25'])) {
  addMany(catalogIds, selected, ['pm25-sensor', 'voc-gas-sensor', 'no2-gas-sensor'])
}

if (includesAnyText(fullText, ['noise', 'sound', 'acoustic'])) {
  addIfExists(catalogIds, selected, 'sound-level-sensor')
}

if (includesAnyText(fullText, ['solar'])) {
  addMany(catalogIds, selected, ['solar-trickle-panel', 'solar-charge-controller'])
}

if (includesAnyText(fullText, ['poe', 'ethernet'])) {
  addMany(catalogIds, selected, ['ethernet-poe-module', 'poe-splitter'])
}

if (includesAnyText(fullText, ['mains'])) {
  addIfExists(catalogIds, selected, 'mains-ac-dc-module')
}

if (includesAnyText(fullText, ['lora', 'nb-iot', 'nb iot', 'outdoor', 'roadside', 'facade'])) {
  addIfExists(catalogIds, selected, 'lora-nbiot-module')
}
```

At the end of the function, before `excludeCameraUnlessRequested`, add:

```ts
if (selected.size > 0 && needsCompute) {
  addIfExists(catalogIds, selected, 'edge-compute-board')
}
```

- [ ] **Step 5: Run selection tests**

Run:

```bash
cd frontend
npm run test -- __tests__/component-library.test.ts __tests__/pipeline.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit selection rules**

Run:

```bash
git add frontend/__tests__/component-library.test.ts frontend/lib/pipeline/inclusion-rules.ts
git commit -m "feat: generalize smart city component selection"
```

Expected: commit succeeds.

---

### Task 4: Add Hardware MCP Catalog Tools

**Files:**
- Modify: `frontend/mcp/hardware-server.mjs`
- Modify: `frontend/__tests__/mcp-servers.test.ts`

- [ ] **Step 1: Add failing MCP tests**

Append this block to `frontend/__tests__/mcp-servers.test.ts`:

```ts
  it('hardware_mcp searches the expanded component catalog by tag and limit', async () => {
    const result = await callMcpTool('hardware', 'search_components', {
      query: 'water',
      tags: ['flood'],
      limit: 5,
    })

    expect(result.components.length).toBeGreaterThan(0)
    expect(result.components.length).toBeLessThanOrEqual(5)
    expect(result.components.every((component: { id: string }) => typeof component.id === 'string')).toBe(true)
  })

  it('hardware_mcp recommends components for a deployment context', async () => {
    const result = await callMcpTool('hardware', 'recommend_components', {
      deploymentContext: {
        ...DEPLOYMENT_CONTEXT,
        surface: 'roadside drainage channel',
        goal: 'monitor flood water level, rain and conductivity',
        power: ['solar-assisted', 'battery-powered'],
      },
      limit: 12,
    })

    const ids = result.components.map((component: { id: string }) => component.id)
    expect(ids).toContain('water-level-ultrasonic')
    expect(ids).toContain('rain-gauge')
  })

  it('hardware_mcp exposes component lookup and family tags', async () => {
    const component = await callMcpTool('hardware', 'get_component', {
      id: 'water-level-ultrasonic',
    })
    const families = await callMcpTool('hardware', 'list_component_families', {})

    expect(component.id).toBe('water-level-ultrasonic')
    expect(families.families).toContain('sensor')
    expect(families.intent_tags).toContain('flood')
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cd frontend
npm run test -- __tests__/mcp-servers.test.ts
```

Expected: FAIL because `recommend_components`, `get_component`, `list_component_families` or `limit` are missing.

- [ ] **Step 3: Add catalog helper functions in `hardware-server.mjs`**

Add these functions after `matchAssemblyPattern`:

```js
function componentText(component) {
  return `${component.id} ${component.part} ${component.category} ${(component.tags ?? []).join(' ')}`.toLowerCase()
}

function searchComponents({ query = '', tags = [], category = '', limit = 20 }) {
  const catalog = readData('component-catalog.json')
  const q = query.toLowerCase().trim()
  const wantedTags = new Set(tags)
  const results = catalog.components
    .map((component) => {
      const text = componentText(component)
      const queryScore = q && text.includes(q) ? 4 : 0
      const tagScore = (component.tags ?? []).filter((tag) => wantedTags.has(tag)).length * 3
      const categoryScore = category && component.category === category ? 2 : 0
      const keep =
        (!q || queryScore > 0) &&
        (wantedTags.size === 0 || tagScore > 0) &&
        (!category || component.category === category)
      return { component, score: queryScore + tagScore + categoryScore }
    })
    .filter((entry) => entry.score > 0 || (!q && wantedTags.size === 0 && !category))
    .sort((a, b) => b.score - a.score || a.component.id.localeCompare(b.component.id))
    .slice(0, Math.max(1, Math.min(50, limit)))
    .map((entry) => entry.component)

  return { components: results }
}

function recommendComponents({ deploymentContext, limit = 20 }) {
  const text = [
    deploymentContext.surface,
    deploymentContext.goal,
    deploymentContext.site,
    ...(deploymentContext.environment ?? []),
    ...(deploymentContext.mounting ?? []),
    ...(deploymentContext.power ?? []),
    ...(deploymentContext.connectivity ?? []),
    ...(deploymentContext.privacy ?? []),
  ]
    .join(' ')
    .toLowerCase()

  const tagMap = [
    ['flood', ['flood', 'drainage', 'water-contact', 'outdoor']],
    ['drainage', ['flood', 'drainage', 'water-contact', 'outdoor']],
    ['water level', ['flood', 'water-contact']],
    ['parking', ['parking', 'traffic', 'roadside']],
    ['traffic', ['traffic', 'roadside']],
    ['waste', ['waste']],
    ['bin', ['waste']],
    ['occupancy', ['occupancy', 'privacy-safe']],
    ['crowd', ['occupancy', 'privacy-safe']],
    ['air quality', ['air-quality']],
    ['pollution', ['air-quality']],
    ['noise', ['noise']],
    ['utility cabinet', ['utility-cabinet', 'energy']],
    ['current', ['energy', 'utility-cabinet']],
    ['voltage', ['energy', 'utility-cabinet']],
    ['facade', ['facade', 'structural', 'outdoor']],
    ['structural', ['structural']],
  ]
  const tags = [...new Set(tagMap.flatMap(([keyword, mapped]) => (text.includes(keyword) ? mapped : [])))]
  return searchComponents({ query: '', tags, category: '', limit })
}

function getComponent({ id }) {
  const catalog = readData('component-catalog.json')
  const component = catalog.components.find((entry) => entry.id === id)
  if (!component) return { error: `Component not found: ${id}` }
  return component
}

function listComponentFamilies() {
  const catalog = readData('component-catalog.json')
  const families = [...new Set(catalog.components.map((component) => component.category))].sort()
  const intentTags = [
    'air-quality',
    'noise',
    'flood',
    'drainage',
    'traffic',
    'parking',
    'occupancy',
    'waste',
    'energy',
    'structural',
    'weather',
    'safety',
    'transit',
  ].filter((tag) => catalog.components.some((component) => component.tags?.includes(tag)))

  return { families, intent_tags: intentTags }
}
```

- [ ] **Step 4: Register the new MCP tools**

Replace the existing `search_components` handler with:

```js
server.registerTool(
  'search_components',
  {
    title: 'Search Smart-City Components',
    description: 'Search the grounded smart-city hardware catalog by query, tag or category.',
    inputSchema: {
      query: z.string().optional(),
      tags: z.array(z.string()).optional(),
      category: z.string().optional(),
      limit: z.number().min(1).max(50).default(20),
    },
  },
  async (input) => toolResult(searchComponents(input))
)
```

Register these tools before `match_assembly_pattern`:

```js
server.registerTool(
  'recommend_components',
  {
    title: 'Recommend Smart-City Components',
    description: 'Recommend catalog components from a deployment context.',
    inputSchema: {
      deploymentContext: z.record(z.string(), z.any()),
      limit: z.number().min(1).max(50).default(20),
    },
  },
  async (input) => toolResult(recommendComponents(input))
)

server.registerTool(
  'get_component',
  {
    title: 'Get Component',
    description: 'Return one catalog component by id.',
    inputSchema: { id: z.string() },
  },
  async (input) => toolResult(getComponent(input))
)

server.registerTool(
  'list_component_families',
  {
    title: 'List Component Families',
    description: 'List available catalog categories and primary smart-city intent tags.',
    inputSchema: {},
  },
  async () => toolResult(listComponentFamilies())
)
```

- [ ] **Step 5: Run MCP tests**

Run:

```bash
cd frontend
npm run test -- __tests__/mcp-servers.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit MCP tools**

Run:

```bash
git add frontend/mcp/hardware-server.mjs frontend/__tests__/mcp-servers.test.ts
git commit -m "feat: expose smart city catalog through hardware mcp"
```

Expected: commit succeeds.

---

### Task 5: Expand Assembly Patterns And Tag Matching

**Files:**
- Modify: `frontend/data/assembly-patterns.json`
- Modify: `frontend/lib/pipeline/assembly-resolver.ts`
- Modify: `frontend/mcp/hardware-server.mjs`
- Modify: `frontend/__tests__/component-library.test.ts`

- [ ] **Step 1: Add failing assembly tests**

Append this block to `frontend/__tests__/component-library.test.ts`:

```ts
import { resolveAssemblyPattern } from '../lib/pipeline/assembly-resolver'

describe('smart-city assembly patterns', () => {
  it('matches drainage, waste and utility patterns from selected components', () => {
    const floodCtx = parseContextFromPrompt(
      'A roadside drainage channel needs flood water level and rain monitoring with solar battery.'
    )
    const floodGraph = {
      node_type: 'roadside-drainage-node',
      selected_component_ids: graphFor(
        'A roadside drainage channel needs flood water level and rain monitoring with solar battery.'
      ),
    }
    expect(resolveAssemblyPattern(floodCtx, floodGraph).pattern_id).toBe('drainage-water-monitor-node')

    const wasteCtx = parseContextFromPrompt(
      'A public waste bin needs fill level, load, odor and lid-open monitoring.'
    )
    const wasteGraph = {
      node_type: 'smart-bin-node',
      selected_component_ids: graphFor(
        'A public waste bin needs fill level, load, odor and lid-open monitoring.'
      ),
    }
    expect(resolveAssemblyPattern(wasteCtx, wasteGraph).pattern_id).toBe('waste-bin-monitor-node')

    const utilityCtx = parseContextFromPrompt(
      'A utility cabinet needs current voltage cabinet temperature and door tamper monitoring.'
    )
    const utilityGraph = {
      node_type: 'utility-cabinet-node',
      selected_component_ids: graphFor(
        'A utility cabinet needs current voltage cabinet temperature and door tamper monitoring.'
      ),
    }
    expect(resolveAssemblyPattern(utilityCtx, utilityGraph).pattern_id).toBe('utility-cabinet-monitor-node')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cd frontend
npm run test -- __tests__/component-library.test.ts
```

Expected: FAIL because the new patterns do not exist or are not matched.

- [ ] **Step 3: Add assembly patterns**

Append these pattern objects to `frontend/data/assembly-patterns.json`:

```json
{
  "id": "roadside-pole-environment-node",
  "label": "Roadside pole environment node",
  "applies_when": {
    "surface_keywords": ["roadside", "pole", "curbside", "street"],
    "power_keywords": ["battery", "solar"],
    "goal_keywords": ["air", "noise", "traffic", "parking", "pollution"]
  },
  "required_component_ids": ["outdoor-pole-enclosure", "edge-compute-board", "lora-nbiot-module"],
  "recommended_component_ids": ["pole-clamp-kit", "solar-charge-controller", "sub-ghz-antenna"],
  "constraints": [
    "Roadside pole nodes need anti-tamper mounting, cable strain relief and antenna clearance.",
    "Traffic-facing sensors should be aimed without collecting personally identifying imagery unless explicitly required."
  ],
  "assembly_steps": [
    "Clamp the pole enclosure to a rigid pole section with service access facing the sidewalk.",
    "Mount radar or environmental sensors on the road-facing side of the enclosure.",
    "Route antenna and solar wiring through sealed cable glands."
  ]
}
```

Append these additional pattern objects:

```json
{
  "id": "rooftop-weather-energy-node",
  "label": "Rooftop weather and energy node",
  "applies_when": {
    "surface_keywords": ["rooftop", "roof", "weather"],
    "power_keywords": ["solar", "battery"],
    "goal_keywords": ["weather", "wind", "rain", "uv", "energy"]
  },
  "required_component_ids": ["rooftop-weather-shield", "edge-compute-board", "lora-nbiot-module"],
  "recommended_component_ids": ["rain-gauge", "anemometer", "uv-index-sensor", "solar-charge-controller", "rooftop-tripod-mount"],
  "constraints": [
    "Rooftop weather nodes need wind-rated mounting and clear exposure above nearby obstructions.",
    "Solar-assisted rooftop nodes need protected charge control and cable strain relief."
  ],
  "assembly_steps": [
    "Mount the weather shield to the rooftop tripod with the service side reachable from the roof path.",
    "Place rain, wind and UV sensors above the enclosure shadow line.",
    "Route solar panel wiring through a sealed gland into the charge controller."
  ]
}
```

```json
{
  "id": "drainage-water-monitor-node",
  "label": "Drainage water monitor node",
  "applies_when": {
    "surface_keywords": ["drainage", "channel", "roadside", "water"],
    "power_keywords": ["battery", "solar"],
    "goal_keywords": ["flood", "water", "rain", "conductivity", "level"]
  },
  "required_component_ids": ["outdoor-pole-enclosure", "edge-compute-board", "lora-nbiot-module", "waterproof-bulkhead-connector"],
  "recommended_component_ids": ["water-level-ultrasonic", "rain-gauge", "conductivity-sensor", "solar-charge-controller", "pole-clamp-kit"],
  "constraints": [
    "Drainage nodes need water-contact materials, sealed cable pass-throughs and corrosion-resistant fasteners.",
    "Water-level sensors must be aimed at the channel surface without being submerged during normal operation."
  ],
  "assembly_steps": [
    "Mount the pole enclosure above expected flood height.",
    "Aim the water-level sensor downward toward the channel measurement point.",
    "Route water-contact probes through a bulkhead connector with drip loops and strain relief."
  ]
}
```

```json
{
  "id": "utility-cabinet-monitor-node",
  "label": "Utility cabinet monitor node",
  "applies_when": {
    "surface_keywords": ["cabinet", "utility", "electrical"],
    "power_keywords": ["mains", "poe"],
    "goal_keywords": ["current", "voltage", "temperature", "tamper", "meter"]
  },
  "required_component_ids": ["din-rail-industrial-enclosure", "edge-compute-board", "mains-ac-dc-module"],
  "recommended_component_ids": ["current-transformer-clamp", "voltage-monitor-module", "cabinet-temperature-sensor", "cabinet-door-tamper-switch", "din-rail-clip"],
  "constraints": [
    "Utility cabinet monitors need isolation boundaries documented before installation.",
    "Cabinet sensors should mount on DIN rail or serviceable internal surfaces without obstructing breakers or service labels."
  ],
  "assembly_steps": [
    "Clip the industrial enclosure to DIN rail or a cabinet service plate.",
    "Route current and voltage sensing through isolated terminals.",
    "Mount the tamper switch so cabinet door movement is detected without preventing closure."
  ]
}
```

```json
{
  "id": "waste-bin-monitor-node",
  "label": "Waste bin monitor node",
  "applies_when": {
    "surface_keywords": ["bin", "waste", "sanitation"],
    "power_keywords": ["battery"],
    "goal_keywords": ["waste", "fill", "odor", "lid", "load"]
  },
  "required_component_ids": ["smart-bin-housing", "edge-compute-board", "battery-pack"],
  "recommended_component_ids": ["ultrasonic-bin-level-sensor", "bin-load-cell", "odor-voc-sensor", "bin-lid-open-switch", "maintenance-nfc-tag"],
  "constraints": [
    "Waste-bin nodes need protected sensor windows, odor exposure isolation and serviceable battery access.",
    "Load sensors need mechanical load paths that do not bypass the measurement point."
  ],
  "assembly_steps": [
    "Mount the housing under the lid or on a protected side wall.",
    "Aim the ultrasonic level sensor into the bin volume away from the lid hinge.",
    "Place the load cell in the supported load path and keep electronics isolated from liquid ingress."
  ]
}
```

- [ ] **Step 4: Add selected-component tag matching**

In `frontend/lib/pipeline/assembly-resolver.ts`, load the catalog and add selected tag scoring. Implement the same logic in `frontend/mcp/hardware-server.mjs` so MCP and in-process resolver agree.

Use this scoring shape:

```ts
function selectedTags(graph: ComponentGraph): Set<string> {
  const catalog = loadCatalog()
  const byId = new Map(catalog.components.map((component) => [component.id, component]))
  return new Set(
    graph.selected_component_ids.flatMap((id) => byId.get(id)?.tags ?? [])
  )
}

function scoreTagOverlap(tags: Set<string>, pattern: AssemblyPattern): number {
  const keywords = [
    ...(pattern.applies_when.surface_keywords ?? []),
    ...(pattern.applies_when.power_keywords ?? []),
    ...(pattern.applies_when.privacy_keywords ?? []),
    ...(pattern.applies_when.goal_keywords ?? []),
  ]
  return keywords.filter((keyword) => tags.has(keyword)).length * 2
}
```

Add `scoreTagOverlap(selectedTags(componentGraph), pattern)` to pattern scoring.

- [ ] **Step 5: Run assembly and pipeline tests**

Run:

```bash
cd frontend
npm run test -- __tests__/component-library.test.ts __tests__/pipeline.test.ts __tests__/mcp-servers.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit assembly expansion**

Run:

```bash
git add frontend/data/assembly-patterns.json frontend/lib/pipeline/assembly-resolver.ts frontend/mcp/hardware-server.mjs frontend/__tests__/component-library.test.ts
git commit -m "feat: add smart city assembly patterns"
```

Expected: commit succeeds.

---

### Task 6: Make Scene Nodes Carry Tags And Render Family Details

**Files:**
- Modify: `frontend/lib/pipeline/types.ts`
- Modify: `frontend/lib/types.ts`
- Modify: `frontend/lib/pipeline/to-ui.ts`
- Modify: `frontend/mcp/scene-server.mjs`
- Modify: `frontend/lib/pipeline/scene-resolver.ts`
- Modify: `frontend/lib/scene/part-details.ts`
- Modify: `frontend/components/center/BuildGuardNode.tsx`
- Modify: `frontend/__tests__/component-library.test.ts`

- [ ] **Step 1: Add failing scene family tests**

Append this block to `frontend/__tests__/component-library.test.ts`:

```ts
import { resolveScene } from '../lib/pipeline/scene-resolver'
import { getPartDetails } from '../lib/scene/part-details'

describe('smart-city scene rendering metadata', () => {
  it('preserves category and tags on scene nodes', () => {
    const graph = {
      node_type: 'drainage-water-node',
      selected_component_ids: ['outdoor-pole-enclosure', 'water-level-ultrasonic', 'rain-gauge'],
    }
    const scene = resolveScene(graph, catalog)
    const water = scene.nodes.find((node) => node.component_id === 'water-level-ultrasonic')

    expect(water?.category).toBe('sensor')
    expect(water?.tags).toContain('water-contact')
  })

  it('generates visual details from tags for non-BuildGuard parts', () => {
    const details = getPartDetails(
      {
        id: 'water-level-ultrasonic',
        category: 'sensor',
        tags: ['sensor', 'flood', 'water-contact'],
      },
      [0.18, 0.16, 0.12]
    )

    expect(details.map((detail) => detail.role)).toContain('probe-tip')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cd frontend
npm run test -- __tests__/component-library.test.ts
```

Expected: FAIL because `SceneNode` lacks category/tags and `getPartDetails` accepts only `partId`.

- [ ] **Step 3: Extend scene and UI types**

In `frontend/lib/pipeline/types.ts`, add optional fields to `SceneNode`:

```ts
category?: string
tags?: string[]
```

In `frontend/lib/types.ts`, add optional fields to `Component3D`:

```ts
category?: string
tags?: string[]
```

In `frontend/lib/pipeline/to-ui.ts`, map them:

```ts
category: n.category,
tags: n.tags,
```

- [ ] **Step 4: Add category/tags to scene resolvers**

In both `frontend/mcp/scene-server.mjs` and `frontend/lib/pipeline/scene-resolver.ts`, include:

```ts
category: component.category,
tags: component.tags ?? [],
```

or the JavaScript equivalent in every generated node object.

- [ ] **Step 5: Update `getPartDetails` signature**

Change `frontend/lib/scene/part-details.ts` signature to:

```ts
export type PartDetailInput =
  | string
  | {
      id: string
      category?: string
      tags?: string[]
    }

export function getPartDetails(part: PartDetailInput, scale: Vec3): PartDetail[] {
  const partId = typeof part === 'string' ? part : part.id
  const tags = new Set(typeof part === 'string' ? [] : part.tags ?? [])
```

Keep the existing switch on `partId`. After the switch default, add tag-based fallbacks:

```ts
  if (tags.has('water-contact') || tags.has('flood') || tags.has('drainage')) {
    return [
      cylinder('probe-tip', [0, -sy * 0.38, frontZ + 0.018], [sx * 0.18, sy * 0.36, sx * 0.18], '#bae6fd'),
      torus('cable-seal', [0, sy * 0.28, frontZ + 0.012], [sx * 0.3, 0.012, sx * 0.3], '#cbd5e1'),
    ]
  }

  if (tags.has('radar') || tags.has('mmwave') || tags.has('traffic')) {
    return [
      sphere('front-radome', [0, 0, frontZ + 0.018], [sx * 0.35, sx * 0.35, sx * 0.16], '#e0f2fe'),
      box('aiming-mark', [0, -sy * 0.32, frontZ + 0.022], [sx * 0.65, 0.016, 0.014], '#38bdf8'),
    ]
  }

  if (tags.has('air-quality')) {
    return [
      ...[-0.2, 0, 0.2].map((x) => box('vent-slot', [x, -sy * 0.25, frontZ + 0.018], [0.08, 0.014, 0.012], '#a7f3d0')),
      sphere('sample-port', [0, sy * 0.24, frontZ + 0.02], [sx * 0.16, sx * 0.16, sx * 0.16], '#ccfbf1'),
    ]
  }

  if (tags.has('antenna')) {
    return [
      cylinder('antenna-whip', [sx * 0.45, 0, 0], [0.014, sx * 0.8, 0.014], '#e11d48', [0, 0, Math.PI / 2]),
    ]
  }

  if (tags.has('waste')) {
    return [
      box('bin-lid-sensor-window', [0, sy * 0.32, frontZ + 0.018], [sx * 0.58, 0.04, 0.018], '#fef3c7'),
      sphere('service-indicator', [sx * 0.28, -sy * 0.28, frontZ + 0.02], [0.02, 0.02, 0.02], '#f59e0b'),
    ]
  }

  if (tags.has('utility-cabinet') || tags.has('din-rail')) {
    return [
      box('din-rail-clip', [0, 0, -sz / 2 - 0.012], [sx * 0.72, 0.035, 0.018], '#94a3b8'),
      box('terminal-strip', [0, sy * 0.34, frontZ + 0.012], [sx * 0.7, 0.035, 0.014], '#f8fafc'),
    ]
  }
```

- [ ] **Step 6: Pass component context from renderer**

In `frontend/components/center/BuildGuardNode.tsx`, replace:

```ts
const details = getPartDetails(comp.id, comp.scale)
```

with:

```ts
const details = getPartDetails(
  { id: comp.id, category: comp.category, tags: comp.tags },
  comp.scale
)
```

- [ ] **Step 7: Run scene tests**

Run:

```bash
cd frontend
npm run test -- __tests__/component-library.test.ts __tests__/scene-assembly.test.ts __tests__/scene-physics.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit scene rendering changes**

Run:

```bash
git add frontend/lib/pipeline/types.ts frontend/lib/types.ts frontend/lib/pipeline/to-ui.ts frontend/mcp/scene-server.mjs frontend/lib/pipeline/scene-resolver.ts frontend/lib/scene/part-details.ts frontend/components/center/BuildGuardNode.tsx frontend/__tests__/component-library.test.ts
git commit -m "feat: render smart city component families"
```

Expected: commit succeeds.

---

### Task 7: Add Tag-Aware RFQ Questions

**Files:**
- Modify: `frontend/lib/pipeline/rfq-agent.ts`
- Modify: `frontend/mcp/supplier-server.mjs`
- Modify: `frontend/__tests__/component-library.test.ts`

- [ ] **Step 1: Add failing RFQ tests**

Append this block to `frontend/__tests__/component-library.test.ts`:

```ts
import { buildRfqPackDeterministic } from '../lib/pipeline/rfq-agent'
import supplierGraph from '../data/supplier-graph.json'

describe('smart-city RFQ questions', () => {
  it('adds water-contact and battery/solar RFQ questions for flood nodes', () => {
    const ctx = parseContextFromPrompt(
      'A roadside drainage channel needs flood water level and rain monitoring with solar battery.'
    )
    const graph = {
      node_type: 'drainage-water-node',
      selected_component_ids: graphFor(
        'A roadside drainage channel needs flood water level and rain monitoring with solar battery.'
      ),
    }
    const rfq = buildRfqPackDeterministic(
      graph,
      { warnings: [], passed_checks: [] },
      supplierGraph,
      false,
      ctx
    )
    const text = rfq.supplier_questions.map((q) => q.question).join(' ')

    expect(text).toContain('probe material')
    expect(text).toContain('battery runtime')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cd frontend
npm run test -- __tests__/component-library.test.ts
```

Expected: FAIL because RFQ is not yet tag-aware for water/battery/solar.

- [ ] **Step 3: Add tag-aware RFQ questions**

In `frontend/lib/pipeline/rfq-agent.ts`, load catalog component tags for selected IDs and append deterministic questions:

```ts
const selectedTags = new Set(
  graph.selected_component_ids.flatMap((id) => catalog.components.find((component) => component.id === id)?.tags ?? [])
)

if (selectedTags.has('water-contact')) {
  questions.push({
    topic: 'waterproofing',
    question: 'What probe material, sealing method and calibration process are recommended for water-contact deployment?',
    related_component_ids: graph.selected_component_ids.filter((id) =>
      catalog.components.find((component) => component.id === id)?.tags.includes('water-contact')
    ),
  })
}

if (selectedTags.has('solar') || selectedTags.has('battery')) {
  questions.push({
    topic: 'power',
    question: 'What battery runtime, solar charging margin and battery shipping constraints apply to this pilot quantity?',
    related_component_ids: graph.selected_component_ids.filter((id) => {
      const tags = catalog.components.find((component) => component.id === id)?.tags ?? []
      return tags.includes('solar') || tags.includes('battery')
    }),
  })
}
```

Mirror the same logic in `frontend/mcp/supplier-server.mjs` using JavaScript.

- [ ] **Step 4: Run RFQ and MCP tests**

Run:

```bash
cd frontend
npm run test -- __tests__/component-library.test.ts __tests__/mcp-servers.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit RFQ changes**

Run:

```bash
git add frontend/lib/pipeline/rfq-agent.ts frontend/mcp/supplier-server.mjs frontend/__tests__/component-library.test.ts
git commit -m "feat: add smart city rfq questions"
```

Expected: commit succeeds.

---

### Task 8: Update Docs And Run Full Verification

**Files:**
- Modify: `frontend/README.md`
- Modify: `docs/multi-agent-pipeline.md`

- [ ] **Step 1: Update frontend README source policy**

In `frontend/README.md`, add this paragraph under "Sourcing Truth Policy":

```md
The checked-in component catalog now covers 100+ smart-city parts. BuildGuard is one catalog-backed graph, not a special runtime fixture. Source status remains explicit: `verified` entries have registry-backed source data, `seeded` entries are curated concept-stage assumptions, and `candidate` entries are agent/user proposals that require confirmation before RFQ.
```

- [ ] **Step 2: Update multi-agent pipeline data counts**

In `docs/multi-agent-pipeline.md`, update the data table so `component-catalog.json` says `100+ components` and `assembly-patterns.json` says `7+ patterns`.

Add this note near "Component Agent Details":

```md
The expanded smart-city library covers facade, flood/drainage, roadside, parking, occupancy, waste, utility and environmental-monitoring nodes. Deterministic selection uses catalog tags so non-BuildGuard prompts still produce catalog-grounded graphs when no LLM key is configured.
```

- [ ] **Step 3: Run full test suite**

Run:

```bash
cd frontend
npm run test
```

Expected: PASS.

- [ ] **Step 4: Run lint**

Run:

```bash
cd frontend
npm run lint
```

Expected: PASS.

- [ ] **Step 5: Run production build**

Run:

```bash
cd frontend
npm run build
```

Expected: PASS.

- [ ] **Step 6: Commit docs and verification updates**

Run:

```bash
git add frontend/README.md docs/multi-agent-pipeline.md
git commit -m "docs: document expanded smart city library"
```

Expected: commit succeeds.

---

## Self-Review

Spec coverage:

- 100-component catalog: Task 1 and Task 2.
- Honest source status: Task 1, Task 2 and Task 8.
- Component families/tags: Task 2 and Task 3.
- Deterministic selection: Task 3.
- MCP catalog tools: Task 4.
- Assembly patterns: Task 5.
- 3D family rendering: Task 6.
- RFQ tag awareness: Task 7.
- Tests and docs: Task 8.

Type consistency:

- `SceneNode.category?: string` and `SceneNode.tags?: string[]` flow through `to-ui.ts` into `Component3D`.
- `getPartDetails` accepts both the old string form and the new object form.
- Hardware MCP tool names match the spec: `search_components`, `recommend_components`, `get_component`, `list_component_families`.

Execution constraints:

- Do not remove or rename existing BuildGuard component IDs.
- Do not mark a component `verified` unless `parts-registry.json` contains source-backed data.
- Do not change README pitch language beyond catalog/source-policy documentation.
- Leave unrelated untracked files such as `.claude/` untouched.
