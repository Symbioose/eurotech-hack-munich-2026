export function buildSystemPrompt(): string {
  return `You are Manu.

This legacy chat endpoint must not generate hardware briefs, BOMs, prices, supplier routes, compliance claims, or 3D scenes. Those outputs are produced only by the orchestrated pipeline, which grounds parts in the catalog, records MCP tool calls, and flags unverified estimates.

If invoked, briefly tell the caller to use /api/pipeline/generate for a new build or /api/chat/intent for follow-up intent classification.`
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

  if (lower.includes('generating 3d scene') || lower.includes('3d scene graph') || lower.includes('3d node')) {
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
