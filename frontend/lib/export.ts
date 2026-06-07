import jsPDF from 'jspdf'
import type { ContextField, BOMRow, BOMOffer, GbaRouteDisplayStep } from './types'
import type { PipelineState } from './pipeline/types'

export type ReadinessData = {
  projectTitle: string
  contextFields: ContextField[]
  bom: BOMRow[]
  bomTotal: number
  baselineBomTotal: number
  fixApplied: boolean
  warning?: { title: string; explanation: string; fixLabel: string; costDelta: number } | null
  gbaRoute: GbaRouteDisplayStep[]
  rfqQuestions: string[]
}

function bestOffer(offers?: BOMOffer[]): BOMOffer | null {
  if (!offers?.length) return null
  return [...offers].filter((o) => o.url).sort((a, b) => a.unitPrice - b.unitPrice)[0] ?? null
}

function slug(title: string) {
  return (title || 'product').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/* ------------------------------------------------------------------ */
/* Readiness Pack — PDF (human deliverable)                            */
/* ------------------------------------------------------------------ */

export function exportReadinessPack(data: ReadinessData) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const PAGE_H = 297
  const PAGE_W = 210
  const MARGIN = 20
  const MAX_W = PAGE_W - MARGIN * 2
  let y = 0

  const paintBg = () => {
    doc.setFillColor(10, 10, 12)
    doc.rect(0, 0, PAGE_W, PAGE_H, 'F')
  }
  paintBg()

  const ensure = (needed: number) => {
    if (y + needed > PAGE_H - MARGIN) {
      doc.addPage()
      paintBg()
      y = MARGIN
    }
  }

  const text = (
    value: string,
    opts: { size?: number; color?: [number, number, number]; bold?: boolean; x?: number; gap?: number } = {}
  ) => {
    const { size = 10, color = [200, 200, 205], bold = false, x = MARGIN, gap = 5 } = opts
    doc.setFontSize(size)
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setTextColor(...color)
    const lines = doc.splitTextToSize(value, MAX_W - (x - MARGIN))
    for (const ln of lines) {
      ensure(gap)
      doc.text(ln, x, y)
      y += gap
    }
  }

  const heading = (label: string) => {
    y += 4
    ensure(7)
    text(label, { size: 10, color: [120, 150, 255], bold: true })
    y += 1
  }

  // Header
  y = MARGIN + 4
  text('Manufacturing Readiness Pack', { size: 18, bold: true, color: [255, 255, 255] })
  y += 1
  text(data.projectTitle || 'Hardware product', { size: 11, color: [170, 170, 180] })
  text('Manu — the hardware copilot that blocks designs that fail in the field.', {
    size: 8,
    color: [110, 110, 120],
  })

  // Failure-catch hero (the differentiator)
  if (data.warning) {
    y += 4
    ensure(26)
    doc.setFillColor(30, 14, 14)
    doc.setDrawColor(150, 50, 50)
    const boxTop = y - 2
    doc.roundedRect(MARGIN, boxTop, MAX_W, 24, 2, 2, 'FD')
    const innerX = MARGIN + 4
    y += 4
    text('FAILURE CAUGHT BEFORE MANUFACTURING', { size: 9, bold: true, color: [255, 120, 120], x: innerX })
    text(`${data.warning.title} — ${data.warning.explanation}`, { size: 9, color: [220, 200, 200], x: innerX })
    text(
      `Resolved: ${data.warning.fixLabel} (+$${data.warning.costDelta}). Re-validated after fix.`,
      { size: 9, color: [150, 220, 160], x: innerX }
    )
    y += 3
  }

  // Deployment context
  heading('DEPLOYMENT CONTEXT')
  data.contextFields
    .filter((f) => f.value && f.value !== '—')
    .forEach((f) => {
      ensure(5)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(140, 140, 145)
      doc.text(`${f.label}:`, MARGIN, y)
      doc.setTextColor(205, 205, 210)
      const lines = doc.splitTextToSize(f.value, MAX_W - 35)
      doc.text(lines, MARGIN + 33, y)
      y += 5 * lines.length
    })

  // BOM with sourcing
  heading('BILL OF MATERIALS')
  ensure(5)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(120, 120, 130)
  doc.text('Part / MPN', MARGIN, y)
  doc.text('Source', MARGIN + 95, y)
  doc.text('$', PAGE_W - MARGIN, y, { align: 'right' })
  y += 4
  doc.setFont('helvetica', 'normal')
  data.bom.forEach((row) => {
    ensure(5)
    doc.setFontSize(8)
    doc.setTextColor(row.isNew ? 120 : 205, row.isNew ? 220 : 205, row.isNew ? 150 : 210)
    const name = doc.splitTextToSize(`${row.isNew ? '+ ' : ''}${row.part}`, 70)[0]
    doc.text(name, MARGIN, y)
    const meta = [row.manufacturer, row.mpn].filter(Boolean).join(' · ')
    const offer = bestOffer(row.offers)
    doc.setTextColor(130, 130, 140)
    doc.text(doc.splitTextToSize(offer ? offer.distributor : '—', 30)[0], MARGIN + 95, y)
    doc.setTextColor(205, 205, 210)
    doc.text(`$${row.cost}`, PAGE_W - MARGIN, y, { align: 'right' })
    y += 4
    if (meta) {
      ensure(4)
      doc.setFontSize(6.5)
      doc.setTextColor(110, 110, 120)
      doc.text(meta, MARGIN + 2, y)
      y += 3.5
    }
  })
  ensure(6)
  y += 1
  doc.setDrawColor(60, 60, 70)
  doc.line(MARGIN, y, PAGE_W - MARGIN, y)
  y += 4
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.text('Total (unit, qty 1)', MARGIN, y)
  doc.text(`$${data.bomTotal}`, PAGE_W - MARGIN, y, { align: 'right' })
  y += 5

  const estimates = data.bom.filter((r) => r.sourceStatus === 'candidate' || r.sourceStatus === 'error').length
  if (estimates > 0) {
    text(`${estimates} line(s) are unverified estimates — confirm part, price and supplier before RFQ.`, {
      size: 7.5,
      color: [210, 170, 90],
    })
  }

  // Where to buy
  const buyable = data.bom.map((r) => ({ r, o: bestOffer(r.offers) })).filter((x) => x.o)
  if (buyable.length) {
    heading('WHERE TO BUY')
    buyable.forEach(({ r, o }) => {
      text(`${r.part} → ${o!.distributor} (${o!.region}) ~$${o!.unitPrice}/unit`, {
        size: 7.5,
        color: [170, 180, 200],
      })
      text(o!.url, { size: 6.5, color: [90, 110, 160], x: MARGIN + 2 })
    })
  }

  // RFQ
  if (data.rfqQuestions.length) {
    heading('RFQ QUESTIONS')
    data.rfqQuestions.forEach((q) => text(`• ${q}`, { size: 8, color: [180, 180, 190], x: MARGIN + 2 }))
  }

  // Supplier route
  if (data.gbaRoute.length) {
    heading('SUPPLIER ROUTE')
    data.gbaRoute.forEach((stop) => {
      text(`${stop.step}. ${stop.role} (${stop.region})`, { size: 8.5, color: [205, 205, 210] })
      if (stop.description) text(stop.description, { size: 7, color: [120, 120, 130], x: MARGIN + 4 })
    })
  }

  doc.save(`manu-${slug(data.projectTitle)}.pdf`)
}

/* ------------------------------------------------------------------ */
/* Design artifact — JSON (machine: world model + procurement)         */
/* ------------------------------------------------------------------ */

export function exportDesignJson(state: PipelineState, projectTitle: string) {
  const ctx = state.deploymentContext
  const artifact = {
    object_id: state.componentGraph.node_type || slug(projectTitle),
    name: projectTitle || state.componentGraph.node_type,
    prompt: state.prompt,
    deployment_context: ctx,
    component_graph: state.componentGraph,
    bom: {
      total_cost_usd: state.bom.total_cost_usd,
      rows: state.bom.rows.map((r) => ({
        component_id: r.component_id,
        part: r.part,
        cost_usd: r.cost_usd,
        source_status: r.source?.source_status ?? 'seeded',
        mpn: r.sourcing?.mpn ?? null,
        manufacturer: r.sourcing?.manufacturer ?? null,
        offers: r.sourcing?.offers ?? [],
      })),
    },
    dfma: state.dfma,
    fix_applied: state.fixApplied,
    scene_graph: { nodes: state.scene.nodes },
    supplier_route: state.gbaRouteDisplay,
    _note:
      'Manu design artifact. Feed into the world-model stress test or a procurement system. Unverified parts are flagged source_status=candidate.',
  }
  triggerDownload(
    new Blob([JSON.stringify(artifact, null, 2)], { type: 'application/json' }),
    `manu-${slug(projectTitle)}.json`
  )
}

/* ------------------------------------------------------------------ */
/* BOM — CSV (buyer / procurement import)                              */
/* ------------------------------------------------------------------ */

function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function exportBomCsv(bom: BOMRow[], projectTitle: string) {
  const header = [
    'part',
    'manufacturer',
    'mpn',
    'qty',
    'unit_cost_usd',
    'lifecycle',
    'source_status',
    'best_distributor',
    'best_unit_price_usd',
    'buy_url',
  ]
  const rows = bom.map((r) => {
    const offer = bestOffer(r.offers)
    return [
      r.part,
      r.manufacturer ?? '',
      r.mpn ?? '',
      1,
      r.cost,
      r.lifecycle ?? '',
      r.sourceStatus ?? '',
      offer?.distributor ?? '',
      offer?.unitPrice ?? '',
      offer?.url ?? '',
    ]
  })
  const csv = [header, ...rows].map((line) => line.map(csvCell).join(',')).join('\n')
  triggerDownload(new Blob([csv], { type: 'text/csv' }), `manu-${slug(projectTitle)}-bom.csv`)
}
