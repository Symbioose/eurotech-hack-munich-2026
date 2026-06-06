'use client'
import { use, useCallback, useEffect, useRef } from 'react'
import { Header } from '@/components/ui/Header'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { LeftPanel } from '@/components/left/LeftPanel'
import { CenterPanel } from '@/components/center/CenterPanel'
import { RightPanel } from '@/components/right/RightPanel'
import { useProjectStore } from '@/lib/store'
import { exportReadinessPack } from '@/lib/export'
import {
  loadDemoProjectInStore,
  markProjectComplete,
  runPipelineInStore,
} from '@/lib/pipeline-client'
import { DEMO_PROJECT_ID } from '@/lib/demo-project'
import { startWorldModelSimulation } from '@/lib/world-model-simulation'

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
    }

    window.addEventListener('physical-cursor:chat-action', handleChatAction)
    return () => window.removeEventListener('physical-cursor:chat-action', handleChatAction)
  }, [])

  function handleExport() {
    const { contextFields, bom, activeWarning, rfqQuestions, gbaRoute, projectTitle: title } =
      useProjectStore.getState()
    exportReadinessPack({
      projectTitle: title,
      contextFields,
      bom,
      warningTitle: activeWarning?.title ?? '',
      fixLabel: activeWarning?.fix.label ?? '',
      gbaRoute,
      rfqQuestions,
    })
  }

  const handleSend = useCallback(async (content: string, files?: File[]) => {
    await runPipelineInStore(content, files)
    markProjectComplete(projectId)
  }, [projectId])

  return (
    <div className="flex flex-col h-screen">
      <Header projectTitle={projectTitle || undefined} onExport={handleExport} />
      <div className="flex flex-1 gap-2 p-2 overflow-hidden">
        <LeftPanel />
        <CenterPanel />
        <RightPanel onSend={handleSend} />
      </div>
      <ProgressBar />
    </div>
  )
}
