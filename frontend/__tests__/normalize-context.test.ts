import { describe, it, expect } from 'vitest'
import { normalizeDeploymentContext } from '../lib/pipeline/normalize-context'
import type { DeploymentContext } from '../lib/pipeline/types'

const PROMPT =
  'A 52-year-old Hong Kong residential building needs a facade sensor node that monitors moisture outdoors.'

describe('normalizeDeploymentContext', () => {
  it('fills null surface from prompt parsing', () => {
    const raw = {
      city: 'Hong Kong',
      site: null,
      surface: null,
      regulation: null,
      environment: [],
      climate: { humidity: null, rainfall: null, wind: null },
      mounting: [],
      power: [],
      connectivity: [],
      privacy: [],
      goal: null,
    } as unknown as DeploymentContext

    const ctx = normalizeDeploymentContext(raw, PROMPT)
    expect(ctx.surface).toBeTruthy()
    expect(ctx.surface.toLowerCase()).toContain('facade')
    expect(ctx.site).toBeTruthy()
    expect(ctx.goal).toBeTruthy()
  })
})
