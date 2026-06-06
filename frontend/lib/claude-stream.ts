export async function streamChat(
  projectId: string,
  userMessage: string,
  fileNames: string[],
  onChunk: (type: string, data: unknown) => void,
  onDone: () => void
) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, message: userMessage, fileNames }),
  })

  if (!res.ok || !res.body) {
    onChunk('error', { message: 'Request failed' })
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
        onChunk(event.type, event.data)
      } catch {
        // malformed JSON, skip
      }
    }
  }
  // flush remaining buffer
  if (buffer.startsWith('data: ')) {
    try {
      const event = JSON.parse(buffer.slice(6))
      onChunk(event.type, event.data)
    } catch {}
  }
  onDone()
}
