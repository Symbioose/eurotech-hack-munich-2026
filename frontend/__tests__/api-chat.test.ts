import { describe, it, expect } from 'vitest'
import { buildSystemPrompt, parseEvents } from '../app/api/chat/helpers'

describe('buildSystemPrompt', () => {
  it('includes deployment context instructions', () => {
    const prompt = buildSystemPrompt()
    expect(prompt).toContain('deployment context')
    expect(prompt).toContain('BuildGuard')
  })
})

describe('parseEvents', () => {
  it('emits context event when deployment context appears', () => {
    const text = 'Deployment context extracted: city Hong Kong'
    const events = parseEvents(text)
    expect(events.some((e) => e.type === 'context')).toBe(true)
  })

  it('emits node event when 3D node generation appears', () => {
    const text = 'Generating 3D BuildGuard Node...'
    const events = parseEvents(text)
    expect(events.some((e) => e.type === 'node')).toBe(true)
  })

  it('emits warning event when risk detected', () => {
    const text = 'Risk detected: IP_INSUFFICIENT weatherproofing issue'
    const events = parseEvents(text)
    expect(events.some((e) => e.type === 'warning')).toBe(true)
  })
})
