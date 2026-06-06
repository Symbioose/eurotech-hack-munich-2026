import type { CatalogComponent, PartSourcing, SupplierOffer } from './types'
import registryFile from '../../data/parts-registry.json'

type RegistryEntry = {
  mpn?: string
  manufacturer?: string
  lifecycle?: PartSourcing['lifecycle']
  rohs?: boolean
  datasheet_url?: string
}

const REGISTRY = (registryFile as { parts: Record<string, RegistryEntry> }).parts ?? {}

/**
 * Distributors we surface "Buy" links for. We use each distributor's real
 * search endpoint keyed by MPN (or part name), so a buy click always lands on a
 * live page even before we wire the Octopart/Nexar or LCSC pricing APIs.
 */
const DISTRIBUTORS: {
  name: string
  region: string
  /** deterministic price multiplier vs the seeded catalog cost */
  priceFactor: number
  moq: number
  search: (q: string) => string
}[] = [
  {
    name: 'LCSC',
    region: 'CN / Greater Bay Area',
    priceFactor: 0.85,
    moq: 5,
    search: (q) => `https://www.lcsc.com/search?q=${encodeURIComponent(q)}`,
  },
  {
    name: 'Octopart',
    region: 'Global (400+ distributors)',
    priceFactor: 1.0,
    moq: 1,
    search: (q) => `https://octopart.com/search?q=${encodeURIComponent(q)}`,
  },
  {
    name: 'Digi-Key',
    region: 'US / Global',
    priceFactor: 1.12,
    moq: 1,
    search: (q) => `https://www.digikey.com/en/products/result?keywords=${encodeURIComponent(q)}`,
  },
]

function round2(n: number) {
  return Math.round(n * 100) / 100
}

/** Build sourcing (MPN, manufacturer, lifecycle, distributor offers) for a component. */
export function buildSourcing(component: CatalogComponent): PartSourcing {
  const entry = REGISTRY[component.id]
  const unverifiedPart = component.source?.source_status === 'candidate'
  const mpn = entry?.mpn ?? null
  const query = mpn || component.part
  const baseCost = component.cost_usd > 0 ? component.cost_usd : 1

  const offers: SupplierOffer[] = DISTRIBUTORS.map((d) => ({
    distributor: d.name,
    region: d.region,
    sku: mpn,
    unit_price_usd: round2(baseCost * d.priceFactor),
    moq: d.moq,
    stock: null, // unknown until a pricing API is wired; the link shows live stock
    product_url: d.search(query),
    verified: false,
  }))

  return {
    mpn,
    manufacturer: entry?.manufacturer ?? null,
    datasheet_url: entry?.datasheet_url ?? null,
    lifecycle: entry?.lifecycle ?? (unverifiedPart ? 'unknown' : 'active'),
    rohs: entry?.rohs ?? null,
    offers,
  }
}

/** Cheapest offer that has a buy URL — the default "Buy" target. */
export function selectBestOffer(sourcing?: PartSourcing): SupplierOffer | null {
  if (!sourcing?.offers?.length) return null
  return [...sourcing.offers]
    .filter((o) => o.product_url)
    .sort((a, b) => a.unit_price_usd - b.unit_price_usd)[0] ?? null
}

/**
 * Wrap a distributor URL through our own redirect so every buy click is an
 * affiliate/marketplace touchpoint we own (tag + click logging). This is the
 * marketplace funnel primitive — the destination/affiliate tag can change later
 * without touching the UI.
 */
export function affiliateHref(
  productUrl: string,
  opts: { componentId: string; distributor: string }
): string {
  const params = new URLSearchParams({
    u: productUrl,
    c: opts.componentId,
    d: opts.distributor,
  })
  return `/api/go?${params.toString()}`
}
