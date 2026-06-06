# Physical Cursor Frontend — Implementation Plan

> Archived early implementation plan. This file records the original build plan and is not the current runtime source of truth. Current architecture, MCP flow and hardcode/default policy are documented in `docs/multi-agent-pipeline.md` and `docs/runtime-and-defaults-audit.md`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Physical Cursor web app — a Cursor-like 3-panel smart city hardware generation tool in Next.js with React Three Fiber 3D, liquid glass UI, and Claude API chat.

**Archived architecture note:** This early plan assumed a chat-first prototype with hardcoded BuildGuard fallback data. That is no longer the runtime policy. Current code uses the Context Gate, MCP agents, catalog/rule data, and required Scene MCP path described in `docs/multi-agent-pipeline.md`.

**Tech Stack:** Next.js 14 (App Router), React Three Fiber + @react-three/drei, liquid-glass-js, shadergradient, Tailwind CSS, Zustand, Claude API (claude-sonnet-4-6 streaming via SSE), Vitest + React Testing Library

---

## File Structure

```
frontend/                           ← new Next.js app (lives at repo root /frontend)
├── app/
│   ├── layout.tsx                  ← root layout: dark bg, fonts, metadata
│   ├── page.tsx                    ← / projects home
│   ├── project/[id]/page.tsx       ← /project/[id] main tool
│   └── api/
│       ├── chat/route.ts           ← POST /api/chat → SSE stream
│       └── fix/route.ts            ← POST /api/fix → JSON
├── components/
│   ├── ui/
│   │   ├── GlassPanel.tsx          ← liquid-glass-js wrapper
│   │   ├── Header.tsx              ← top bar
│   │   └── ProgressBar.tsx         ← bottom 7-step progress
│   ├── home/
│   │   ├── ProjectsGrid.tsx        ← grid layout + New Project card
│   │   └── ProjectCard.tsx         ← individual card with 3D thumb
│   ├── left/
│   │   ├── LeftPanel.tsx           ← container + scroll
│   │   ├── ContextCards.tsx        ← deployment context cards
│   │   ├── BOMTable.tsx            ← BOM rows, highlight on click
│   │   └── SupplierCards.tsx       ← GBA supplier cards
│   ├── center/
│   │   ├── CenterPanel.tsx         ← R3F canvas container
│   │   ├── BuildGuardScene.tsx     ← R3F scene: lights, camera, gradient bg
│   │   ├── BuildGuardNode.tsx      ← the 3D model (procedural primitives)
│   │   └── ViewControls.tsx        ← Normal / X-Ray / Explode toggle
│   └── right/
│       ├── RightPanel.tsx          ← chat container
│       ├── ChatFeed.tsx            ← scrollable message list
│       ├── ChatMessage.tsx         ← renders one message by type
│       ├── WarningCard.tsx         ← warning card in chat
│       └── ChatInput.tsx           ← textarea + file upload + send
├── lib/
│   ├── types.ts                    ← all shared TypeScript types
│   ├── store.ts                    ← Zustand store
│   ├── buildguard-data.ts          ← all hardcoded BuildGuard demo data
│   ├── suppliers-data.ts           ← pre-scraped supplier JSON (typed)
│   └── claude-stream.ts            ← SSE client helper
└── __tests__/
    ├── store.test.ts
    ├── api-chat.test.ts
    └── api-fix.test.ts
```

---

## Task 1: Project Setup

**Files:**
- Create: `frontend/` (Next.js app)
- Create: `frontend/package.json`
- Create: `frontend/.env.local`

- [ ] **Step 1: Scaffold Next.js app**

```bash
cd /Users/emilejouannet/Developer/hackathons/eurotech-hack-munich-2026
npx create-next-app@latest frontend --typescript --tailwind --app --no-src-dir --import-alias "@/*"
cd frontend
```

- [ ] **Step 2: Install dependencies**

```bash
npm install @react-three/fiber @react-three/drei three
npm install @types/three
npm install zustand
npm install liquid-glass-js
npm install shadergradient
npm install @anthropic-ai/sdk
npm install ai
npm install jspdf
npm install vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 3: Configure Vitest**

Create `frontend/vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
  },
})
```

Create `frontend/vitest.setup.ts`:
```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 4: Add test script to package.json**

In `frontend/package.json`, add to scripts:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Configure .env.local**

Create `frontend/.env.local`:
```
ANTHROPIC_API_KEY=your_key_here
WORLD_MODEL_URL=http://localhost:8000/simulate
```

- [ ] **Step 6: Configure Tailwind for dark mode**

Replace content of `frontend/tailwind.config.ts`:
```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        surface: '#0a0a0a',
        panel: 'rgba(255,255,255,0.04)',
        border: 'rgba(255,255,255,0.08)',
        accent: '#3b82f6',
        warning: '#f59e0b',
        danger: '#ef4444',
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'monospace'],
      },
    },
  },
  plugins: [],
}
export default config
```

- [ ] **Step 7: Verify setup**

```bash
cd frontend && npm run dev
```
Expected: Next.js running at http://localhost:3000 with no errors.

- [ ] **Step 8: Commit**

```bash
git add frontend/
git commit -m "feat: scaffold Next.js frontend with deps"
```

---

## Task 2: Types + Hardcoded Data

**Files:**
- Create: `frontend/lib/types.ts`
- Create: `frontend/lib/buildguard-data.ts`
- Create: `frontend/lib/suppliers-data.ts`

- [ ] **Step 1: Write types**

Create `frontend/lib/types.ts`:
```typescript
export type ViewMode = 'normal' | 'xray' | 'explode'
export type DemoStep = 0 | 1 | 2 | 3 | 4 | 5 | 6

export type ContextField = {
  label: string
  value: string
}

export type BOMRow = {
  id: string
  part: string
  supplierRoute: string
  cost: number
  isNew?: boolean  // true for Apply Fix additions
  componentId?: string  // links to 3D component
}

export type Component3D = {
  id: string
  label: string
  position: [number, number, number]
  explodeOffset: [number, number, number]
  color: string
  geometry: 'box' | 'cylinder' | 'sphere'
  scale: [number, number, number]
}

export type SimulationWarning = {
  id: string
  category: 'structural' | 'thermal' | 'environmental' | 'coverage' | 'power'
  severity: 'critical' | 'warning' | 'note'
  title: string
  explanation: string
  affectedComponents: string[]
  fix: {
    label: string
    componentChanges: { id: string; note: string }[]
    bomChanges: Omit<BOMRow, 'id'>[]
    costDelta: number
    rfqQuestionsAdded: string[]
  }
}

export type MessageType =
  | 'user'
  | 'ai'
  | 'context-card'
  | 'warning-card'
  | 'action-button'
  | 'file-upload'

export type ChatMessage = {
  id: string
  type: MessageType
  content: string
  timestamp: number
  warning?: SimulationWarning
  actionLabel?: string
  actionCallback?: string  // key in store actions
  fileName?: string
}

export type Project = {
  id: string
  title: string
  createdAt: number
  status: 'generating' | 'complete'
}

export type Supplier = {
  id: string
  name: string
  city: string
  country: string
  scope: string
  website?: string
  stop: 'hk-integrator' | 'sz-ems' | 'dg-enclosure' | 'hk-compliance'
}
```

- [ ] **Step 2: Write hardcoded BuildGuard data**

Create `frontend/lib/buildguard-data.ts`:
```typescript
import type { ContextField, BOMRow, Component3D, SimulationWarning } from './types'

export const DEPLOYMENT_CONTEXT: ContextField[] = [
  { label: 'City', value: 'Hong Kong' },
  { label: 'Site', value: '52-year-old residential building' },
  { label: 'Surface', value: 'Outdoor facade' },
  { label: 'Regulation', value: 'Mandatory Building Inspection Scheme' },
  { label: 'Environment', value: 'Humidity, rain, typhoon wind, pollution' },
  { label: 'Mounting', value: 'Facade-mounted, low-maintenance, limited access' },
  { label: 'Power', value: 'Battery-powered, no mains assumed' },
  { label: 'Connectivity', value: 'LoRa / NB-IoT' },
  { label: 'Privacy', value: 'No camera, no audio — structural data only' },
]

export const BOM_BEFORE_FIX: BOMRow[] = [
  { id: 'enclosure', part: 'Weatherproof enclosure', supplierRoute: 'Dongguan enclosure/plastics', cost: 28, componentId: 'enclosure' },
  { id: 'crack', part: 'Crack displacement sensor', supplierRoute: 'Shenzhen sensor EMS', cost: 34, componentId: 'crack-sensor' },
  { id: 'vibration', part: 'Vibration / IMU sensor', supplierRoute: 'Shenzhen distributor', cost: 18, componentId: 'vibration-sensor' },
  { id: 'tilt', part: 'Tilt sensor', supplierRoute: 'Shenzhen distributor', cost: 22, componentId: 'tilt-sensor' },
  { id: 'moisture', part: 'Moisture / humidity sensor', supplierRoute: 'Shenzhen distributor', cost: 16, componentId: 'moisture-sensor' },
  { id: 'compute', part: 'Edge compute board', supplierRoute: 'Shenzhen EMS', cost: 44, componentId: 'compute' },
  { id: 'radio', part: 'LoRa / NB-IoT module', supplierRoute: 'Shenzhen electronics', cost: 19, componentId: 'radio' },
  { id: 'battery', part: 'Battery module', supplierRoute: 'HK/GZ distributor', cost: 24, componentId: 'battery' },
  { id: 'bracket', part: 'Mounting bracket', supplierRoute: 'Dongguan metal fab', cost: 8, componentId: 'bracket' },
]

export const BOM_FIX_ADDITIONS: BOMRow[] = [
  { id: 'gasket', part: 'IP67 gasket kit', supplierRoute: 'Dongguan enclosure supplier', cost: 8, isNew: true },
  { id: 'membrane', part: 'PTFE membrane', supplierRoute: 'Shenzhen distributor', cost: 4, isNew: true },
  { id: 'fasteners', part: '316L stainless fasteners', supplierRoute: 'Dongguan metal fab', cost: 2, isNew: true },
]

export const COST_BEFORE = 213
export const COST_AFTER = 227

export const COMPONENTS_3D: Component3D[] = [
  { id: 'enclosure', label: 'Weatherproof Enclosure', position: [0, 0, 0], explodeOffset: [0, 0, 0], color: '#334155', geometry: 'box', scale: [1.2, 1.6, 0.8] },
  { id: 'crack-sensor', label: 'Crack Sensor', position: [0.7, -0.4, 0.5], explodeOffset: [1.5, -0.8, 1.0], color: '#1d4ed8', geometry: 'box', scale: [0.15, 0.5, 0.1] },
  { id: 'vibration-sensor', label: 'Vibration / IMU', position: [-0.3, 0.2, 0.3], explodeOffset: [-1.2, 0.8, 1.0], color: '#7c3aed', geometry: 'box', scale: [0.25, 0.15, 0.25] },
  { id: 'tilt-sensor', label: 'Tilt Sensor', position: [0.2, 0.5, 0.3], explodeOffset: [1.0, 1.5, 1.0], color: '#0891b2', geometry: 'cylinder', scale: [0.12, 0.25, 0.12] },
  { id: 'moisture-sensor', label: 'Moisture Sensor', position: [-0.4, -0.3, 0.3], explodeOffset: [-1.0, -1.2, 1.0], color: '#059669', geometry: 'cylinder', scale: [0.1, 0.2, 0.1] },
  { id: 'compute', label: 'Edge Compute Board', position: [0, 0, 0.1], explodeOffset: [0, 0, 1.5], color: '#b45309', geometry: 'box', scale: [0.7, 0.5, 0.05] },
  { id: 'radio', label: 'LoRa / NB-IoT', position: [0.3, -0.2, 0.2], explodeOffset: [1.2, -0.5, 1.2], color: '#be123c', geometry: 'box', scale: [0.3, 0.15, 0.08] },
  { id: 'battery', label: 'Battery Module', position: [0, -0.5, 0], explodeOffset: [0, -1.8, 0.5], color: '#4d7c0f', geometry: 'box', scale: [0.8, 0.4, 0.3] },
  { id: 'bracket', label: 'Mounting Bracket', position: [0, 0, -0.5], explodeOffset: [0, 0, -2.0], color: '#6b7280', geometry: 'box', scale: [1.4, 0.1, 0.6] },
]

export const MOCK_WARNING: SimulationWarning = {
  id: 'IP_INSUFFICIENT',
  category: 'environmental',
  severity: 'critical',
  title: 'Weatherproofing Risk',
  explanation: 'Moisture sensor and crack gauge exposed to Hong Kong humidity and typhoon rain — no IP-rated gasket, drainage path or protected sensor membrane detected.',
  affectedComponents: ['enclosure', 'moisture-sensor', 'crack-sensor'],
  fix: {
    label: 'Add IP67 gasket + PTFE membrane + drainage lip',
    componentChanges: [{ id: 'enclosure', note: 'add gasket seal + drainage channel' }],
    bomChanges: [
      { part: 'IP67 gasket kit', supplierRoute: 'Dongguan enclosure supplier', cost: 8, isNew: true },
      { part: 'PTFE membrane', supplierRoute: 'Shenzhen distributor', cost: 4, isNew: true },
      { part: '316L stainless fasteners', supplierRoute: 'Dongguan metal fab', cost: 2, isNew: true },
    ],
    costDelta: 14,
    rfqQuestionsAdded: [
      'IP rating and test method for the enclosure?',
      'Gasket material and compression specification?',
      'Drainage channel dimensions and slope?',
    ],
  },
}

export const RFQ_QUESTIONS_BASE = [
  'What is the minimum order quantity for the crack displacement sensor?',
  'Does the LoRa module carry CE/FCC certification?',
  'What is the enclosure operating temperature range?',
  'Can the battery module be replaced in the field without tools?',
  'What is the lead time for the edge compute board at 50 units?',
]

export const GBA_ROUTE_STOPS = [
  { stop: 'hk-integrator' as const, label: 'HK Pilot Integrator', desc: 'Property manager / OC / Registered Inspector coordination' },
  { stop: 'sz-ems' as const, label: 'Shenzhen EMS', desc: 'PCB, sensors, MCU, radio module assembly' },
  { stop: 'dg-enclosure' as const, label: 'Dongguan Partner', desc: 'Weatherproof housing, bracket, gasket, fasteners' },
  { stop: 'hk-compliance' as const, label: 'HK / GZ Compliance', desc: 'RF certification, battery shipping, pilot documentation' },
]
```

- [ ] **Step 3: Write supplier data**

Create `frontend/lib/suppliers-data.ts`:
```typescript
import type { Supplier } from './types'

// Pre-scraped GBA supplier data — update before demo with real companies
export const SUPPLIERS: Supplier[] = [
  {
    id: 'hk-1',
    name: 'Citybase Digital Solutions',
    city: 'Hong Kong',
    country: 'HK',
    scope: 'Smart building IoT integration, MBIS monitoring systems',
    stop: 'hk-integrator',
  },
  {
    id: 'sz-1',
    name: 'JLCPCB / EasyEDA',
    city: 'Shenzhen',
    country: 'CN',
    scope: 'PCB manufacturing, SMT assembly, sensor modules',
    website: 'https://jlcpcb.com',
    stop: 'sz-ems',
  },
  {
    id: 'sz-2',
    name: 'NextPCB',
    city: 'Shenzhen',
    country: 'CN',
    scope: 'PCB prototyping and low-volume EMS',
    website: 'https://nextpcb.com',
    stop: 'sz-ems',
  },
  {
    id: 'dg-1',
    name: 'Dongguan Yiyuan Plastic',
    city: 'Dongguan',
    country: 'CN',
    scope: 'IP67 weatherproof enclosures, ABS/PC injection moulding',
    stop: 'dg-enclosure',
  },
  {
    id: 'dg-2',
    name: 'Dongguan Sunco Metal',
    city: 'Dongguan',
    country: 'CN',
    scope: 'Metal fabrication, mounting brackets, stainless fasteners',
    stop: 'dg-enclosure',
  },
  {
    id: 'hk-comp-1',
    name: 'TÜV Rheinland Greater China',
    city: 'Hong Kong',
    country: 'HK',
    scope: 'CE/FCC/HKCA certification, RF compliance testing',
    stop: 'hk-compliance',
  },
]
```

- [ ] **Step 4: Commit**

```bash
git add frontend/lib/
git commit -m "feat: add types and hardcoded BuildGuard demo data"
```

---

## Task 3: Zustand Store

**Files:**
- Create: `frontend/lib/store.ts`
- Create: `frontend/__tests__/store.test.ts`

- [ ] **Step 1: Write failing tests for store**

Create `frontend/__tests__/store.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { useProjectStore } from '../lib/store'

describe('ProjectStore', () => {
  beforeEach(() => {
    useProjectStore.setState(useProjectStore.getInitialState())
  })

  it('starts with empty messages', () => {
    expect(useProjectStore.getState().messages).toEqual([])
  })

  it('addMessage appends a message', () => {
    useProjectStore.getState().addMessage({ id: '1', type: 'user', content: 'hello', timestamp: 0 })
    expect(useProjectStore.getState().messages).toHaveLength(1)
  })

  it('setViewMode updates viewMode', () => {
    useProjectStore.getState().setViewMode('xray')
    expect(useProjectStore.getState().viewMode).toBe('xray')
  })

  it('setHighlightedComponent updates highlightedComponentId', () => {
    useProjectStore.getState().setHighlightedComponent('crack-sensor')
    expect(useProjectStore.getState().highlightedComponentId).toBe('crack-sensor')
  })

  it('applyFix sets fixApplied to true and advances step', () => {
    useProjectStore.getState().applyFix()
    expect(useProjectStore.getState().fixApplied).toBe(true)
  })

  it('setDemoStep updates currentStep', () => {
    useProjectStore.getState().setDemoStep(3)
    expect(useProjectStore.getState().currentStep).toBe(3)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd frontend && npm test -- store
```
Expected: FAIL — `useProjectStore` not found.

- [ ] **Step 3: Implement the store**

Create `frontend/lib/store.ts`:
```typescript
import { create } from 'zustand'
import type { ChatMessage, ViewMode, DemoStep } from './types'
import { BOM_BEFORE_FIX, BOM_FIX_ADDITIONS, DEPLOYMENT_CONTEXT, MOCK_WARNING } from './buildguard-data'
import type { BOMRow, ContextField, SimulationWarning } from './types'

type ProjectStore = {
  // Chat
  messages: ChatMessage[]
  isStreaming: boolean
  addMessage: (msg: ChatMessage) => void
  appendToLastMessage: (chunk: string) => void
  setStreaming: (v: boolean) => void

  // Left panel
  contextFields: ContextField[]
  bom: BOMRow[]
  showSuppliers: boolean
  setContextFields: (fields: ContextField[]) => void
  setBOM: (rows: BOMRow[]) => void
  setShowSuppliers: (v: boolean) => void

  // Center panel
  viewMode: ViewMode
  highlightedComponentId: string | null
  fixApplied: boolean
  showNode: boolean
  setViewMode: (mode: ViewMode) => void
  setHighlightedComponent: (id: string | null) => void
  applyFix: () => void
  setShowNode: (v: boolean) => void

  // Warning
  activeWarning: SimulationWarning | null
  setActiveWarning: (w: SimulationWarning | null) => void

  // Progress
  currentStep: DemoStep
  setDemoStep: (step: DemoStep) => void

  // Reset
  reset: () => void
}

const initialState = {
  messages: [],
  isStreaming: false,
  contextFields: [],
  bom: BOM_BEFORE_FIX,
  showSuppliers: false,
  viewMode: 'normal' as ViewMode,
  highlightedComponentId: null,
  fixApplied: false,
  showNode: false,
  activeWarning: null,
  currentStep: 0 as DemoStep,
}

export const useProjectStore = create<ProjectStore>()((set, get) => ({
  ...initialState,

  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),

  appendToLastMessage: (chunk) =>
    set((s) => {
      const msgs = [...s.messages]
      if (msgs.length === 0) return s
      const last = msgs[msgs.length - 1]
      msgs[msgs.length - 1] = { ...last, content: last.content + chunk }
      return { messages: msgs }
    }),

  setStreaming: (v) => set({ isStreaming: v }),
  setContextFields: (fields) => set({ contextFields: fields }),
  setBOM: (rows) => set({ bom: rows }),
  setShowSuppliers: (v) => set({ showSuppliers: v }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setHighlightedComponent: (id) => set({ highlightedComponentId: id }),

  applyFix: () => {
    const { bom, currentStep } = get()
    set({
      fixApplied: true,
      bom: [...bom, ...BOM_FIX_ADDITIONS],
      currentStep: Math.min(currentStep + 1, 7) as DemoStep,
    })
  },

  setShowNode: (v) => set({ showNode: v }),
  setActiveWarning: (w) => set({ activeWarning: w }),
  setDemoStep: (step) => set({ currentStep: step }),

  reset: () => set({ ...initialState, bom: BOM_BEFORE_FIX }),
}))

// Needed for tests
useProjectStore.getInitialState = () => initialState
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd frontend && npm test -- store
```
Expected: all 6 pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/store.ts frontend/__tests__/store.test.ts
git commit -m "feat: add Zustand store with BuildGuard state"
```

---

## Task 4: Root Layout + GlassPanel

**Files:**
- Create: `frontend/app/layout.tsx`
- Create: `frontend/app/globals.css`
- Create: `frontend/components/ui/GlassPanel.tsx`
- Create: `frontend/components/ui/Header.tsx`

- [ ] **Step 1: Root layout**

Replace `frontend/app/layout.tsx`:
```tsx
import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import './globals.css'

export const metadata: Metadata = {
  title: 'Physical Cursor',
  description: 'Turn dense-city problems into reviewable smart-city hardware briefs',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${GeistSans.variable} ${GeistMono.variable} bg-surface text-white antialiased`}>
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Global CSS**

Replace `frontend/app/globals.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --surface: #0a0a0a;
}

* {
  box-sizing: border-box;
}

body {
  background: var(--surface);
  overflow: hidden;
}

::-webkit-scrollbar {
  width: 4px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,0.1);
  border-radius: 2px;
}
```

- [ ] **Step 3: GlassPanel component**

Create `frontend/components/ui/GlassPanel.tsx`:
```tsx
'use client'
import { useEffect, useRef } from 'react'

type Props = {
  children: React.ReactNode
  className?: string
}

export function GlassPanel({ children, className = '' }: Props) {
  return (
    <div
      className={`
        relative rounded-lg overflow-hidden
        bg-white/[0.03] border border-white/[0.08]
        backdrop-blur-sm
        ${className}
      `}
    >
      {children}
    </div>
  )
}
```

Note: liquid-glass-js may require a canvas overlay — apply it progressively. Start with CSS glass, enhance if time permits.

- [ ] **Step 4: Header component**

Create `frontend/components/ui/Header.tsx`:
```tsx
type Props = {
  projectTitle?: string
  onExport?: () => void
}

export function Header({ projectTitle, onExport }: Props) {
  return (
    <div className="flex items-center justify-between px-4 h-11 border-b border-white/[0.06] shrink-0">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-white/90 tracking-tight">Physical Cursor</span>
        {projectTitle && (
          <>
            <span className="text-white/20">/</span>
            <span className="text-sm text-white/50 truncate max-w-[240px]">{projectTitle}</span>
          </>
        )}
      </div>
      {onExport && (
        <button
          onClick={onExport}
          className="text-xs px-3 py-1.5 rounded bg-accent/10 text-accent border border-accent/20 hover:bg-accent/20 transition-colors"
        >
          Export Pack
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/app/layout.tsx frontend/app/globals.css frontend/components/ui/
git commit -m "feat: root layout, glass panel, header"
```

---

## Task 5: Projects Home Page

**Files:**
- Create: `frontend/app/page.tsx`
- Create: `frontend/components/home/ProjectsGrid.tsx`
- Create: `frontend/components/home/ProjectCard.tsx`

- [ ] **Step 1: ProjectCard**

Create `frontend/components/home/ProjectCard.tsx`:
```tsx
'use client'
import Link from 'next/link'
import type { Project } from '@/lib/types'
import { GlassPanel } from '@/components/ui/GlassPanel'

type Props = {
  project: Project
}

export function ProjectCard({ project }: Props) {
  const dateStr = new Date(project.createdAt).toLocaleDateString('en-HK', {
    day: 'numeric', month: 'short', year: 'numeric'
  })

  return (
    <Link href={`/project/${project.id}`}>
      <GlassPanel className="p-4 hover:border-white/20 transition-colors cursor-pointer group h-40 flex flex-col justify-between">
        <div className="w-full h-20 bg-white/[0.02] rounded flex items-center justify-center text-white/10 text-xs">
          3D preview
        </div>
        <div>
          <p className="text-sm text-white/80 truncate group-hover:text-white transition-colors">
            {project.title}
          </p>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-white/30">{dateStr}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              project.status === 'complete'
                ? 'bg-emerald-500/10 text-emerald-400'
                : 'bg-warning/10 text-warning'
            }`}>
              {project.status}
            </span>
          </div>
        </div>
      </GlassPanel>
    </Link>
  )
}
```

- [ ] **Step 2: ProjectsGrid**

Create `frontend/components/home/ProjectsGrid.tsx`:
```tsx
'use client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import type { Project } from '@/lib/types'
import { ProjectCard } from './ProjectCard'
import { GlassPanel } from '@/components/ui/GlassPanel'

function loadProjects(): Project[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem('pc_projects') || '[]')
  } catch {
    return []
  }
}

export function createProject(): Project {
  return {
    id: crypto.randomUUID(),
    title: 'New Project',
    createdAt: Date.now(),
    status: 'generating',
  }
}

export function saveProject(project: Project) {
  const existing = loadProjects()
  const updated = [project, ...existing.filter((p) => p.id !== project.id)]
  localStorage.setItem('pc_projects', JSON.stringify(updated))
}

export function ProjectsGrid() {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])

  useEffect(() => {
    setProjects(loadProjects())
  }, [])

  function handleNew() {
    const project = createProject()
    saveProject(project)
    router.push(`/project/${project.id}`)
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
      <GlassPanel
        className="p-4 h-40 flex flex-col items-center justify-center cursor-pointer hover:border-white/20 transition-colors group"
      >
        <button onClick={handleNew} className="flex flex-col items-center gap-2 w-full h-full justify-center">
          <span className="text-2xl text-white/20 group-hover:text-white/50 transition-colors">+</span>
          <span className="text-xs text-white/40 group-hover:text-white/60 transition-colors">New Project</span>
        </button>
      </GlassPanel>
      {projects.map((p) => (
        <ProjectCard key={p.id} project={p} />
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Home page**

Replace `frontend/app/page.tsx`:
```tsx
import { Header } from '@/components/ui/Header'
import { ProjectsGrid } from '@/components/home/ProjectsGrid'

export default function HomePage() {
  return (
    <div className="flex flex-col h-screen">
      <Header />
      <main className="flex-1 overflow-auto p-6">
        <h1 className="text-lg font-medium text-white/80 mb-6">Projects</h1>
        <ProjectsGrid />
      </main>
    </div>
  )
}
```

- [ ] **Step 4: Verify visually**

```bash
cd frontend && npm run dev
```
Open http://localhost:3000. Expected: dark page, header "Physical Cursor", "New Project" card. Click it → redirects to `/project/[uuid]` (404 for now, that's fine).

- [ ] **Step 5: Commit**

```bash
git add frontend/app/page.tsx frontend/components/home/
git commit -m "feat: projects home page with localStorage persistence"
```

---

## Task 6: Progress Bar

**Files:**
- Create: `frontend/components/ui/ProgressBar.tsx`

- [ ] **Step 1: ProgressBar component**

Create `frontend/components/ui/ProgressBar.tsx`:
```tsx
'use client'
import { useProjectStore } from '@/lib/store'

const STEPS = [
  'Context',
  '3D Node',
  'X-Ray',
  'Risk',
  'Apply Fix',
  'Suppliers',
  'Export',
]

export function ProgressBar() {
  const currentStep = useProjectStore((s) => s.currentStep)

  return (
    <div className="flex items-center h-10 px-4 border-t border-white/[0.06] shrink-0 gap-1">
      {STEPS.map((label, i) => {
        const isComplete = i < currentStep
        const isActive = i === currentStep
        return (
          <div key={label} className="flex items-center gap-1 flex-1">
            <div className={`flex items-center gap-1.5 ${isActive ? 'text-white' : isComplete ? 'text-white/40' : 'text-white/20'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-accent' : isComplete ? 'bg-white/30' : 'bg-white/10'}`} />
              <span className="text-[10px] font-medium tracking-wide uppercase">{label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-px mx-1 ${isComplete ? 'bg-white/20' : 'bg-white/05'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/ui/ProgressBar.tsx
git commit -m "feat: 7-step demo progress bar"
```

---

## Task 7: LEFT Panel

**Files:**
- Create: `frontend/components/left/LeftPanel.tsx`
- Create: `frontend/components/left/ContextCards.tsx`
- Create: `frontend/components/left/BOMTable.tsx`
- Create: `frontend/components/left/SupplierCards.tsx`

- [ ] **Step 1: ContextCards**

Create `frontend/components/left/ContextCards.tsx`:
```tsx
'use client'
import { useProjectStore } from '@/lib/store'

export function ContextCards() {
  const contextFields = useProjectStore((s) => s.contextFields)
  if (contextFields.length === 0) return null

  return (
    <div className="space-y-1">
      <p className="text-[10px] uppercase tracking-widest text-white/30 mb-2">Deployment Context</p>
      {contextFields.map((f) => (
        <div key={f.label} className="flex gap-2 text-xs">
          <span className="text-white/30 shrink-0 w-24">{f.label}</span>
          <span className="text-white/70">{f.value}</span>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: BOMTable**

Create `frontend/components/left/BOMTable.tsx`:
```tsx
'use client'
import { useProjectStore } from '@/lib/store'
import { COST_BEFORE, COST_AFTER } from '@/lib/buildguard-data'

export function BOMTable() {
  const { bom, highlightedComponentId, fixApplied, setHighlightedComponent } = useProjectStore((s) => ({
    bom: s.bom,
    highlightedComponentId: s.highlightedComponentId,
    fixApplied: s.fixApplied,
    setHighlightedComponent: s.setHighlightedComponent,
  }))

  const total = fixApplied ? COST_AFTER : COST_BEFORE

  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-white/30 mb-2">Bill of Materials</p>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-white/30 border-b border-white/[0.06]">
            <th className="text-left pb-1 font-normal">Part</th>
            <th className="text-right pb-1 font-normal">$</th>
          </tr>
        </thead>
        <tbody>
          {bom.map((row) => {
            const isHighlighted = row.componentId === highlightedComponentId
            return (
              <tr
                key={row.id}
                onClick={() => setHighlightedComponent(row.componentId ?? null)}
                className={`cursor-pointer transition-colors ${
                  isHighlighted ? 'text-accent bg-accent/5' : 'text-white/60 hover:text-white/80'
                } ${row.isNew ? 'text-emerald-400' : ''}`}
              >
                <td className="py-0.5 pr-2 truncate max-w-[140px]">
                  {row.isNew && <span className="text-emerald-400 mr-1">+</span>}
                  {row.part}
                </td>
                <td className="py-0.5 text-right tabular-nums">{row.cost}</td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-white/[0.06] text-white font-medium">
            <td className="pt-1">Total</td>
            <td className="pt-1 text-right tabular-nums">
              ${total}
              {fixApplied && <span className="text-emerald-400 text-[10px] ml-1">+14</span>}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
```

- [ ] **Step 3: SupplierCards**

Create `frontend/components/left/SupplierCards.tsx`:
```tsx
'use client'
import { useProjectStore } from '@/lib/store'
import { SUPPLIERS } from '@/lib/suppliers-data'
import { GBA_ROUTE_STOPS } from '@/lib/buildguard-data'

export function SupplierCards() {
  const showSuppliers = useProjectStore((s) => s.showSuppliers)
  if (!showSuppliers) return null

  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-white/30 mb-2">GBA Supplier Route</p>
      <div className="space-y-2">
        {GBA_ROUTE_STOPS.map((stop, i) => {
          const suppliers = SUPPLIERS.filter((s) => s.stop === stop.stop)
          return (
            <div key={stop.stop} className="flex gap-2">
              <div className="flex flex-col items-center">
                <div className="w-4 h-4 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center text-[9px] text-accent">{i + 1}</div>
                {i < GBA_ROUTE_STOPS.length - 1 && <div className="w-px flex-1 bg-white/[0.06] my-1" />}
              </div>
              <div className="flex-1 pb-2">
                <p className="text-xs text-white/80 font-medium">{stop.label}</p>
                <p className="text-[10px] text-white/40 mb-1">{stop.desc}</p>
                {suppliers.map((s) => (
                  <div key={s.id} className="text-[10px] text-white/50 bg-white/[0.02] rounded px-2 py-0.5 mb-0.5">
                    {s.name} · {s.city}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: LeftPanel container**

Create `frontend/components/left/LeftPanel.tsx`:
```tsx
'use client'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { ContextCards } from './ContextCards'
import { BOMTable } from './BOMTable'
import { SupplierCards } from './SupplierCards'

export function LeftPanel() {
  return (
    <GlassPanel className="flex flex-col h-full overflow-y-auto p-4 space-y-6 w-[280px] shrink-0">
      <ContextCards />
      <BOMTable />
      <SupplierCards />
    </GlassPanel>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/components/left/
git commit -m "feat: left panel — context cards, BOM table, supplier route"
```

---

## Task 8: CENTER Panel — 3D Node

**Files:**
- Create: `frontend/components/center/CenterPanel.tsx`
- Create: `frontend/components/center/BuildGuardScene.tsx`
- Create: `frontend/components/center/BuildGuardNode.tsx`
- Create: `frontend/components/center/ViewControls.tsx`

- [ ] **Step 1: ViewControls**

Create `frontend/components/center/ViewControls.tsx`:
```tsx
'use client'
import { useProjectStore } from '@/lib/store'
import type { ViewMode } from '@/lib/types'

const MODES: { mode: ViewMode; label: string }[] = [
  { mode: 'normal', label: 'Normal' },
  { mode: 'xray', label: 'X-Ray' },
  { mode: 'explode', label: 'Explode' },
]

export function ViewControls() {
  const { viewMode, setViewMode } = useProjectStore((s) => ({
    viewMode: s.viewMode,
    setViewMode: s.setViewMode,
  }))

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 flex gap-1 z-10">
      {MODES.map(({ mode, label }) => (
        <button
          key={mode}
          onClick={() => setViewMode(mode)}
          className={`text-xs px-3 py-1 rounded transition-colors ${
            viewMode === mode
              ? 'bg-white/10 text-white border border-white/20'
              : 'text-white/40 hover:text-white/60'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: BuildGuardNode — the 3D model**

Create `frontend/components/center/BuildGuardNode.tsx`:
```tsx
'use client'
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import { useProjectStore } from '@/lib/store'
import { COMPONENTS_3D } from '@/lib/buildguard-data'
import type { Component3D } from '@/lib/types'

function Component({ comp, viewMode, isHighlighted, isWarning, fixApplied }: {
  comp: Component3D
  viewMode: string
  isHighlighted: boolean
  isWarning: boolean
  fixApplied: boolean
}) {
  const ref = useRef<THREE.Mesh>(null)
  const setHighlighted = useProjectStore((s) => s.setHighlightedComponent)

  const targetPos = viewMode === 'explode'
    ? [
        comp.position[0] + comp.explodeOffset[0],
        comp.position[1] + comp.explodeOffset[1],
        comp.position[2] + comp.explodeOffset[2],
      ] as [number, number, number]
    : comp.position

  useFrame(() => {
    if (!ref.current) return
    ref.current.position.lerp(new THREE.Vector3(...targetPos), 0.08)
  })

  const opacity = viewMode === 'xray' && comp.id === 'enclosure' ? 0.15 : 1
  const color = isWarning && !fixApplied ? '#ef4444' : isHighlighted ? '#3b82f6' : comp.color

  const geometry =
    comp.geometry === 'cylinder' ? (
      <cylinderGeometry args={[comp.scale[0], comp.scale[0], comp.scale[1], 16]} />
    ) : (
      <boxGeometry args={comp.scale} />
    )

  return (
    <group>
      <mesh
        ref={ref}
        position={comp.position}
        onClick={(e) => { e.stopPropagation(); setHighlighted(comp.id) }}
      >
        {geometry}
        <meshStandardMaterial
          color={color}
          transparent={opacity < 1}
          opacity={opacity}
          roughness={0.4}
          metalness={comp.id === 'bracket' ? 0.8 : 0.1}
          wireframe={viewMode === 'xray' && comp.id !== 'enclosure'}
        />
      </mesh>
      {(viewMode === 'explode' || isHighlighted) && (
        <Text
          position={[targetPos[0], targetPos[1] + (comp.scale[1] ?? 0.5) / 2 + 0.15, targetPos[2]]}
          fontSize={0.07}
          color="rgba(255,255,255,0.7)"
          anchorX="center"
          anchorY="bottom"
        >
          {comp.label}
        </Text>
      )}
    </group>
  )
}

export function BuildGuardNode() {
  const groupRef = useRef<THREE.Group>(null)
  const { viewMode, highlightedComponentId, activeWarning, fixApplied } = useProjectStore((s) => ({
    viewMode: s.viewMode,
    highlightedComponentId: s.highlightedComponentId,
    activeWarning: s.activeWarning,
    fixApplied: s.fixApplied,
  }))

  useFrame(({ clock }) => {
    if (!groupRef.current || viewMode === 'explode') return
    groupRef.current.rotation.y = clock.getElapsedTime() * 0.15
  })

  return (
    <group ref={groupRef}>
      {COMPONENTS_3D.map((comp) => (
        <Component
          key={comp.id}
          comp={comp}
          viewMode={viewMode}
          isHighlighted={highlightedComponentId === comp.id}
          isWarning={activeWarning?.affectedComponents.includes(comp.id) ?? false}
          fixApplied={fixApplied}
        />
      ))}
    </group>
  )
}
```

- [ ] **Step 3: BuildGuardScene**

Create `frontend/components/center/BuildGuardScene.tsx`:
```tsx
'use client'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment } from '@react-three/drei'
import { Suspense } from 'react'
import { BuildGuardNode } from './BuildGuardNode'
import { useProjectStore } from '@/lib/store'

export function BuildGuardScene() {
  const showNode = useProjectStore((s) => s.showNode)

  return (
    <Canvas
      camera={{ position: [0, 1, 4], fov: 45 }}
      className="w-full h-full"
      gl={{ antialias: true, alpha: true }}
    >
      <color attach="background" args={['#0a0a0a']} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 5, 5]} intensity={1} />
      <pointLight position={[-5, -5, -5]} intensity={0.3} color="#3b82f6" />
      <Suspense fallback={null}>
        {showNode && <BuildGuardNode />}
        <Environment preset="night" />
      </Suspense>
      <OrbitControls
        enablePan={false}
        minDistance={2}
        maxDistance={8}
        autoRotate={false}
      />
    </Canvas>
  )
}
```

- [ ] **Step 4: CenterPanel**

Create `frontend/components/center/CenterPanel.tsx`:
```tsx
'use client'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { BuildGuardScene } from './BuildGuardScene'
import { ViewControls } from './ViewControls'
import { useProjectStore } from '@/lib/store'

export function CenterPanel() {
  const showNode = useProjectStore((s) => s.showNode)

  return (
    <GlassPanel className="relative flex-1 h-full overflow-hidden">
      {showNode && <ViewControls />}
      <BuildGuardScene />
      {!showNode && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-white/20 text-sm">Describe your smart city problem →</p>
        </div>
      )}
    </GlassPanel>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/components/center/
git commit -m "feat: 3D BuildGuard Node with explode/xray views and component highlighting"
```

---

## Task 9: RIGHT Panel — Chat

**Files:**
- Create: `frontend/components/right/RightPanel.tsx`
- Create: `frontend/components/right/ChatFeed.tsx`
- Create: `frontend/components/right/ChatMessage.tsx`
- Create: `frontend/components/right/WarningCard.tsx`
- Create: `frontend/components/right/ChatInput.tsx`

- [ ] **Step 1: WarningCard**

Create `frontend/components/right/WarningCard.tsx`:
```tsx
'use client'
import { useProjectStore } from '@/lib/store'
import type { SimulationWarning } from '@/lib/types'

type Props = { warning: SimulationWarning }

export function WarningCard({ warning }: Props) {
  const { applyFix, fixApplied } = useProjectStore((s) => ({
    applyFix: s.applyFix,
    fixApplied: s.fixApplied,
  }))

  const severityColor = {
    critical: 'border-danger/40 bg-danger/5',
    warning: 'border-warning/40 bg-warning/5',
    note: 'border-white/20 bg-white/5',
  }[warning.severity]

  return (
    <div className={`rounded-lg border p-3 space-y-2 ${severityColor}`}>
      <div className="flex items-start gap-2">
        <span className="text-danger text-sm mt-0.5">⚠</span>
        <div>
          <p className="text-sm font-medium text-white/90">{warning.title}</p>
          <p className="text-xs text-white/50 mt-0.5">{warning.explanation}</p>
        </div>
      </div>
      {!fixApplied && (
        <button
          onClick={applyFix}
          className="w-full text-xs py-1.5 rounded bg-accent/10 text-accent border border-accent/20 hover:bg-accent/20 transition-colors"
        >
          Apply Fix — {warning.fix.label}
        </button>
      )}
      {fixApplied && (
        <p className="text-xs text-emerald-400">✓ Fix applied — BOM updated (+$14)</p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: ChatMessage**

Create `frontend/components/right/ChatMessage.tsx`:
```tsx
'use client'
import type { ChatMessage as ChatMessageType } from '@/lib/types'
import { WarningCard } from './WarningCard'

type Props = { message: ChatMessageType }

export function ChatMessage({ message }: Props) {
  if (message.type === 'warning-card' && message.warning) {
    return (
      <div className="my-2">
        <WarningCard warning={message.warning} />
      </div>
    )
  }

  if (message.type === 'file-upload') {
    return (
      <div className="flex items-center gap-2 bg-white/[0.03] rounded px-3 py-2 text-xs text-white/50 border border-white/[0.06]">
        <span>📎</span>
        <span>{message.fileName}</span>
      </div>
    )
  }

  const isUser = message.type === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed ${
        isUser
          ? 'bg-accent/10 text-white/90 border border-accent/20'
          : 'bg-white/[0.04] text-white/80 border border-white/[0.06]'
      }`}>
        {message.content}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: ChatFeed**

Create `frontend/components/right/ChatFeed.tsx`:
```tsx
'use client'
import { useEffect, useRef } from 'react'
import { useProjectStore } from '@/lib/store'
import { ChatMessage } from './ChatMessage'

export function ChatFeed() {
  const messages = useProjectStore((s) => s.messages)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-3">
      {messages.length === 0 && (
        <div className="flex flex-col items-center justify-center h-full text-center">
          <p className="text-sm text-white/30">Describe your smart city problem</p>
          <p className="text-xs text-white/15 mt-1">Upload files, ask questions, request changes</p>
        </div>
      )}
      {messages.map((msg) => (
        <ChatMessage key={msg.id} message={msg} />
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
```

- [ ] **Step 4: ChatInput**

Create `frontend/components/right/ChatInput.tsx`:
```tsx
'use client'
import { useRef, useState } from 'react'
import { useProjectStore } from '@/lib/store'

type Props = {
  onSend: (content: string, files?: File[]) => void
  disabled?: boolean
}

export function ChatInput({ onSend, disabled }: Props) {
  const [value, setValue] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const isStreaming = useProjectStore((s) => s.isStreaming)

  function handleSend() {
    const text = value.trim()
    if (!text && files.length === 0) return
    onSend(text, files)
    setValue('')
    setFiles([])
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="p-3 border-t border-white/[0.06]">
      {files.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {files.map((f) => (
            <span key={f.name} className="text-[10px] bg-white/[0.05] text-white/50 px-2 py-0.5 rounded border border-white/[0.08]">
              📎 {f.name}
            </span>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2">
        <button
          onClick={() => fileRef.current?.click()}
          className="text-white/30 hover:text-white/60 transition-colors pb-1 shrink-0"
          title="Upload file"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 1a.5.5 0 0 1 .5.5V6H12a4 4 0 1 1 0 8H4a4 4 0 1 1 0-8h3.5V1.5A.5.5 0 0 1 8 1z"/>
          </svg>
        </button>
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          multiple
          accept=".pdf,.png,.jpg,.jpeg,.docx"
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
        />
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe your smart city problem..."
          disabled={disabled || isStreaming}
          rows={1}
          className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded text-sm text-white/90 placeholder:text-white/25 px-3 py-2 resize-none focus:outline-none focus:border-white/20 transition-colors"
          style={{ minHeight: '38px', maxHeight: '120px' }}
        />
        <button
          onClick={handleSend}
          disabled={disabled || isStreaming || (!value.trim() && files.length === 0)}
          className="text-accent hover:text-blue-400 transition-colors pb-1 disabled:opacity-30 shrink-0"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M15.854.146a.5.5 0 0 1 .11.54l-5.819 14.547a.75.75 0 0 1-1.329.124l-3.178-4.995L.643 7.184a.75.75 0 0 1 .124-1.33L15.314.037a.5.5 0 0 1 .54.11z"/>
          </svg>
        </button>
      </div>
      {isStreaming && (
        <p className="text-[10px] text-white/30 mt-1 text-center">Generating...</p>
      )}
    </div>
  )
}
```

- [ ] **Step 5: RightPanel**

Create `frontend/components/right/RightPanel.tsx`:
```tsx
'use client'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { ChatFeed } from './ChatFeed'
import { ChatInput } from './ChatInput'

type Props = {
  onSend: (content: string, files?: File[]) => void
}

export function RightPanel({ onSend }: Props) {
  return (
    <GlassPanel className="flex flex-col h-full w-[360px] shrink-0">
      <div className="px-4 py-2 border-b border-white/[0.06] shrink-0">
        <span className="text-xs text-white/40 uppercase tracking-widest">AI Chat</span>
      </div>
      <ChatFeed />
      <ChatInput onSend={onSend} />
    </GlassPanel>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add frontend/components/right/
git commit -m "feat: right panel chat with warning card and file upload"
```

---

## Task 10: Project Page Layout

**Files:**
- Create: `frontend/app/project/[id]/page.tsx`
- Create: `frontend/lib/claude-stream.ts`

- [ ] **Step 1: SSE client helper**

Create `frontend/lib/claude-stream.ts`:
```typescript
export async function streamChat(
  projectId: string,
  userMessage: string,
  fileNames: string[],
  onChunk: (type: string, data: unknown) => void,
  onDone: () => void
) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, message: userMessage, fileNames }),
  })

  if (!res.ok || !res.body) {
    onChunk('error', { message: 'Request failed' })
    onDone()
    return
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const lines = decoder.decode(value).split('\n')
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      try {
        const event = JSON.parse(line.slice(6))
        onChunk(event.type, event.data)
      } catch {
        // partial chunk, ignore
      }
    }
  }
  onDone()
}
```

- [ ] **Step 2: Project page**

Create `frontend/app/project/[id]/page.tsx`:
```tsx
'use client'
import { useCallback } from 'react'
import { Header } from '@/components/ui/Header'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { LeftPanel } from '@/components/left/LeftPanel'
import { CenterPanel } from '@/components/center/CenterPanel'
import { RightPanel } from '@/components/right/RightPanel'
import { useProjectStore } from '@/lib/store'
import { streamChat } from '@/lib/claude-stream'
import { DEPLOYMENT_CONTEXT, MOCK_WARNING } from '@/lib/buildguard-data'
import type { ChatMessage } from '@/lib/types'

let msgCounter = 0
function mkId() { return `msg-${++msgCounter}-${Date.now()}` }

export default function ProjectPage({ params }: { params: { id: string } }) {
  const store = useProjectStore()

  function handleExport() {
    // Task 14 — export pack
  }

  const handleSend = useCallback(async (content: string, files?: File[]) => {
    if (!content.trim() && (!files || files.length === 0)) return

    // Add file upload messages
    if (files?.length) {
      files.forEach((f) => {
        store.addMessage({ id: mkId(), type: 'file-upload', content: '', timestamp: Date.now(), fileName: f.name })
      })
    }

    // Add user message
    store.addMessage({ id: mkId(), type: 'user', content, timestamp: Date.now() })

    // Add empty AI message for streaming
    const aiMsgId = mkId()
    store.addMessage({ id: aiMsgId, type: 'ai', content: '', timestamp: Date.now() })
    store.setStreaming(true)

    try {
      await streamChat(
        params.id,
        content,
        files?.map((f) => f.name) ?? [],
        (type, data) => {
          if (type === 'text') {
            store.appendToLastMessage(data as string)
          } else if (type === 'context') {
            store.setContextFields(DEPLOYMENT_CONTEXT)
            store.setDemoStep(1)
          } else if (type === 'node') {
            store.setShowNode(true)
            store.setDemoStep(2)
          } else if (type === 'warning') {
            store.setActiveWarning(MOCK_WARNING)
            store.addMessage({
              id: mkId(),
              type: 'warning-card',
              content: '',
              timestamp: Date.now(),
              warning: MOCK_WARNING,
            })
            store.setDemoStep(4)
          } else if (type === 'suppliers') {
            store.setShowSuppliers(true)
            store.setDemoStep(5)
          }
        },
        () => store.setStreaming(false)
      )
    } catch {
      store.appendToLastMessage('\n\n[Connection error — using demo data]')
      // Fallback: run the full demo with hardcoded data
      store.setContextFields(DEPLOYMENT_CONTEXT)
      store.setShowNode(true)
      store.setActiveWarning(MOCK_WARNING)
      store.addMessage({ id: mkId(), type: 'warning-card', content: '', timestamp: Date.now(), warning: MOCK_WARNING })
      store.setShowSuppliers(true)
      store.setDemoStep(5)
      store.setStreaming(false)
    }
  }, [params.id, store])

  return (
    <div className="flex flex-col h-screen">
      <Header projectTitle="BuildGuard Node" onExport={handleExport} />
      <div className="flex flex-1 gap-2 p-2 overflow-hidden">
        <LeftPanel />
        <CenterPanel />
        <RightPanel onSend={handleSend} />
      </div>
      <ProgressBar />
    </div>
  )
}
```

- [ ] **Step 3: Verify full layout renders**

```bash
cd frontend && npm run dev
```
Open http://localhost:3000 → click "New Project" → should see 3-panel layout with empty state. No 404.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/project/ frontend/lib/claude-stream.ts
git commit -m "feat: project page layout wiring left/center/right panels"
```

---

## Task 11: Claude API Route

**Files:**
- Create: `frontend/app/api/chat/route.ts`
- Create: `frontend/__tests__/api-chat.test.ts`

- [ ] **Step 1: Write failing API test**

Create `frontend/__tests__/api-chat.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest'

// We test the prompt construction logic, not the full route (which requires Anthropic SDK)
import { buildSystemPrompt, parseEvents } from '../../app/api/chat/helpers'

describe('buildSystemPrompt', () => {
  it('includes deployment context instructions', () => {
    const prompt = buildSystemPrompt()
    expect(prompt).toContain('deployment context')
    expect(prompt).toContain('BuildGuard')
  })
})

describe('parseEvents', () => {
  it('emits context event when deployment context appears', () => {
    const text = 'Deployment context extracted: city Hong Kong'
    const events = parseEvents(text)
    expect(events.some((e) => e.type === 'context')).toBe(true)
  })

  it('emits node event when 3D node generation appears', () => {
    const text = 'Generating 3D BuildGuard Node...'
    const events = parseEvents(text)
    expect(events.some((e) => e.type === 'node')).toBe(true)
  })

  it('emits warning event when risk detected', () => {
    const text = 'Risk detected: IP_INSUFFICIENT weatherproofing issue'
    const events = parseEvents(text)
    expect(events.some((e) => e.type === 'warning')).toBe(true)
  })
})
```

- [ ] **Step 2: Run to confirm fail**

```bash
cd frontend && npm test -- api-chat
```
Expected: FAIL — helpers not found.

- [ ] **Step 3: Create helpers module**

Create `frontend/app/api/chat/helpers.ts`:
```typescript
export function buildSystemPrompt(): string {
  return `You are Physical Cursor, an AI that turns dense-city problems into reviewable smart-city hardware briefs.

When the user describes a smart city problem, you:
1. Extract a deployment context (city, site, environment, power, connectivity, regulation, privacy, mounting, goal)
2. Generate a BuildGuard Node — a facade sensor node for the described use case
3. List components with a BOM
4. Identify the primary deployment risk (weatherproofing, thermal, structural, coverage, or power)
5. Propose a supplier route through the Greater Bay Area

For the BuildGuard Node demo:
- Site: 52-year-old Hong Kong residential building facade
- Sensors: crack, vibration, tilt, moisture
- Power: battery, no mains
- Connectivity: LoRa / NB-IoT
- Main risk: IP_INSUFFICIENT (no gasket, no drainage, no PTFE membrane)

Structure your response in clear steps. When you extract deployment context, start that section with "Deployment context extracted:". When you describe the 3D node, include "Generating 3D BuildGuard Node". When you identify a risk, include "Risk detected:". When you show supplier route, include "GBA supplier route:".`
}

type StreamEvent = { type: string; data?: unknown }

export function parseEvents(text: string): StreamEvent[] {
  const events: StreamEvent[] = []
  if (text.toLowerCase().includes('deployment context extracted')) {
    events.push({ type: 'context' })
  }
  if (text.toLowerCase().includes('generating 3d buildguard node') || text.toLowerCase().includes('3d node')) {
    events.push({ type: 'node' })
  }
  if (text.toLowerCase().includes('risk detected') || text.toLowerCase().includes('ip_insufficient')) {
    events.push({ type: 'warning' })
  }
  if (text.toLowerCase().includes('gba supplier route') || text.toLowerCase().includes('supplier route')) {
    events.push({ type: 'suppliers' })
  }
  return events
}
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
cd frontend && npm test -- api-chat
```
Expected: all 4 pass.

- [ ] **Step 5: Create API route**

Create `frontend/app/api/chat/route.ts`:
```typescript
import Anthropic from '@anthropic-ai/sdk'
import { buildSystemPrompt, parseEvents } from './helpers'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: Request) {
  const { message, fileNames } = await req.json()

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      function send(type: string, data: unknown) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type, data })}\n\n`))
      }

      try {
        const userContent = fileNames?.length
          ? `${message}\n\n[Attached files: ${fileNames.join(', ')}]`
          : message

        const anthropicStream = await client.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          system: buildSystemPrompt(),
          messages: [{ role: 'user', content: userContent }],
        })

        let fullText = ''

        for await (const event of anthropicStream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            const chunk = event.delta.text
            fullText += chunk
            send('text', chunk)

            // Fire pipeline events based on accumulated text
            const events = parseEvents(fullText)
            for (const e of events) {
              send(e.type, e.data)
            }
            // Reset fullText after event detection to avoid re-firing
            if (events.length > 0) fullText = ''
          }
        }
      } catch (err) {
        send('error', { message: String(err) })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
```

- [ ] **Step 6: Commit**

```bash
git add frontend/app/api/chat/
git commit -m "feat: Claude API streaming chat route with event parsing"
```

---

## Task 12: Apply Fix API Route

**Files:**
- Create: `frontend/app/api/fix/route.ts`
- Create: `frontend/__tests__/api-fix.test.ts`

- [ ] **Step 1: Write failing test**

Create `frontend/__tests__/api-fix.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { getFixForWarning } from '../../app/api/fix/helpers'

describe('getFixForWarning', () => {
  it('returns fix data for IP_INSUFFICIENT', () => {
    const fix = getFixForWarning('IP_INSUFFICIENT')
    expect(fix).not.toBeNull()
    expect(fix!.costDelta).toBe(14)
    expect(fix!.bomChanges).toHaveLength(3)
    expect(fix!.rfqQuestionsAdded.length).toBeGreaterThan(0)
  })

  it('returns null for unknown warning id', () => {
    expect(getFixForWarning('UNKNOWN_WARNING')).toBeNull()
  })
})
```

- [ ] **Step 2: Run to confirm fail**

```bash
cd frontend && npm test -- api-fix
```
Expected: FAIL.

- [ ] **Step 3: Create fix helpers**

Create `frontend/app/api/fix/helpers.ts`:
```typescript
import { MOCK_WARNING } from '@/lib/buildguard-data'
import type { SimulationWarning } from '@/lib/types'

const WARNING_REGISTRY: Record<string, SimulationWarning> = {
  IP_INSUFFICIENT: MOCK_WARNING,
}

export function getFixForWarning(warningId: string): SimulationWarning['fix'] | null {
  const warning = WARNING_REGISTRY[warningId]
  return warning ? warning.fix : null
}
```

- [ ] **Step 4: Run to confirm pass**

```bash
cd frontend && npm test -- api-fix
```
Expected: both pass.

- [ ] **Step 5: Create API route**

Create `frontend/app/api/fix/route.ts`:
```typescript
import { getFixForWarning } from './helpers'

export async function POST(req: Request) {
  const { warningId } = await req.json()
  const fix = getFixForWarning(warningId)

  if (!fix) {
    return Response.json({ error: 'Unknown warning id' }, { status: 404 })
  }

  return Response.json(fix)
}
```

- [ ] **Step 6: Commit**

```bash
git add frontend/app/api/fix/
git commit -m "feat: apply fix API route"
```

---

## Task 13: Export — Smart City Readiness Pack

**Files:**
- Create: `frontend/lib/export.ts`

- [ ] **Step 1: Export utility**

Create `frontend/lib/export.ts`:
```typescript
import jsPDF from 'jspdf'
import type { ContextField, BOMRow, Supplier } from './types'

type ExportData = {
  projectTitle: string
  contextFields: ContextField[]
  bom: BOMRow[]
  warningTitle: string
  fixLabel: string
  suppliers: Supplier[]
  rfqQuestions: string[]
}

export function exportReadinessPack(data: ExportData) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })

  doc.setFillColor(10, 10, 10)
  doc.rect(0, 0, 210, 297, 'F')
  doc.setTextColor(255, 255, 255)

  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('Smart City Readiness Pack', 20, 24)

  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(180, 180, 180)
  doc.text(data.projectTitle, 20, 32)

  // Deployment Context
  doc.setFontSize(10)
  doc.setTextColor(100, 130, 255)
  doc.text('DEPLOYMENT CONTEXT', 20, 46)
  doc.setTextColor(200, 200, 200)
  let y = 52
  data.contextFields.forEach((f) => {
    doc.setTextColor(140, 140, 140)
    doc.text(`${f.label}:`, 20, y)
    doc.setTextColor(200, 200, 200)
    doc.text(f.value, 60, y)
    y += 6
  })

  // BOM
  y += 6
  doc.setTextColor(100, 130, 255)
  doc.text('BILL OF MATERIALS', 20, y)
  y += 6
  data.bom.forEach((row) => {
    doc.setTextColor(200, 200, 200)
    doc.text(row.part, 20, y)
    doc.text(`$${row.cost}`, 170, y, { align: 'right' })
    y += 5
  })

  // Warning + Fix
  y += 6
  doc.setTextColor(239, 68, 68)
  doc.text(`⚠ ${data.warningTitle}`, 20, y)
  y += 5
  doc.setTextColor(100, 220, 130)
  doc.text(`Fix: ${data.fixLabel}`, 20, y)

  // RFQ
  y += 10
  doc.setTextColor(100, 130, 255)
  doc.text('RFQ QUESTIONS', 20, y)
  y += 5
  data.rfqQuestions.forEach((q) => {
    doc.setTextColor(180, 180, 180)
    doc.text(`• ${q}`, 22, y)
    y += 5
  })

  doc.save(`physical-cursor-${data.projectTitle.toLowerCase().replace(/\s+/g, '-')}.pdf`)
}
```

- [ ] **Step 2: Wire export button in project page**

In `frontend/app/project/[id]/page.tsx`, replace the empty `handleExport` function:
```typescript
function handleExport() {
  const { contextFields, bom, activeWarning, fixApplied } = useProjectStore.getState()
  exportReadinessPack({
    projectTitle: 'BuildGuard Node',
    contextFields,
    bom,
    warningTitle: activeWarning?.title ?? '',
    fixLabel: activeWarning?.fix.label ?? '',
    suppliers: SUPPLIERS,
    rfqQuestions: [
      ...(activeWarning?.fix.rfqQuestionsAdded ?? []),
      ...RFQ_QUESTIONS_BASE,
    ],
  })
}
```

Also add the import at the top of the file:
```typescript
import { exportReadinessPack } from '@/lib/export'
import { SUPPLIERS } from '@/lib/suppliers-data'
import { RFQ_QUESTIONS_BASE } from '@/lib/buildguard-data'
```

- [ ] **Step 3: Commit**

```bash
git add frontend/lib/export.ts frontend/app/project/
git commit -m "feat: export Smart City Readiness Pack as PDF"
```

---

## Task 14: Final Integration Test + Demo Dry Run

- [ ] **Step 1: Run full test suite**

```bash
cd frontend && npm test
```
Expected: all tests pass.

- [ ] **Step 2: Run dev server and walk through demo flow manually**

```bash
cd frontend && npm run dev
```

Walk through:
1. Open http://localhost:3000 — projects home visible
2. Click "New Project" — redirects to `/project/[id]`
3. Type the BuildGuard prompt in chat: *"A 52-year-old Hong Kong residential building needs a low-maintenance facade sensor node..."*
4. AI responds and streams — context cards appear in LEFT, 3D node appears in CENTER
5. Click X-Ray / Explode — components separate with labels
6. Click a BOM row — component highlights in 3D
7. ⚠️ Warning card appears in chat — Apply Fix button visible
8. Click Apply Fix — 3D updates, BOM adds 3 rows, cost updates $213 → $227
9. Supplier route cards appear in LEFT
10. Click "Export Pack" — PDF downloads

- [ ] **Step 3: Verify fallback works (disconnect API key)**

In `.env.local`, set `ANTHROPIC_API_KEY=invalid`. Restart server, run the same prompt. The demo should still complete using hardcoded data with the error fallback.

Restore correct API key after test.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete Physical Cursor POC — demo ready"
```

---

## Execution Order

Critical path:
```
Task 1 (setup) → Task 2 (data) → Task 3 (store) → Task 4 (layout) →
Tasks 5-9 in parallel (home, progress, left, center, right) →
Task 10 (project page wiring) → Task 11 (Claude API) → Task 12 (fix API) →
Task 13 (export) → Task 14 (integration test)
```

Tasks 5-9 have no dependencies on each other — they can be executed in parallel by separate agents.
