import fs from 'node:fs'
import path from 'node:path'

export function readData(fileName) {
  const filePath = path.join(process.cwd(), 'data', fileName)
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
}

export function includesAny(value, keywords = []) {
  const lower = String(value ?? '').toLowerCase()
  return keywords.some((keyword) => lower.includes(String(keyword).toLowerCase()))
}

export function scoreKeywords(value, keywords = []) {
  const lower = String(value ?? '').toLowerCase()
  return keywords.reduce(
    (score, keyword) => score + (lower.includes(String(keyword).toLowerCase()) ? 1 : 0),
    0
  )
}

export function toolResult(structuredContent) {
  return {
    content: [{ type: 'text', text: JSON.stringify(structuredContent, null, 2) }],
    structuredContent,
  }
}
