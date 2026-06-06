import fs from 'fs'
import path from 'path'

export const runtime = 'nodejs'

/**
 * Marketplace redirect funnel. Every "Buy" click goes through here so we own the
 * touchpoint: we tag the URL with our marketplace ref (future affiliate tag),
 * log the click, then 302 to the distributor. Swapping in a real affiliate
 * program later means changing only this file — the UI never changes.
 */

// Only redirect to distributors we surface — prevents open-redirect abuse.
const ALLOWED_HOSTS = [
  'lcsc.com',
  'octopart.com',
  'digikey.com',
  'mouser.com',
  'nexar.com',
]

const REF_TAG = 'physicalcursor'

function isAllowed(url: URL): boolean {
  const host = url.hostname.replace(/^www\./, '')
  return ALLOWED_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))
}

function logClick(entry: Record<string, unknown>) {
  try {
    const file = path.join(process.cwd(), 'data', '_marketplace-clicks.jsonl')
    fs.appendFileSync(file, JSON.stringify(entry) + '\n')
  } catch {
    // best-effort; never block the redirect on a logging failure
  }
}

export function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const raw = searchParams.get('u')
  const componentId = searchParams.get('c') ?? 'unknown'
  const distributor = searchParams.get('d') ?? 'unknown'

  if (!raw) return new Response('missing url', { status: 400 })

  let target: URL
  try {
    target = new URL(raw)
  } catch {
    return new Response('bad url', { status: 400 })
  }
  if (target.protocol !== 'https:' || !isAllowed(target)) {
    return new Response('destination not allowed', { status: 400 })
  }

  // Tag the outbound link as ours (placeholder for a real affiliate tag).
  target.searchParams.set('utm_source', REF_TAG)
  target.searchParams.set('utm_medium', 'marketplace')
  target.searchParams.set('ref', REF_TAG)

  logClick({
    ts: new Date().toISOString(),
    componentId,
    distributor,
    destination: target.toString(),
  })

  return Response.redirect(target.toString(), 302)
}
