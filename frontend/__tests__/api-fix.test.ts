import { describe, it, expect } from 'vitest'
import { getFixForWarning } from '../app/api/fix/helpers'

describe('getFixForWarning', () => {
  it('returns fix data for IP_INSUFFICIENT', () => {
    const fix = getFixForWarning('IP_INSUFFICIENT')
    expect(fix).not.toBeNull()
    expect(fix!.costDelta).toBe(14)
    expect(fix!.bomChanges).toHaveLength(3)
    expect(fix!.rfqQuestionsAdded.length).toBeGreaterThan(0)
  })

  it('returns null for unknown warning id', () => {
    expect(getFixForWarning('UNKNOWN_WARNING')).toBeNull()
  })
})
