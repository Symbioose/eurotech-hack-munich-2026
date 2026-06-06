import { describe, it, expect, beforeEach } from 'vitest'
import { useProjectStore } from '../lib/store'

describe('ProjectStore', () => {
  beforeEach(() => {
    useProjectStore.setState(useProjectStore.getInitialState())
  })

  it('starts with empty messages and empty BOM', () => {
    expect(useProjectStore.getState().messages).toEqual([])
    expect(useProjectStore.getState().bom).toEqual([])
  })

  it('addMessage appends a message', () => {
    useProjectStore.getState().addMessage({ id: '1', type: 'user', content: 'hello', timestamp: 0 })
    expect(useProjectStore.getState().messages).toHaveLength(1)
  })

  it('upsertToolCallMessage updates a tool call without duplicating it', () => {
    useProjectStore.getState().upsertToolCallMessage({
      id: 'run-1-context',
      server: 'orchestrator',
      tool: 'extract_context',
      title: 'Read deployment context',
      status: 'running',
      input: 'MTR station humidity sensor',
      startedAt: 100,
    })

    useProjectStore.getState().upsertToolCallMessage({
      id: 'run-1-context',
      server: 'orchestrator',
      tool: 'extract_context',
      title: 'Read deployment context',
      status: 'completed',
      output: 'city: Hong Kong',
      startedAt: 200,
      completedAt: 300,
    })

    const messages = useProjectStore.getState().messages
    expect(messages).toHaveLength(1)
    expect(messages[0].toolCall?.status).toBe('completed')
    expect(messages[0].toolCall?.input).toBe('MTR station humidity sensor')
    expect(messages[0].toolCall?.startedAt).toBe(100)
  })

  it('setViewMode updates viewMode', () => {
    useProjectStore.getState().setViewMode('xray')
    expect(useProjectStore.getState().viewMode).toBe('xray')
  })

  it('setHighlightedComponent updates highlightedComponentId', () => {
    useProjectStore.getState().setHighlightedComponent('crack-sensor')
    expect(useProjectStore.getState().highlightedComponentId).toBe('crack-sensor')
  })

  it('setFixApplied updates fixApplied', () => {
    useProjectStore.getState().setFixApplied(true)
    expect(useProjectStore.getState().fixApplied).toBe(true)
  })

  it('setDemoStep updates currentStep', () => {
    useProjectStore.getState().setDemoStep(3)
    expect(useProjectStore.getState().currentStep).toBe(3)
  })
})
