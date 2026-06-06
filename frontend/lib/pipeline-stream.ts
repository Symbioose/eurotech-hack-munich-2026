export async function streamPipeline(
  prompt: string,
  onEvent: (type: string, data: unknown) => void,
  onDone: () => void
) {
  const res = await fetch('/api/pipeline/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  })

  if (!res.ok || !res.body) {
    onEvent('error', { message: 'Pipeline request failed' })
    onDone()
    return
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      try {
        const event = JSON.parse(line.slice(6))
        onEvent(event.type, event.data)
      } catch {
        // skip malformed
      }
    }
  }

  if (buffer.startsWith('data: ')) {
    try {
      const event = JSON.parse(buffer.slice(6))
      onEvent(event.type, event.data)
    } catch {
      // skip
    }
  }

  onDone()
}

export async function applyPipelineFixApi(
  warningId: string,
  pipelineState: unknown
): Promise<unknown> {
  const res = await fetch('/api/pipeline/apply-fix', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ warningId, pipelineState }),
  })
  if (!res.ok) throw new Error('Apply fix failed')
  return res.json()
}

export async function classifyChatIntentApi(
  message: string,
  design: unknown
): Promise<unknown> {
  const res = await fetch('/api/chat/intent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, design }),
  })
  if (!res.ok) throw new Error('Intent classification failed')
  return res.json()
}

export async function applyEditApi(
  pipelineState: unknown,
  edits: unknown
): Promise<unknown> {
  const res = await fetch('/api/pipeline/edit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pipelineState, edits }),
  })
  if (!res.ok) throw new Error('Apply edit failed')
  return res.json()
}
