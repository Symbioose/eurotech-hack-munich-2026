import path from 'path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

export type McpServerName = 'compliance' | 'hardware' | 'supplier' | 'scene' | 'sourceResearch'

const SERVER_SCRIPT: Record<McpServerName, string> = {
  compliance: 'compliance-server.mjs',
  hardware: 'hardware-server.mjs',
  supplier: 'supplier-server.mjs',
  scene: 'scene-server.mjs',
  sourceResearch: 'source-research-server.mjs',
}

function parseToolResult(result: unknown): unknown {
  const maybe = result as {
    structuredContent?: unknown
    content?: { type: string; text?: string }[]
  }

  if (maybe.structuredContent) return maybe.structuredContent

  const text = maybe.content?.find((item) => item.type === 'text')?.text
  if (!text) return result
  return JSON.parse(text)
}

export async function callMcpTool(
  serverName: McpServerName,
  toolName: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const client = new Client({ name: 'physical-cursor-next-client', version: '1.0.0' })
  const transport = new StdioClientTransport({
    command: 'node',
    args: [path.join(process.cwd(), 'mcp', SERVER_SCRIPT[serverName])],
    cwd: process.cwd(),
    stderr: 'pipe',
  })

  await client.connect(transport)
  try {
    const result = await client.callTool({ name: toolName, arguments: args })
    return parseToolResult(result)
  } finally {
    await client.close()
  }
}
