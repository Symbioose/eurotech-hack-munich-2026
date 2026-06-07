import { describe, it, expect } from 'vitest'
import { buildSystemPrompt, parseEvents } from '../app/api/chat/helpers'

describe('buildSystemPrompt', () => {
  it('does not let the legacy chat route generate hardware artifacts', () => {
    const prompt = buildSystemPrompt()
    expect(prompt).toContain('legacy chat endpoint')
    expect(prompt).toContain('/api/pipeline/generate')
    expect(prompt).not.toContain('BuildGuard')
    expect(prompt).not.toContain('8–12 real components')
    expect(prompt).not.toContain('GBA supplier route')
  })
})

describe('parseEvents', () => {
  it('emits context event when deployment context appears', () => {
    const text = 'Deployment context extracted: city Hong Kong'
    const events = parseEvents(text)
    expect(events.some((e) => e.type === 'context')).toBe(true)
  })

  it('emits node event when 3D node generation appears', () => {
    const text = 'Generating 3D scene graph...'
    const events = parseEvents(text)
    expect(events.some((e) => e.type === 'node')).toBe(true)
  })

  it('emits warning event when risk detected', () => {
    const text = 'Risk detected: IP_INSUFFICIENT weatherproofing issue'
    const events = parseEvents(text)
    expect(events.some((e) => e.type === 'warning')).toBe(true)
  })
})
