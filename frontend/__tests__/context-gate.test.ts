import { describe, expect, it } from 'vitest'
import { evaluateContextGate, normalizeContextGateResult } from '../lib/context-gate'

describe('context gate', () => {
  it('asks clarification questions before generation when the prompt is vague', () => {
    const result = evaluateContextGate('I need a sensor for a building')

    expect(result.status).toBe('needs_input')
    expect(result.questions.length).toBeGreaterThan(0)
    expect(result.questions.length).toBeLessThanOrEqual(3)
    expect(result.missingFields).toContain('city')
    expect(result.missingFields).toContain('surface')
    expect(result.confidence).toBeLessThan(0.7)
  })

  it('allows generation when the deployment context is specific enough', () => {
    const result = evaluateContextGate(
      'A Hong Kong outdoor facade node for an old residential building should monitor cracks and moisture. It must use battery power, LoRa connectivity, and no camera.'
    )

    expect(result.status).toBe('ready')
    expect(result.questions).toEqual([])
    expect(result.canonicalPrompt).toContain('Hong Kong')
    expect(result.confidence).toBeGreaterThanOrEqual(0.7)
  })

  it('recognizes accented deployment vocabulary in follow-up context', () => {
    const first = evaluateContextGate('I need a sensor for a building')
    const result = evaluateContextGate(
      `${first.canonicalPrompt}\n\nAdditional context from user:\nHong Kong residential building façade. Mounted on the façade, it detects cracks and moisture. Battery powered, LoRa, no camera.`
    )

    expect(result.status).toBe('ready')
    expect(result.missingFields).toEqual([])
    expect(result.questions).toEqual([])
  })

  it('does not downgrade a ready LLM response because optional fields are still missing', () => {
    const result = normalizeContextGateResult(
      {
        status: 'ready',
        canonicalPrompt:
          'Hong Kong residential building facade node mounted on the facade to detect cracks and moisture.',
        missingFields: ['power', 'connectivity', 'privacy'],
        questions: [],
        confidence: 0.91,
        source: 'llm',
      },
      'Need a facade node for a Hong Kong residential building to detect cracks and moisture.'
    )

    expect(result.status).toBe('ready')
    expect(result.missingFields).toEqual([])
    expect(result.questions).toEqual([])
    expect(result.source).toBe('llm')
  })

  it('canonicalizes LLM field aliases before deciding whether context is missing', () => {
    const result = normalizeContextGateResult(
      {
        status: 'needs_input',
        canonicalPrompt: 'Need a smart-city node',
        missingFields: [],
        questions: [
          { id: 'site_type', question: 'What type of site is this?' },
          { id: 'mounting_surface', question: 'Where is it mounted?' },
          { id: 'measured_signal', question: 'What should it measure?' },
        ],
        confidence: 0.32,
        source: 'llm',
      },
      'Need a smart-city node'
    )

    expect(result.status).toBe('needs_input')
    expect(result.questions.map((question) => question.id)).toEqual(['site', 'surface', 'goal'])
    expect(result.missingFields).toEqual(expect.arrayContaining(['site', 'surface', 'goal']))
  })

  it('does not let an over-cautious LLM block a prompt that already has the required context', () => {
    const prompt =
      'A 52-year-old Hong Kong residential building needs a low-maintenance facade sensor node that monitors crack propagation, vibration anomalies, tilt shifts and moisture ingress, and creates early warnings before the next Mandatory Building Inspection.'
    const result = normalizeContextGateResult(
      {
        status: 'needs_input',
        canonicalPrompt:
          'Please provide the deployment context for the facade sensor node by specifying the city or jurisdiction, site type, mounting surface, and device goal/measured signals.',
        missingFields: ['site', 'surface', 'city'],
        questions: [
          { id: 'city', question: 'What is the specific city or jurisdiction where the building is located?' },
          { id: 'sitetype', question: 'What type of site is the building?' },
          { id: 'mountingsurface', question: 'What is the surface or material where the sensor will be mounted?' },
        ],
        confidence: 0,
        source: 'llm',
      },
      prompt
    )

    expect(result.status).toBe('ready')
    expect(result.missingFields).toEqual([])
    expect(result.questions).toEqual([])
    expect(result.canonicalPrompt).toContain('Hong Kong residential building')
    expect(result.confidence).toBeGreaterThanOrEqual(0.7)
    expect(result.source).toBe('llm')
  })

  it('uses smart-city defaults when the user delegates missing context choices', () => {
    const prompt = 'I need a sensor for a building\n\nAdditional context from user:\njsp fait comme tu veux'
    const result = evaluateContextGate(prompt)

    expect(result.status).toBe('ready')
    expect(result.questions).toEqual([])
    expect(result.missingFields).toEqual([])
    expect(result.canonicalPrompt).toContain('Hong Kong')
    expect(result.canonicalPrompt).toContain('residential high-rise')
    expect(result.canonicalPrompt).toContain('facade')
  })

  it('does not let the LLM repeat questions after the user delegates missing context choices', () => {
    const prompt = 'I need a sensor for a building\n\nAdditional context from user:\njsp fait comme tu veux'
    const result = normalizeContextGateResult(
      {
        status: 'needs_input',
        canonicalPrompt:
          'Please provide the city or jurisdiction, site type, mounting surface, and device goal.',
        missingFields: ['city', 'site', 'surface', 'goal'],
        questions: [
          { id: 'cityjurisdiction', question: 'What is the city or jurisdiction?' },
          { id: 'site', question: 'What is the site type?' },
          { id: 'surface', question: 'What is the mounting surface?' },
        ],
        confidence: 0.2,
        source: 'llm',
      },
      prompt
    )

    expect(result.status).toBe('ready')
    expect(result.questions).toEqual([])
    expect(result.canonicalPrompt).toContain('Hong Kong')
    expect(result.source).toBe('llm')
  })
})
