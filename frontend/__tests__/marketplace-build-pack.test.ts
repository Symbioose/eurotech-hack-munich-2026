import { describe, expect, it } from 'vitest'
import { deriveBuildPack } from '../lib/marketplace/build-pack'
import type { BOMRow, GbaRouteDisplayStep, SimulationWarning } from '../lib/types'

const route: GbaRouteDisplayStep[] = [
  {
    step: 1,
    role: 'PCB & electronics',
    region: 'Regional',
    description: 'PCB, sensors and controller',
    suppliers: [{ name: 'PCB Partner', city: 'Regional', scope: 'SMT assembly' }],
  },
]

function row(patch: Partial<BOMRow> & Pick<BOMRow, 'id' | 'part' | 'cost'>): BOMRow {
  return {
    supplierRoute: 'Shenzhen electronics',
    componentId: patch.id,
    sourceStatus: 'seeded',
    offers: [],
    ...patch,
  }
}

describe('deriveBuildPack', () => {
  it('groups BOM rows, selects the cheapest buyable offer, and summarizes readiness', () => {
    const bom: BOMRow[] = [
      row({
        id: 'imu',
        part: 'Vibration / IMU sensor',
        cost: 18,
        mpn: 'BMI270',
        manufacturer: 'Bosch Sensortec',
        offers: [
          {
            distributor: 'Digi-Key',
            region: 'US / Global',
            unitPrice: 20.16,
            moq: 1,
            stock: null,
            url: 'https://www.digikey.com/en/products/result?keywords=BMI270',
            verified: false,
          },
          {
            distributor: 'LCSC',
            region: 'CN / Greater Bay Area',
            unitPrice: 15.3,
            moq: 5,
            stock: null,
            url: 'https://www.lcsc.com/search?q=BMI270',
            verified: false,
          },
        ],
      }),
      row({
        id: 'enclosure',
        part: 'Weatherproof enclosure',
        supplierRoute: 'Dongguan enclosure/plastics',
        cost: 28,
        sourceStatus: 'candidate',
      }),
    ]

    const pack = deriveBuildPack({
      projectId: 'demo',
      projectTitle: 'Facade sensor node',
      bom,
      bomTotal: 46,
      baselineBomTotal: 42,
      fixApplied: true,
      activeWarning: null,
      supplierRoute: route,
      rfqQuestions: ['What IP rating can you certify?'],
      sourceRefresh: { status: 'idle', message: 'Seeded sources' },
    })

    expect(pack.title).toBe('Facade sensor node')
    expect(pack.summary.totalCost).toBe(46)
    expect(pack.summary.partCount).toBe(2)
    expect(pack.summary.buyableCount).toBe(1)
    expect(pack.summary.unverifiedCount).toBe(1)
    expect(pack.summary.readinessScore).toBeGreaterThanOrEqual(65)
    expect(pack.summary.readinessScore).toBeLessThan(100)
    expect(pack.groups.map((group) => group.label)).toEqual(['Sensors', 'Enclosure & Mechanical'])
    expect(pack.groups[0].items[0].bestOffer?.distributor).toBe('LCSC')
    expect(pack.actions.buyParts.enabled).toBe(true)
    expect(pack.actions.sendRfq.enabled).toBe(true)
    expect(pack.actions.refreshSourcing.enabled).toBe(true)
    expect(pack.warnings.some((warning) => warning.kind === 'source')).toBe(true)
  })

  it('penalizes missing offers and active critical warnings without inventing sourcing', () => {
    const activeWarning: SimulationWarning = {
      id: 'ip-risk',
      category: 'environmental',
      severity: 'critical',
      title: 'Insufficient ingress protection',
      explanation: 'The enclosure needs a seal fix.',
      affectedComponents: ['enclosure'],
      fix: {
        label: 'Add gasket and membrane',
        componentChanges: [],
        bomChanges: [],
        costDelta: 11,
        rfqQuestionsAdded: [],
      },
    }

    const pack = deriveBuildPack({
      projectId: 'demo',
      projectTitle: '',
      bom: [row({ id: 'battery', part: 'Battery module', cost: 24, sourceStatus: 'error' })],
      bomTotal: 24,
      baselineBomTotal: 24,
      fixApplied: false,
      activeWarning,
      supplierRoute: [],
      rfqQuestions: [],
      sourceRefresh: { status: 'not_configured', message: 'Tavily key not configured' },
    })

    expect(pack.title).toBe('Hardware Build Pack')
    expect(pack.summary.buyableCount).toBe(0)
    expect(pack.summary.unverifiedCount).toBe(1)
    expect(pack.summary.readinessScore).toBeLessThan(55)
    expect(pack.actions.buyParts.enabled).toBe(false)
    expect(pack.actions.sendRfq.enabled).toBe(false)
    expect(pack.actions.refreshSourcing.label).toBe('Configure sourcing')
    expect(pack.warnings.map((warning) => warning.kind)).toContain('dfma')
    expect(pack.warnings.map((warning) => warning.kind)).toContain('offer')
  })
})
