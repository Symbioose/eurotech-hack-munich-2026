import type { ChatMessage, ConversationState, PipelineStageName, SourceRefreshState } from './types'
import type { PipelineState } from './pipeline/types'
import { hydrateStoreFromPipeline } from './pipeline/hydrate-store'
import { useProjectStore } from './store'

const PROJECT_STATE_PREFIX = 'pc_project_state_'

type ProjectSnapshot = {
  pipelineState: PipelineState
  messages: ChatMessage[]
  sourceRefresh: SourceRefreshState
  conversationState: ConversationState
  pipelineStage: PipelineStageName
  savedAt: number
}

function key(projectId: string) {
  return `${PROJECT_STATE_PREFIX}${projectId}`
}

export function saveCurrentProjectSnapshot(projectId: string) {
  if (typeof window === 'undefined') return
  const store = useProjectStore.getState()
  if (!store.pipelineState) return

  const snapshot: ProjectSnapshot = {
    pipelineState: store.pipelineState,
    messages: store.messages,
    sourceRefresh: store.sourceRefresh,
    conversationState: store.conversationState,
    pipelineStage: store.pipelineStage,
    savedAt: Date.now(),
  }

  localStorage.setItem(key(projectId), JSON.stringify(snapshot))
}

export function restoreProjectSnapshot(projectId: string): boolean {
  if (typeof window === 'undefined') return false
  const raw = localStorage.getItem(key(projectId))
  if (!raw) return false

  try {
    const snapshot = JSON.parse(raw) as ProjectSnapshot
    if (!snapshot.pipelineState) return false

    const store = useProjectStore.getState()
    store.reset()
    hydrateStoreFromPipeline(snapshot.pipelineState)
    store.setMessages(snapshot.messages ?? [])
    store.setSourceRefresh(snapshot.sourceRefresh ?? { status: 'idle', message: 'Seeded sources' })
    store.setConversationState(snapshot.conversationState ?? 'complete')
    store.setPipelineStage(snapshot.pipelineStage ?? 'complete')
    store.setStreaming(false)
    return true
  } catch {
    return false
  }
}
