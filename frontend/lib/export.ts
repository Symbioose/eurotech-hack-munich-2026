import jsPDF from 'jspdf'
import type { ContextField, BOMRow, GbaRouteDisplayStep } from './types'

type ExportData = {
  projectTitle: string
  contextFields: ContextField[]
  bom: BOMRow[]
  warningTitle: string
  fixLabel: string
  gbaRoute: GbaRouteDisplayStep[]
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
  doc.text(data.projectTitle || 'Smart City Node', 20, 32)

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

  if (data.warningTitle) {
    y += 6
    doc.setTextColor(239, 68, 68)
    doc.text(`! ${data.warningTitle}`, 20, y)
    y += 5
    doc.setTextColor(100, 220, 130)
    doc.text(`Fix: ${data.fixLabel}`, 20, y)
  }

  y += 10
  doc.setTextColor(100, 130, 255)
  doc.text('RFQ QUESTIONS', 20, y)
  y += 5
  data.rfqQuestions.forEach((q) => {
    doc.setTextColor(180, 180, 180)
    doc.text(`- ${q}`, 22, y)
    y += 5
  })

  y += 6
  doc.setTextColor(100, 130, 255)
  doc.text('GBA SUPPLIER ROUTE', 20, y)
  y += 5
  data.gbaRoute.forEach((stop) => {
    doc.setTextColor(200, 200, 200)
    doc.text(`${stop.step}. ${stop.role} (${stop.region})`, 22, y)
    y += 5
  })

  const slug = (data.projectTitle || 'node').toLowerCase().replace(/\s+/g, '-')
  doc.save(`physical-cursor-${slug}.pdf`)
}
