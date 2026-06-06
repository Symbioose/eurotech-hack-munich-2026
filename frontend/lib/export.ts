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
  doc.text(`! ${data.warningTitle}`, 20, y)
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
    doc.text(`- ${q}`, 22, y)
    y += 5
  })

  doc.save(`physical-cursor-${data.projectTitle.toLowerCase().replace(/\s+/g, '-')}.pdf`)
}
