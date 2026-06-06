import { callMcpTool } from '../mcp/client'
import type { McpToolCall, PipelineAgentId, PipelineTraceEvent } from './types'
import {
  PIPELINE_AGENT_REGISTRY,
  PIPELINE_TOOL_REGISTRY,
  type PipelineToolKey,
} from './agent-registry'

type RuntimeOptions = {
  callMcp?: typeof callMcpTool
}

function traceId(type: PipelineTraceEvent['type'], agent: PipelineAgentId, index: number) {
  return `${type}-${agent}-${index}`
}

function summarize(value: unknown): string {
  if (typeof value === 'string') return value.slice(0, 220)
  try {
    return JSON.stringify(value).slice(0, 220)
  } catch {
    return String(value).slice(0, 220)
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function createAgentRuntime(options: RuntimeOptions = {}) {
  const trace: PipelineTraceEvent[] = []
  const mcpToolCalls: McpToolCall[] = []
  const mcp = options.callMcp ?? callMcpTool

  function push(event: Omit<PipelineTraceEvent, 'id' | 'timestamp'>) {
    trace.push({
      id: traceId(event.type, event.agent, trace.length + 1),
      timestamp: new Date().toISOString(),
      ...event,
    })
  }

  function assertAllowed(agent: PipelineAgentId, toolKey: PipelineToolKey) {
    const definition = PIPELINE_AGENT_REGISTRY[agent]
    if (!definition.allowedTools.includes(toolKey)) {
      throw new Error(`${agent} is not allowed to call ${toolKey}`)
    }
  }

  async function runAgent<T>(
    agent: PipelineAgentId,
    task: string,
    fn: () => T | Promise<T>
  ): Promise<T> {
    const definition = PIPELINE_AGENT_REGISTRY[agent]
    push({
      type: 'agent.started',
      agent,
      title: definition.title,
      inputSummary: task,
    })
    try {
      const result = await fn()
      push({
        type: 'agent.completed',
        agent,
        title: definition.title,
        outputSummary: summarize(result),
      })
      return result
    } catch (error) {
      push({
        type: 'agent.failed',
        agent,
        title: definition.title,
        error: errorMessage(error),
      })
      throw error
    }
  }

  async function callMcpWithFallback<T>(
    agent: PipelineAgentId,
    toolKey: PipelineToolKey,
    args: Record<string, unknown>,
    fallback: () => T | Promise<T>
  ): Promise<T> {
    assertAllowed(agent, toolKey)
    const tool = PIPELINE_TOOL_REGISTRY[toolKey]
    push({
      type: 'tool.started',
      agent,
      title: tool.title,
      tool: tool.tool,
      server: tool.server,
      inputSummary: summarize(args),
    })

    try {
      const result = (await mcp(tool.server, tool.tool, args)) as T
      mcpToolCalls.push({
        agent,
        server: tool.server,
        tool: tool.tool,
        title: tool.title,
        status: 'ok',
      })
      push({
        type: 'tool.completed',
        agent,
        title: tool.title,
        tool: tool.tool,
        server: tool.server,
        outputSummary: summarize(result),
      })
      return result
    } catch (error) {
      const result = await fallback()
      mcpToolCalls.push({
        agent,
        server: tool.server,
        tool: tool.tool,
        title: tool.title,
        status: 'fallback',
      })
      push({
        type: 'tool.fallback',
        agent,
        title: tool.title,
        tool: tool.tool,
        server: tool.server,
        error: errorMessage(error),
        outputSummary: summarize(result),
      })
      return result
    }
  }

  async function callMcpRequired<T>(
    agent: PipelineAgentId,
    toolKey: PipelineToolKey,
    args: Record<string, unknown>
  ): Promise<T> {
    assertAllowed(agent, toolKey)
    const tool = PIPELINE_TOOL_REGISTRY[toolKey]
    push({
      type: 'tool.started',
      agent,
      title: tool.title,
      tool: tool.tool,
      server: tool.server,
      inputSummary: summarize(args),
    })

    try {
      const result = (await mcp(tool.server, tool.tool, args)) as T
      mcpToolCalls.push({
        agent,
        server: tool.server,
        tool: tool.tool,
        title: tool.title,
        status: 'ok',
      })
      push({
        type: 'tool.completed',
        agent,
        title: tool.title,
        tool: tool.tool,
        server: tool.server,
        outputSummary: summarize(result),
      })
      return result
    } catch (error) {
      push({
        type: 'tool.failed',
        agent,
        title: tool.title,
        tool: tool.tool,
        server: tool.server,
        error: errorMessage(error),
      })
      throw error
    }
  }

  return {
    trace,
    mcpToolCalls,
    runAgent,
    callMcpWithFallback,
    callMcpRequired,
  }
}
