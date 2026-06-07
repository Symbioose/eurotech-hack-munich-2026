import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { ChatMessage } from '@/components/right/ChatMessage'
import type { ChatMessage as ChatMessageType } from '@/lib/types'

function verdictMessage(): ChatMessageType {
  return {
    id: 'wm-message',
    type: 'world-model-verdict',
    content: '',
    timestamp: 1,
    worldModelVerdict: {
      id: 'wm-1',
      severity: 'critical',
      scenario: 'catastrophic',
      fixed: false,
      failureMode: 'moisture_ingress',
      title: 'World Model blocked this design',
      summary: 'Moisture ingress cascade at week 38.',
      rootCause: 'Seal degradation allowed moisture propagation.',
      affectedComponents: ['enclosure'],
      evidence: {
        peakDeviceRisk: 0.74,
        peakWeek: 38,
        peakComponentId: 'enclosure',
        peakComponentRisk: 0.68,
        dominantFailureHead: 'moisture_ingress_prob',
        dominantFailureProbability: 0.66,
        triggerAction: 'humidity_soak',
      },
      recommendedAction: {
        kind: 'dfma_fix',
        label: 'Apply weatherproofing resilience fix',
        dfmaWarningId: 'IP_INSUFFICIENT',
        explanation: 'Maps to weatherproofing.',
      },
    },
  }
}

describe('WorldModelVerdictCard', () => {
  test('renders verdict evidence and action label', () => {
    render(<ChatMessage message={verdictMessage()} />)

    expect(screen.getByText('World Model blocked this design')).toBeInTheDocument()
    expect(screen.getByText(/Peak device risk: 74%/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Apply weatherproofing resilience fix/i })).toBeInTheDocument()
  })

  test('dispatches apply-world-model-fix action when clicked', async () => {
    const events: string[] = []
    window.addEventListener('manu:chat-action', (event) => {
      events.push((event as CustomEvent<{ action: string }>).detail.action)
    })

    render(<ChatMessage message={verdictMessage()} />)
    fireEvent.click(screen.getByRole('button', { name: /Apply weatherproofing resilience fix/i }))

    await waitFor(() => expect(events).toContain('apply-world-model-fix'))
  })
})
