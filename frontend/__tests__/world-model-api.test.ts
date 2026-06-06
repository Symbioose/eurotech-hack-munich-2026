import { describe, expect, test, vi } from 'vitest'
import { POST as ANALYZE } from '@/app/api/world-model/analyze/route'
import { POST as APPLY_FIX } from '@/app/api/world-model/apply-fix/route'
import { applyComponentEdit } from '@/lib/pipeline/orchestrator'

vi.mock('@/lib/pipeline/orchestrator', () => ({
  applyPipelineFix: vi.fn(async (state, warningId) => ({
    ...state,
    fixApplied: true,
    appliedWarningId: warningId,
    pipelineStatus: 'complete',
  })),
  applyComponentEdit: vi.fn(async (state, editOps) => ({
    ...state,
    extraComponents: editOps.map((edit) => edit.component),
    pipelineStatus: 'complete',
  })),
}))

describe('/api/world-model/analyze', () => {
  test('rejects missing payload', async () => {
    const res = await ANALYZE(new Request('http://localhost/api/world-model/analyze', {
      method: 'POST',
      body: JSON.stringify({}),
    }))

    expect(res.status).toBe(400)
  })
})

describe('/api/world-model/apply-fix', () => {
  test('rejects missing verdict or pipeline state', async () => {
    const res = await APPLY_FIX(new Request('http://localhost/api/world-model/apply-fix', {
      method: 'POST',
      body: JSON.stringify({}),
    }))

    expect(res.status).toBe(400)
  })

  test('marks component-edit resilience fixes as applied', async () => {
    const res = await APPLY_FIX(new Request('http://localhost/api/world-model/apply-fix', {
      method: 'POST',
      body: JSON.stringify({
        pipelineState: {
          fixApplied: false,
          appliedWarningId: null,
        },
        verdict: {
          failureMode: 'thermal_stress',
          recommendedAction: {
            kind: 'component_edit',
            label: 'Add thermal isolation',
            editOps: [{
              op: 'add',
              component: {
                part: 'Thermal isolation pad and heat spreader',
                category: 'thermal',
                estimated_cost_usd: 5,
              },
            }],
            explanation: 'Reduce thermal stress.',
          },
        },
      }),
    }))
    const body = await res.json()

    expect(applyComponentEdit).toHaveBeenCalled()
    expect(body.fixApplied).toBe(true)
    expect(body.appliedWarningId).toBe('WORLD_MODEL_THERMAL_STRESS')
  })
})
