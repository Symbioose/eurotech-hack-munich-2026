'use client'
import { use, useCallback, useEffect, useRef } from 'react'
import { Header } from '@/components/ui/Header'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { LeftPanel } from '@/components/left/LeftPanel'
import { CenterPanel } from '@/components/center/CenterPanel'
import { RightPanel } from '@/components/right/RightPanel'
import { useProjectStore } from '@/lib/store'
import {
  loadDemoProjectInStore,
  markProjectComplete,
  runPipelineInStore,
} from '@/lib/pipeline-client'
import { applyWorldModelFixApi } from '@/lib/pipeline-stream'
import { hydrateStoreFromPipeline } from '@/lib/pipeline/hydrate-store'
import { DEMO_PROJECT_ID } from '@/lib/demo-project'
import { startWorldModelSimulation } from '@/lib/world-model-simulation'
import type { PipelineState } from '@/lib/pipeline/types'
import type { WorldModelVerdict } from '@/lib/types'

export default function ProjectWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params)
  const projectTitle = useProjectStore((s) => s.projectTitle)
  const pipelineStage = useProjectStore((s) => s.pipelineStage)
  const startedRef = useRef<string | null>(null)

  useEffect(() => {
    const pending = sessionStorage.getItem(`pc_prompt_${projectId}`)
    if (startedRef.current === projectId) return

    if (pending) {
      startedRef.current = projectId
      sessionStorage.removeItem(`pc_prompt_${projectId}`)

      runPipelineInStore(pending).then(() => {
        markProjectComplete(projectId)
      })
      return
    }

    if (projectId === DEMO_PROJECT_ID) {
      startedRef.current = projectId
      loadDemoProjectInStore().then(() => {
        markProjectComplete(projectId)
      })
    }
  }, [projectId])

  useEffect(() => {
    if (pipelineStage === 'complete') {
      markProjectComplete(projectId)
    }
  }, [pipelineStage, projectId])

  useEffect(() => {
    function handleChatAction(event: Event) {
      const action = (event as CustomEvent<{ action?: string }>).detail?.action
      if (action === 'run-simulation') {
        startWorldModelSimulation()
      }
      if (action === 'apply-world-model-fix') {
        const verdict = (event as CustomEvent<{ verdict?: WorldModelVerdict }>).detail?.verdict
        const pipelineState = useProjectStore.getState().pipelineState
        if (!verdict || !pipelineState) return
        const startedAt = Date.now()
        const toolCallId = `world-model-fix-${verdict.id}`
        useProjectStore.getState().upsertToolCallMessage({
          id: toolCallId,
          server: 'world_model_backend',
          tool: 'POST /apply-fix',
          title: 'Apply world-model resilience fix',
          status: 'running',
          input: verdict.recommendedAction.label,
          startedAt,
        })
        applyWorldModelFixApi(pipelineState, verdict)
          .then((updated) => {
            hydrateStoreFromPipeline(updated as PipelineState)
            useProjectStore.getState().upsertToolCallMessage({
              id: toolCallId,
              server: 'world_model_backend',
              tool: 'POST /apply-fix',
              title: 'Apply world-model resilience fix',
              status: 'completed',
              output: 'Pipeline re-resolved after world-model fix.',
              startedAt,
              completedAt: Date.now(),
            })
            useProjectStore.getState().addMessage({
              id: `world-model-rerun-${Date.now()}`,
              type: 'action-button',
              content: 'Resilience fix applied. Run the world-model simulation again to compare field risk.',
              timestamp: Date.now(),
              actionLabel: 'Run Simulation Again',
              actionCallback: 'run-simulation',
            })
          })
          .catch((error: Error) => {
            useProjectStore.getState().upsertToolCallMessage({
              id: toolCallId,
              server: 'world_model_backend',
              tool: 'POST /apply-fix',
              title: 'Apply world-model resilience fix',
              status: 'error',
              output: error.message,
              startedAt,
              completedAt: Date.now(),
            })
          })
      }
    }

    window.addEventListener('physical-cursor:chat-action', handleChatAction)
    return () => window.removeEventListener('physical-cursor:chat-action', handleChatAction)
  }, [])

  const handleSend = useCallback(async (content: string, files?: File[]) => {
    await runPipelineInStore(content, files)
    markProjectComplete(projectId)
  }, [projectId])

  return (
    <div className="flex flex-col h-screen">
      <Header projectTitle={projectTitle || undefined} />
      <div className="flex flex-1 gap-2 p-2 overflow-hidden">
        <LeftPanel />
        <CenterPanel />
        <RightPanel onSend={handleSend} />
      </div>
      <ProgressBar />
    </div>
  )
}
