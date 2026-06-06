import type { CatalogComponent, ComponentCatalog } from './types'

/**
 * A component the chat proposed adding. It may reference an existing catalog id
 * (preferred — keeps the design grounded) or describe a new part that is not in
 * the catalog. New parts are added as *unverified* (source_status 'candidate'):
 * their price and supplier are LLM estimates that must be confirmed before RFQ.
 */
export type ProposedComponent = {
  id?: string
  part: string
  category?: string
  estimated_cost_usd?: number
}

export type EditOp =
  | { op: 'remove'; target: string }
  | { op: 'add'; component: ProposedComponent }
  | { op: 'replace'; target: string; component: ProposedComponent }

/** What the chat decided to do with a user message once a design exists. */
export type ChatIntent =
  | { action: 'generate'; prompt: string; reply?: string }
  | { action: 'edit'; edits: EditOp[]; reply: string }
  | { action: 'chat'; reply: string }

export type ResolvedEdit = {
  selectedComponentIds: string[]
  extraComponents: CatalogComponent[]
  added: string[]
  removed: string[]
  notFound: string[]
}

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

function slugify(value: string) {
  return (
    normalize(value)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'component'
  )
}

/** Tokens longer than 2 chars, used for fuzzy name matching. */
function tokens(value: string) {
  return normalize(value)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2)
}

function matchesComponent(target: string, component: CatalogComponent): boolean {
  const t = normalize(target)
  if (!t) return false
  if (normalize(component.id) === t) return true
  const partTokens = new Set(tokens(component.part))
  const idTokens = new Set(tokens(component.id))
  const targetTokens = tokens(t)
  // Match when the target shares a meaningful token with the part name or id,
  // e.g. "remove the camera" -> "camera-module".
  return targetTokens.some((token) => partTokens.has(token) || idTokens.has(token) || component.id.includes(token))
}

export function makeUnverifiedComponent(
  proposed: ProposedComponent,
  takenIds: Set<string>,
  index = 0
): CatalogComponent {
  let id = proposed.id?.trim() || slugify(proposed.part)
  if (takenIds.has(id)) {
    let n = 2
    while (takenIds.has(`${id}-${n}`)) n += 1
    id = `${id}-${n}`
  }

  return {
    id,
    part: proposed.part.trim() || id,
    category: proposed.category?.trim() || 'custom',
    supplier_route: 'Unverified — needs sourcing',
    cost_usd:
      typeof proposed.estimated_cost_usd === 'number' && Number.isFinite(proposed.estimated_cost_usd)
        ? Math.max(0, proposed.estimated_cost_usd)
        : 0,
    tags: ['unverified'],
    source: {
      source_status: 'candidate',
      last_checked_at: '',
      update_strategy: 'LLM-proposed — confirm part, price and supplier before RFQ.',
    },
    scene: {
      scene_id: id,
      label: proposed.part.trim() || id,
      // Spread custom parts out so they do not pile up at the origin in 3D.
      position: [0.5 + index * 0.45, 0, 0],
      explodeOffset: [0.4 + index * 0.2, 0, 0],
      color: '#8b8b9a',
      geometry: 'box',
      scale: [0.3, 0.3, 0.3],
      assembly: {
        placement: 'internal',
        parent_scene_id: 'enclosure',
        anchor_face: 'inside',
        contact: 'standoff-mounted',
      },
    },
  }
}

/**
 * Apply a list of edit ops to the current selection, grounded in the catalog
 * plus any previously-added unverified components. Returns the new selection and
 * the full set of extra (unverified) components to thread through downstream
 * resolvers.
 */
export function resolveEditOps(
  edits: EditOp[],
  currentSelectedIds: string[],
  catalog: ComponentCatalog,
  priorExtra: CatalogComponent[] = []
): ResolvedEdit {
  const selected = new Set(currentSelectedIds)
  const extra = new Map(priorExtra.map((component) => [component.id, component]))
  const knownComponents = [...catalog.components, ...priorExtra]
  const added: string[] = []
  const removed: string[] = []
  const notFound: string[] = []
  let newCount = 0

  const findCatalogId = (proposed: ProposedComponent): string | null => {
    if (proposed.id) {
      const byId = knownComponents.find((component) => component.id === proposed.id)
      if (byId) return byId.id
    }
    const byName = knownComponents.find((component) => matchesComponent(proposed.part, component))
    return byName?.id ?? null
  }

  const removeTarget = (target: string) => {
    const matches = knownComponents
      .filter((component) => selected.has(component.id) && matchesComponent(target, component))
      .map((component) => component.id)
    if (matches.length === 0) {
      notFound.push(target)
      return
    }
    for (const id of matches) {
      selected.delete(id)
      removed.push(id)
    }
  }

  const addComponent = (proposed: ProposedComponent) => {
    const existingId = findCatalogId(proposed)
    if (existingId) {
      if (!selected.has(existingId)) {
        selected.add(existingId)
        added.push(existingId)
      }
      return
    }
    const taken = new Set<string>([
      ...catalog.components.map((c) => c.id),
      ...extra.keys(),
    ])
    const component = makeUnverifiedComponent(proposed, taken, newCount++)
    extra.set(component.id, component)
    selected.add(component.id)
    added.push(component.id)
  }

  for (const edit of edits) {
    if (edit.op === 'remove') removeTarget(edit.target)
    else if (edit.op === 'add') addComponent(edit.component)
    else if (edit.op === 'replace') {
      removeTarget(edit.target)
      addComponent(edit.component)
    }
  }

  return {
    selectedComponentIds: [...selected],
    extraComponents: [...extra.values()],
    added,
    removed,
    notFound,
  }
}
