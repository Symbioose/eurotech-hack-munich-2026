import { describe, expect, it } from 'vitest'
import { evaluateContextGate, normalizeContextGateResult } from '../lib/context-gate'

describe('context gate (product-agnostic)', () => {
  it('asks one open question when the prompt is too vague to design anything', () => {
    const result = evaluateContextGate('hello')

    expect(result.status).toBe('needs_input')
    expect(result.questions.length).toBeGreaterThan(0)
    expect(result.questions.length).toBeLessThanOrEqual(2)
    expect(result.missingFields).toContain('brief')
    expect(result.confidence).toBeLessThan(0.7)
  })

  it('is ready for any concrete product brief, not just smart-city sensors', () => {
    const result = evaluateContextGate(
      'A quiet desktop air purifier for a small office that filters dust and shows air quality.'
    )

    expect(result.status).toBe('ready')
    expect(result.questions).toEqual([])
    expect(result.missingFields).toEqual([])
    expect(result.confidence).toBeGreaterThanOrEqual(0.7)
  })

  it('still accepts the smart-city demo brief', () => {
    const result = evaluateContextGate(
      'A Hong Kong outdoor facade node for an old residential building should monitor cracks and moisture.'
    )

    expect(result.status).toBe('ready')
    expect(result.questions).toEqual([])
    expect(result.canonicalPrompt).toContain('Hong Kong')
    expect(result.confidence).toBeGreaterThanOrEqual(0.7)
  })

  it('does not downgrade a ready LLM response because optional fields are still missing', () => {
    const result = normalizeContextGateResult(
      {
        status: 'ready',
        canonicalPrompt: 'A robot vacuum that maps a flat and avoids cables.',
        missingFields: ['power', 'connectivity', 'budget'],
        questions: [],
        confidence: 0.91,
        source: 'llm',
      },
      'A robot vacuum that maps a flat and avoids cables.'
    )

    expect(result.status).toBe('ready')
    expect(result.missingFields).toEqual([])
    expect(result.questions).toEqual([])
    expect(result.source).toBe('llm')
  })

  it('canonicalizes LLM-provided question ids when it does need input', () => {
    const result = normalizeContextGateResult(
      {
        status: 'needs_input',
        canonicalPrompt: 'a device',
        missingFields: [],
        questions: [
          { id: 'Product Goal', question: 'What should the product do?' },
          { id: 'use-context', question: 'Where will it be used?' },
        ],
        confidence: 0.32,
        source: 'llm',
      },
      'a device'
    )

    expect(result.status).toBe('needs_input')
    expect(result.questions.map((question) => question.id)).toEqual(['product_goal', 'use_context'])
  })

  it('does not let an over-cautious LLM block a brief that already has substance', () => {
    const prompt =
      'A 52-year-old Hong Kong residential building needs a low-maintenance facade sensor node that monitors crack propagation, vibration anomalies, tilt shifts and moisture ingress.'
    const result = normalizeContextGateResult(
      {
        status: 'needs_input',
        canonicalPrompt: 'Please provide the city, site type, mounting surface, and device goal.',
        missingFields: ['site', 'surface', 'city'],
        questions: [
          { id: 'city', question: 'What is the specific city?' },
          { id: 'site', question: 'What type of site?' },
          { id: 'surface', question: 'What mounting surface?' },
        ],
        confidence: 0,
        source: 'llm',
      },
      prompt
    )

    expect(result.status).toBe('ready')
    expect(result.missingFields).toEqual([])
    expect(result.questions).toEqual([])
    expect(result.confidence).toBeGreaterThanOrEqual(0.7)
    expect(result.source).toBe('llm')
  })

  it('treats user delegation on top of a brief as ready without forcing any domain', () => {
    const prompt = 'I want a smart water bottle\n\nAdditional context from user:\njsp fais comme tu veux'
    const result = evaluateContextGate(prompt)

    expect(result.status).toBe('ready')
    expect(result.questions).toEqual([])
    expect(result.missingFields).toEqual([])
    // No hardcoded Hong Kong / facade default leaks in.
    expect(result.canonicalPrompt.toLowerCase()).not.toContain('hong kong')
    expect(result.canonicalPrompt).toContain('smart water bottle')
  })
})
