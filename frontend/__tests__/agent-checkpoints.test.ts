import { describe, expect, it } from 'vitest'
import { formatRiskCheckpointMessage } from '../lib/agent-checkpoints'
import type { SimulationWarning } from '../lib/types'

describe('agent checkpoints', () => {
  it('turns a DfMA warning into a user decision prompt', () => {
    const warning: SimulationWarning = {
      id: 'IP_INSUFFICIENT',
      category: 'environmental',
      severity: 'critical',
      title: 'Outdoor sealing risk',
      explanation: 'The enclosure is not ready for typhoon rain.',
      affectedComponents: ['weatherproof-enclosure'],
      fix: {
        label: 'Add IP67 gasket',
        componentChanges: [],
        bomChanges: [],
        costDelta: 18,
        rfqQuestionsAdded: [],
      },
    }

    const message = formatRiskCheckpointMessage(warning)

    expect(message).toContain('stopped this build before it reaches manufacturing')
    expect(message).toContain('Outdoor sealing risk')
    expect(message).toContain('Add IP67 gasket')
    expect(message).toContain('tell me your constraint')
  })
})
