import { describe, it, expect } from 'vitest'
import { getFixForWarning } from '../app/api/fix/helpers'

const PROMPT =
  'A 52-year-old Hong Kong residential building facade sensor node monitors crack propagation and moisture ingress outdoors.'

describe('getFixForWarning', () => {
  it('returns fix data from DFMA rules + catalog for IP_INSUFFICIENT', () => {
    const fix = getFixForWarning('IP_INSUFFICIENT', PROMPT)
    expect(fix).not.toBeNull()
    expect(fix!.costDelta).toBeGreaterThan(0)
    expect(fix!.bomChanges.length).toBeGreaterThan(0)
  })

  it('returns null for unknown warning id', () => {
    expect(getFixForWarning('UNKNOWN_WARNING', PROMPT)).toBeNull()
  })
})
