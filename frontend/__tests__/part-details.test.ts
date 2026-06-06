import { describe, expect, it } from 'vitest'
import { getPartDetails } from '../lib/scene/part-details'

describe('part-details', () => {
  it('adds hardware-level visual details to the enclosure', () => {
    const details = getPartDetails('enclosure', [1.2, 1.6, 0.8]).map((detail) => detail.role)

    expect(details).toContain('front-panel')
    expect(details).toContain('screw-head')
    expect(details).toContain('vent-slot')
    expect(details).toContain('status-led')
  })

  it('adds chips and copper traces to compute boards', () => {
    const details = getPartDetails('compute', [0.7, 0.5, 0.05]).map((detail) => detail.role)

    expect(details).toContain('processor-chip')
    expect(details).toContain('radio-shield')
    expect(details).toContain('copper-trace')
  })

  it('adds product-specific details to power, mounting and fix parts', () => {
    expect(getPartDetails('battery', [0.8, 0.4, 0.3]).map((detail) => detail.role)).toContain('terminal')
    expect(getPartDetails('bracket', [1.4, 0.1, 0.6]).map((detail) => detail.role)).toContain('mounting-hole')
    expect(getPartDetails('solar', [0.9, 0.08, 0.45]).map((detail) => detail.role)).toContain('solar-cell')
    expect(getPartDetails('gasket', [0.55, 0.04, 0.55]).map((detail) => detail.role)).toContain('gasket-ring')
    expect(getPartDetails('fasteners', [0.9, 0.06, 0.6]).map((detail) => detail.role)).toContain('fastener-head')
  })
})
