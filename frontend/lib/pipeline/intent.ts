import { callJsonAgent, hasOpenAIKey } from './llm'
import { extractJsonObject } from './parse-json'
import type { ChatIntent, EditOp, ProposedComponent } from './edit-resolver'

export type DesignSummary = {
  node_type: string
  components: { id: string; part: string }[]
}

const SYSTEM = `You are the conversation router for Physical Cursor, a tool that designs ANY physical/hardware product.

A product design already exists. Decide what the user's latest message means and return ONLY valid JSON.

Possible actions:
1. "edit" — the user wants to change the CURRENT design: add, remove, or replace components, or change a quantity/material. Map the request to concrete edit ops.
2. "generate" — the user wants to design a DIFFERENT product from scratch (a new brief unrelated to the current one).
3. "chat" — the user is asking a question or making a comment that does not change the design.

JSON shape:
{
  "action": "edit" | "generate" | "chat",
  "reply": string,                 // a short, friendly natural-language reply to show the user
  "edits": [                       // ONLY when action = "edit"
    { "op": "add", "component": { "id"?: string, "part": string, "category"?: string, "estimated_cost_usd"?: number } } |
    { "op": "remove", "target": string } |   // target = a component name or id from the current design
    { "op": "replace", "target": string, "component": { "part": string, "estimated_cost_usd"?: number } }
  ],
  "prompt": string                 // ONLY when action = "generate": a concise brief for the new product
}

Rules:
- Prefer existing component ids from the current design when removing/replacing (use their part name or id as target).
- When adding a part, reuse a current component id if it clearly already covers it; otherwise describe the new part and give a rough estimated_cost_usd. Be honest that estimates are unverified.
- "reply" must be one or two sentences, no markdown lists.
- Do not invent that you performed the change — the system applies edits after you return.`

function fallbackIntent(message: string, design: DesignSummary): ChatIntent {
  const lower = message.toLowerCase()
  const removeMatch = lower.match(/\b(remove|delete|drop|retire|enl[eè]ve|sans|without|take out)\b\s+(.*)/)
  const addMatch = lower.match(/\b(add|include|ajoute|with|put in|fit)\b\s+(.*)/)

  if (removeMatch) {
    const target = removeMatch[2].replace(/\b(the|le|la|les|a|an|some|du|des)\b/g, '').trim()
    return {
      action: 'edit',
      reply: `Removing "${target}" from the design and re-checking the bill of materials.`,
      edits: [{ op: 'remove', target: target || removeMatch[2].trim() }],
    }
  }
  if (addMatch) {
    const part = addMatch[2].replace(/\b(a|an|the|some|un|une|du|des)\b/g, '').trim()
    return {
      action: 'edit',
      reply: `Adding "${part}" to the design and re-checking the bill of materials.`,
      edits: [{ op: 'add', component: { part: part || addMatch[2].trim() } }],
    }
  }
  // No design context or clearly a new product request → regenerate.
  if (design.components.length === 0) {
    return { action: 'generate', prompt: message }
  }
  return {
    action: 'chat',
    reply:
      'I can change the current design — tell me what to add, remove, or replace (e.g. "remove the battery" or "add a USB-C port"), or describe a new product to design instead.',
  }
}

function coerceEdit(raw: unknown): EditOp | null {
  if (typeof raw !== 'object' || raw === null) return null
  const value = raw as Record<string, unknown>
  const op = value.op
  if (op === 'remove' && typeof value.target === 'string' && value.target.trim()) {
    return { op: 'remove', target: value.target.trim() }
  }
  const component = value.component as Record<string, unknown> | undefined
  const proposed: ProposedComponent | null =
    component && typeof component.part === 'string' && component.part.trim()
      ? {
          part: component.part.trim(),
          id: typeof component.id === 'string' ? component.id.trim() : undefined,
          category: typeof component.category === 'string' ? component.category.trim() : undefined,
          estimated_cost_usd:
            typeof component.estimated_cost_usd === 'number' ? component.estimated_cost_usd : undefined,
        }
      : null
  if (op === 'add' && proposed) return { op: 'add', component: proposed }
  if (op === 'replace' && proposed && typeof value.target === 'string' && value.target.trim()) {
    return { op: 'replace', target: value.target.trim(), component: proposed }
  }
  return null
}

function normalizeIntent(raw: Partial<ChatIntent> & Record<string, unknown>, message: string, design: DesignSummary): ChatIntent {
  const action = raw.action
  if (action === 'edit') {
    const edits = Array.isArray(raw.edits)
      ? raw.edits.map(coerceEdit).filter((edit): edit is EditOp => edit !== null)
      : []
    if (edits.length === 0) return fallbackIntent(message, design)
    return {
      action: 'edit',
      edits,
      reply: typeof raw.reply === 'string' && raw.reply.trim() ? raw.reply.trim() : 'Updating the design.',
    }
  }
  if (action === 'generate') {
    return {
      action: 'generate',
      prompt: typeof raw.prompt === 'string' && raw.prompt.trim() ? raw.prompt.trim() : message,
      reply: typeof raw.reply === 'string' ? raw.reply.trim() : undefined,
    }
  }
  if (action === 'chat' && typeof raw.reply === 'string' && raw.reply.trim()) {
    return { action: 'chat', reply: raw.reply.trim() }
  }
  return fallbackIntent(message, design)
}

export async function classifyChatIntent(message: string, design: DesignSummary): Promise<ChatIntent> {
  if (!hasOpenAIKey()) return fallbackIntent(message, design)
  try {
    const user = `Current design (node_type: ${design.node_type}):\n${
      design.components.map((c) => `- ${c.id} (${c.part})`).join('\n') || '(no components yet)'
    }\n\nUser message:\n${message}`
    const text = await callJsonAgent(SYSTEM, user)
    const raw = extractJsonObject<Partial<ChatIntent> & Record<string, unknown>>(text)
    return normalizeIntent(raw, message, design)
  } catch {
    return fallbackIntent(message, design)
  }
}
