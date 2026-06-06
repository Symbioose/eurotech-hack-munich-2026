# Frontend Redesign — Physical Cursor

Date: 2026-06-06  
Status: approved  
Approach: Hybrid (new pages built fresh, workspace reskinned in-place)

---

## Overview

Three-part change:

1. **Home page** — scroll-driven 3D hero (Three.js), projects grid revealed on scroll
2. **New Project entry page** — full-screen prompt input before workspace loads
3. **Workspace reskin** — same 3-panel structure, light monochrome palette

Design reference: `inspo.png` (dark 3D object / white data panel split) + user-provided Three.js hero HTML.

---

## Palette

| Token | Value | Usage |
|---|---|---|
| `bg` | `#f5f4f0` | Page background, hero canvas bg |
| `surface` | `#ffffff` | LEFT and RIGHT panels |
| `border` | `#e0dfd8` | Panel borders, card borders |
| `center-bg` | `#111111` | CENTER panel (3D node) |
| `text-primary` | `#111111` | Headings, labels, values |
| `text-secondary` | `#888888` | Subtitles, helper text |
| `text-muted` | `#bbbbbb` | Placeholders, disabled |
| `btn-primary` | `#111111` bg / `#ffffff` text | CTA buttons |
| `btn-secondary` | `#ffffff` bg / `#111111` text / `#e0dfd8` border | Secondary actions |

No color accents. All warning/error/success states use dark gray or black.

---

## 1. Home Page (`/`)

### Hero (full viewport)

- Vanilla Three.js canvas, `#f5f4f0` background (matches page — seamless)
- "Physical Cursor" wordmark top-left: 13px, `#111`, letter-spacing 0.08em
- Scroll progress bar bottom-center: 120px wide, 1px tall, `#ddd` track / `#111` fill
- Scroll animation (3 phases, wheel + touch):
  - **Phase 1 (0–38%):** Node parts fly in from scattered positions and assemble
  - **Phase 2 (38–66%):** Node descends into city scene, orbital rings appear, city lights pulse
  - **Phase 3 (66–100%):** Buildings rise from grid floor, connection lines spawn node → buildings

### Projects section (revealed at scroll ~85%)

- Fades in below the hero — no hard page break, same `#f5f4f0` background
- "PROJECTS" label: 10px uppercase, `#888`, letter-spacing 0.15em
- Grid: `grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5`, `gap-3`
- **New Project card:** white bg, `#e0dfd8` border, "+" centered in `#111`, "New Project" label in `#888`
- **Past project cards:** white bg, `#e0dfd8` border, project title in `#111`, date + status in `#888` — no colored badges, status as plain text

### Implementation files

- `app/page.tsx` — rewritten: hero + projects section
- `components/home/HeroScene.tsx` — vanilla Three.js in `useEffect`, canvas fills viewport
- `components/home/ProjectsGrid.tsx` — updated: new card styles
- `components/home/ProjectCard.tsx` — updated: monochrome styles

---

## 2. New Project Entry Page (`/project/[id]`)

Full-screen, `#f5f4f0` background. Current `/project/[id]/page.tsx` becomes this entry screen.

### Layout

```
[top-left] Physical Cursor wordmark

[centered vertically and horizontally]
  "Describe your smart city problem."   ← h1, 28px, #111, font-light
  
  [textarea]
    full-width, no background, no box-shadow
    border-bottom: 1px solid #e0dfd8 only
    placeholder: "A 52-year-old Hong Kong residential building needs..."
    min-height: 120px, resize: none, font-size: 16px, #111
  
  [Generate →]
    black fill button, white text, aligned right
    disabled until textarea has content
```

### Behaviour

- On submit: saves prompt to `sessionStorage` key `pc_prompt_${id}`, pushes to `/project/[id]/workspace`
- Workspace page already reads from sessionStorage and auto-runs the pipeline

### Implementation files

- `app/project/[id]/page.tsx` — rewritten as entry form (currently redirects to workspace; becomes the entry screen)

---

## 3. Workspace Reskin (`/project/[id]/workspace`)

Structure unchanged. Only Tailwind class swaps.

### Panel mapping

| Panel | Background | Border | Text |
|---|---|---|---|
| Page | `bg-[#f5f4f0]` | — | — |
| LEFT | `bg-white` | `border border-[#e0dfd8]` | `text-[#111]` |
| CENTER | `bg-[#111]` | — | white (3D labels) |
| RIGHT | `bg-white` | `border border-[#e0dfd8]` | `text-[#111]` |

### Component-level changes

**GlassPanel.tsx** — add `variant?: 'light' | 'dark'` prop (default `'light'`). `light`: `bg-white border border-[#e0dfd8]`. `dark`: `bg-[#111]` no border. Remove all existing `backdrop-blur`, `bg-white/[0.03]`, `border-white/[0.08]` classes. CenterPanel passes `variant="dark"`.

**Header.tsx** — `bg-[#f5f4f0]`, border-bottom `#e0dfd8`, text `#111`. Export button: `bg-[#111] text-white`.

**ProgressBar.tsx** — `bg-[#f5f4f0]`, border-top `#e0dfd8`. Active dot: `bg-[#111]`. Complete dot: `bg-[#bbb]`. Inactive dot: `bg-[#e0dfd8]`. Text: active `#111`, rest `#888`.

**LeftPanel.tsx / ContextCards.tsx / BOMTable.tsx / SupplierCards.tsx** — all `text-[#111]` primary, `text-[#888]` secondary, `border-[#e0dfd8]` dividers. BOM new rows: `font-semibold text-[#111]` (no green).

**RightPanel.tsx / ChatFeed.tsx / ChatMessage.tsx / ChatInput.tsx** — user bubble: `bg-[#111] text-white`. AI bubble: `bg-[#f5f4f0] text-[#111] border border-[#e0dfd8]`. Input: `bg-white border border-[#e0dfd8] text-[#111]`. Streaming label: `text-[#888]`.

**WarningCard.tsx** — border `border-[#e0dfd8]`, bg `bg-[#f5f4f0]`. Warning icon: `text-[#111]`. Apply Fix button: `bg-[#111] text-white`. Fix applied: `text-[#111] font-medium` (no green).

**ViewControls.tsx** — active mode: `bg-[#111] text-white`. Inactive: `text-[#888]`.

**PipelineStages.tsx** — monochrome stage indicators, `#111` active, `#bbb` complete, `#e0dfd8` inactive.

### Implementation files

All files above — in-place Tailwind class swaps only. No logic changes.

---

## Scope

**In:**
- Home hero + projects grid
- New project entry page
- Workspace palette reskin

**Out:**
- Pipeline logic changes
- 3D model geometry changes
- Chat / API behavior changes
- Mobile layout
- Export PDF styling
