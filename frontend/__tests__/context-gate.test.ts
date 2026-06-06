import { describe, expect, it } from 'vitest'
import { evaluateContextGate } from '../lib/context-gate'

describe('context gate', () => {
  it('asks clarification questions before generation when the prompt is vague', () => {
    const result = evaluateContextGate('I need a sensor for a building')

    expect(result.status).toBe('needs_input')
    expect(result.questions.length).toBeGreaterThan(0)
    expect(result.questions.length).toBeLessThanOrEqual(3)
    expect(result.missingFields).toContain('city')
    expect(result.missingFields).toContain('surface')
  })

  it('allows generation when the deployment context is specific enough', () => {
    const result = evaluateContextGate(
      'A Hong Kong outdoor facade node for an old residential building should monitor cracks and moisture. It must use battery power, LoRa connectivity, and no camera.'
    )

    expect(result.status).toBe('ready')
    expect(result.questions).toEqual([])
    expect(result.canonicalPrompt).toContain('Hong Kong')
  })
})
