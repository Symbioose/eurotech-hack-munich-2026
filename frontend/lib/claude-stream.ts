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

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const lines = decoder.decode(value).split('\n')
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      try {
        const event = JSON.parse(line.slice(6))
        onChunk(event.type, event.data)
      } catch {
        // partial chunk, ignore
      }
    }
  }
  onDone()
}
