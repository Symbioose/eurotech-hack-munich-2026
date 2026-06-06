import path from 'path'
import fs from 'fs'
import type {
  AssemblyPatternsFile,
  ComplianceRulesFile,
  ComponentCatalog,
  DfmaRulesFile,
  SupplierGraph,
} from './types'

const DATA_DIR = path.join(process.cwd(), 'data')

export function loadCatalog(): ComponentCatalog {
  const raw = fs.readFileSync(path.join(DATA_DIR, 'component-catalog.json'), 'utf-8')
  return JSON.parse(raw) as ComponentCatalog
}

export function loadSupplierGraph(): SupplierGraph {
  const raw = fs.readFileSync(path.join(DATA_DIR, 'supplier-graph.json'), 'utf-8')
  return JSON.parse(raw) as SupplierGraph
}

export function loadDfmaRules(): DfmaRulesFile {
  const raw = fs.readFileSync(path.join(DATA_DIR, 'dfma-rules.json'), 'utf-8')
  return JSON.parse(raw) as DfmaRulesFile
}

export function loadComplianceRules(): ComplianceRulesFile {
  const raw = fs.readFileSync(path.join(DATA_DIR, 'compliance-rules.json'), 'utf-8')
  return JSON.parse(raw) as ComplianceRulesFile
}

export function loadAssemblyPatterns(): AssemblyPatternsFile {
  const raw = fs.readFileSync(path.join(DATA_DIR, 'assembly-patterns.json'), 'utf-8')
  return JSON.parse(raw) as AssemblyPatternsFile
}
