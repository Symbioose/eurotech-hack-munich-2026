import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ChatMessage } from '../components/right/ChatMessage'

describe('ChatMessage', () => {
  it('renders tool calls as compact inline chat rows', () => {
    const html = renderToString(
      <ChatMessage
        message={{
          id: 'tool-run-1',
          type: 'tool-call',
          content: '',
          timestamp: 100,
          toolCall: {
            id: 'run-1-compliance',
            server: 'compliance_mcp',
            tool: 'search_requirements',
            title: 'Check Hong Kong requirements',
            status: 'completed',
            input: 'Hong Kong outdoor sensor',
            output: '2 requirement(s) matched',
            startedAt: 100,
            completedAt: 1200,
          },
        }}
      />
    )

    expect(html).toContain('Check Hong Kong requirements')
    expect(html).toContain('compliance_mcp.search_requirements')
    expect(html).toContain('details')
    expect(html).toContain('2 requirement(s) matched')
  })
})
