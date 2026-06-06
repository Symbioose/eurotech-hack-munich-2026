import { streamPipeline } from '@/lib/pipeline-stream'
import { hydrateStoreFromPipeline, pipelineStageToDemoStep } from '@/lib/pipeline/hydrate-store'
import { primaryWarningToUI } from '@/lib/pipeline/to-ui'
import { useProjectStore } from '@/lib/store'
import type { PipelineState } from '@/lib/pipeline/types'
import type { PipelineStageName } from '@/lib/types'

let msgCounter = 0
function mkId() {
  return `msg-${++msgCounter}-${Date.now()}`
}

const STAGE_LABELS: Record<string, string> = {
  context: 'Context Agent — extracting deployment context…',
  components: 'Component Agent — selecting from catalog…',
  bom: 'BOM Resolver — looking up prices…',
  dfma: 'DFMA Engine — checking deployment risks…',
  rfq: 'RFQ Agent — building supplier route…',
  scene: 'Scene Resolver — mapping 3D layout…',
  complete: 'Pipeline complete.',
}

async function loadDeterministicFromApi(prompt: string): Promise<PipelineState> {
  const res = await fetch('/api/pipeline/fallback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  })
  return res.json() as Promise<PipelineState>
}

export async function runPipelineInStore(content: string, files?: File[]) {
  const store = useProjectStore.getState()
  if (!content.trim() && (!files || files.length === 0)) return

  if (files?.length) {
    files.forEach((f) => {
      store.addMessage({
        id: mkId(),
        type: 'file-upload',
        content: '',
        timestamp: Date.now(),
        fileName: f.name,
      })
    })
  }

  store.addMessage({ id: mkId(), type: 'user', content, timestamp: Date.now() })
  store.addMessage({ id: mkId(), type: 'ai', content: '', timestamp: Date.now() })
  store.setStreaming(true)
  store.setPipelineStage('context')
  store.setDemoStep(1)

  try {
    await streamPipeline(
      content,
      (type, data) => {
        const s = useProjectStore.getState()

        if (type.startsWith('stage:')) {
          const stage = type.replace('stage:', '')
          s.setPipelineStage(stage as PipelineStageName)

          const label = STAGE_LABELS[stage]
          if (label) {
            s.appendToLastMessage(`\n\n**${label}**`)
          }

          if (stage !== 'complete' && stage !== 'fallback') {
            s.setDemoStep(pipelineStageToDemoStep(stage))
          }

          if (stage === 'complete') {
            hydrateStoreFromPipeline(data as PipelineState)
            const warning = primaryWarningToUI(data as PipelineState)
            if (warning) {
              const hasWarning = s.messages.some((m) => m.type === 'warning-card')
              if (!hasWarning) {
                s.addMessage({
                  id: mkId(),
                  type: 'warning-card',
                  content: '',
                  timestamp: Date.now(),
                  warning,
                })
              }
            }
            s.setPipelineStage('complete')
          }

          if (stage === 'fallback') {
            s.setUsedDeterministic(true)
            s.appendToLastMessage('\n\n_[Switched to deterministic pipeline]_')
          }
        }
      },
      () => useProjectStore.getState().setStreaming(false)
    )
  } catch {
    const s = useProjectStore.getState()
    try {
      const deterministic = await loadDeterministicFromApi(content)
      hydrateStoreFromPipeline(deterministic)
      const warning = primaryWarningToUI(deterministic)
      if (warning) {
        s.addMessage({
          id: mkId(),
          type: 'warning-card',
          content: '',
          timestamp: Date.now(),
          warning,
        })
      }
      s.appendToLastMessage('\n\n_[Connection error — ran deterministic pipeline]_')
      s.setUsedDeterministic(true)
      s.setPipelineStage('complete')
      s.setDemoStep(7)
    } catch {
      s.appendToLastMessage('\n\n[Pipeline error]')
    }
    s.setStreaming(false)
  }
}

export function markProjectComplete(projectId: string) {
  try {
    const raw = localStorage.getItem('pc_projects')
    if (!raw) return
    const title = useProjectStore.getState().projectTitle
    const projects = JSON.parse(raw) as { id: string; status: string; title?: string }[]
    const updated = projects.map((p) =>
      p.id === projectId
        ? { ...p, status: 'complete', ...(title ? { title } : {}) }
        : p
    )
    localStorage.setItem('pc_projects', JSON.stringify(updated))
  } catch {
    // ignore
  }
}
