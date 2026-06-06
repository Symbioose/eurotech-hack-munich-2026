export function buildSystemPrompt(): string {
  return `You are Physical Cursor, an AI that turns smart city deployment problems into reviewable hardware briefs.

When the user describes a deployment scenario, work through these steps in order:

**Step 1 — deployment context extraction**
Write exactly: "Deployment context extracted:"
Then on the next line, output a JSON array (no markdown code blocks):
[{"label":"City","value":"..."},{"label":"Site","value":"..."},{"label":"Environment","value":"..."},{"label":"Power","value":"..."},{"label":"Connectivity","value":"..."},{"label":"Regulation","value":"..."},{"label":"Mounting","value":"..."},{"label":"Privacy","value":"..."}]
Extract these values from what the user actually described.

**Step 2 — BuildGuard Node**
Write exactly: "Generating 3D BuildGuard Node"
Then describe the sensor node hardware briefly.

**Step 3 — Bill of Materials**
Write exactly: "Bill of Materials:"
Then on the next line, output a JSON array (no markdown code blocks):
[{"part":"...","supplierRoute":"...","cost":12},{"part":"...","supplierRoute":"...","cost":34}]
Include 8–12 real components with GBA supplier routes (Shenzhen EMS, Dongguan enclosure/metal, HK distributor, etc.) and realistic USD costs.

**Step 4 — Risk**
Write exactly: "Risk detected:"
Then on the next line, output a JSON object (no markdown code blocks):
{"severity":"critical","title":"...","explanation":"...","affectedComponents":["component1","component2"]}
Identify the primary deployment risk for the described environment.

**Step 5 — Supplier route**
Write exactly: "GBA supplier route:"
Then describe the manufacturing chain through the Greater Bay Area.

Rules:
- Always output JSON immediately after the keyword, on the next line
- Never wrap JSON in markdown code blocks
- Extract context from what the user actually described — do not invent data`
}

type StreamEvent = { type: string; data?: unknown }

function extractJSONArray(text: string, afterKeyword: string): unknown[] | null {
  const idx = text.toLowerCase().indexOf(afterKeyword.toLowerCase())
  if (idx === -1) return null
  const rest = text.slice(idx + afterKeyword.length).replace(/```(?:json)?/g, '').trimStart()
  const start = rest.indexOf('[')
  if (start === -1) return null
  let depth = 0, end = -1
  for (let i = start; i < rest.length; i++) {
    if (rest[i] === '[' || rest[i] === '{') depth++
    else if (rest[i] === ']' || rest[i] === '}') { depth--; if (depth === 0) { end = i; break } }
  }
  if (end === -1) return null
  try { return JSON.parse(rest.slice(start, end + 1)) } catch { return null }
}

function extractJSONObject(text: string, afterKeyword: string): Record<string, unknown> | null {
  const idx = text.toLowerCase().indexOf(afterKeyword.toLowerCase())
  if (idx === -1) return null
  const rest = text.slice(idx + afterKeyword.length).replace(/```(?:json)?/g, '').trimStart()
  const start = rest.indexOf('{')
  if (start === -1) return null
  let depth = 0, end = -1
  for (let i = start; i < rest.length; i++) {
    if (rest[i] === '{') depth++
    else if (rest[i] === '}') { depth--; if (depth === 0) { end = i; break } }
  }
  if (end === -1) return null
  try { return JSON.parse(rest.slice(start, end + 1)) as Record<string, unknown> } catch { return null }
}

export function parseEvents(text: string): StreamEvent[] {
  const events: StreamEvent[] = []
  const lower = text.toLowerCase()

  if (lower.includes('deployment context extracted')) {
    const data = extractJSONArray(text, 'deployment context extracted')
    events.push({ type: 'context', data: data ?? undefined })
  }

  if (lower.includes('generating 3d buildguard node') || lower.includes('3d buildguard node')) {
    events.push({ type: 'node' })
  }

  if (lower.includes('bill of materials:')) {
    const data = extractJSONArray(text, 'bill of materials:')
    if (data) events.push({ type: 'bom', data })
  }

  if (lower.includes('risk detected')) {
    const data = extractJSONObject(text, 'risk detected')
    events.push({ type: 'warning', data: data ?? undefined })
  }

  if (lower.includes('gba supplier route') || lower.includes('supplier route:')) {
    events.push({ type: 'suppliers' })
  }

  return events
}
