import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MarketplacePage } from '../components/marketplace/MarketplacePage'
import { useProjectStore } from '../lib/store'
import type { BOMRow, GbaRouteDisplayStep } from '../lib/types'

vi.mock('@/lib/export', () => ({
  exportReadinessPack: vi.fn(),
  exportBomCsv: vi.fn(),
  exportDesignJson: vi.fn(),
}))

const route: GbaRouteDisplayStep[] = [
  {
    step: 1,
    role: 'PCB assembly partner',
    region: 'Greater Bay Area',
    description: 'SMT, inspection and final electronics assembly.',
    suppliers: [{ name: 'Shenzhen EMS', city: 'Shenzhen', scope: 'SMT assembly' }],
  },
]

const bom: BOMRow[] = [
  {
    id: 'imu',
    componentId: 'imu-sensor',
    part: 'BMI270 vibration IMU sensor',
    supplierRoute: 'Shenzhen electronics',
    cost: 15.3,
    sourceStatus: 'seeded',
    manufacturer: 'Bosch Sensortec',
    mpn: 'BMI270',
    lifecycle: 'active',
    offers: [
      {
        distributor: 'LCSC',
        region: 'CN / Greater Bay Area',
        unitPrice: 15.3,
        moq: 5,
        stock: 1200,
        url: 'https://www.lcsc.com/search?q=BMI270',
        verified: true,
      },
    ],
  },
]

describe('MarketplacePage', () => {
  beforeEach(() => {
    useProjectStore.getState().reset()
    vi.clearAllMocks()
  })

  it('renders an empty state that links back to the workspace', () => {
    const html = renderToString(<MarketplacePage projectId="project-empty" />)

    expect(html).toContain('No Build Pack generated yet')
    expect(html).toContain('/project/project-empty/workspace')
  })

  it('renders a populated build pack marketplace from the project store', () => {
    const store = useProjectStore.getState()
    store.setProjectTitle('Facade Sensor Node')
    store.setBOM(bom)
    store.setBomTotal(15.3)
    store.setBaselineBomTotal(12)
    store.setRfqQuestions(['Can you confirm conformal coating lead time?'])
    store.setGbaRoute(route)

    const html = renderToString(<MarketplacePage projectId="project-populated" />)

    expect(html).toContain('Build Pack Marketplace')
    expect(html).toContain('Facade Sensor Node')
    expect(html).toContain('BMI270 vibration IMU sensor')
    expect(html).toContain('Buy Parts')
    expect(html).toContain('RFQ Pack')
    expect(html).toContain('PCB assembly partner')
  })
})
