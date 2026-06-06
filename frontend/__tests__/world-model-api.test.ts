import { describe, expect, test } from 'vitest'
import { POST as ANALYZE } from '@/app/api/world-model/analyze/route'
import { POST as APPLY_FIX } from '@/app/api/world-model/apply-fix/route'

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
})
