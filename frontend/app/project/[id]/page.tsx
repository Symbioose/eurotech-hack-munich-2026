'use client'
import { useCallback } from 'react'
import { Header } from '@/components/ui/Header'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { LeftPanel } from '@/components/left/LeftPanel'
import { CenterPanel } from '@/components/center/CenterPanel'
import { RightPanel } from '@/components/right/RightPanel'
import { useProjectStore } from '@/lib/store'
import { streamChat } from '@/lib/claude-stream'
import { DEPLOYMENT_CONTEXT, MOCK_WARNING, RFQ_QUESTIONS_BASE, GBA_ROUTE_STOPS } from '@/lib/buildguard-data'
import { exportReadinessPack } from '@/lib/export'
import { SUPPLIERS } from '@/lib/suppliers-data'
import type { ChatMessage } from '@/lib/types'

let msgCounter = 0
function mkId() { return `msg-${++msgCounter}-${Date.now()}` }

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  function handleExport() {
    const { contextFields, bom, activeWarning } = useProjectStore.getState()
    exportReadinessPack({
      projectTitle: 'BuildGuard Node',
      contextFields,
      bom,
      warningTitle: activeWarning?.title ?? '',
      fixLabel: activeWarning?.fix.label ?? '',
      suppliers: SUPPLIERS,
      rfqQuestions: [
        ...(activeWarning?.fix.rfqQuestionsAdded ?? []),
        ...RFQ_QUESTIONS_BASE,
      ],
    })
  }

  const handleSend = useCallback(async (content: string, files?: File[]) => {
    if (!content.trim() && (!files || files.length === 0)) return
    const store = useProjectStore.getState()

    if (files?.length) {
      files.forEach((f) => {
        store.addMessage({ id: mkId(), type: 'file-upload', content: '', timestamp: Date.now(), fileName: f.name })
      })
    }

    store.addMessage({ id: mkId(), type: 'user', content, timestamp: Date.now() })

    const aiMsgId = mkId()
    store.addMessage({ id: aiMsgId, type: 'ai', content: '', timestamp: Date.now() })
    store.setStreaming(true)

    try {
      await streamChat(
        'project',
        content,
        files?.map((f) => f.name) ?? [],
        (type, data) => {
          const s = useProjectStore.getState()
          if (type === 'text') {
            s.appendToLastMessage(data as string)
          } else if (type === 'context') {
            s.setContextFields(DEPLOYMENT_CONTEXT)
            s.setDemoStep(1)
          } else if (type === 'node') {
            s.setShowNode(true)
            s.setDemoStep(2)
          } else if (type === 'warning') {
            s.setActiveWarning(MOCK_WARNING)
            s.addMessage({
              id: mkId(),
              type: 'warning-card',
              content: '',
              timestamp: Date.now(),
              warning: MOCK_WARNING,
            })
            s.setDemoStep(4)
          } else if (type === 'suppliers') {
            s.setShowSuppliers(true)
            s.setDemoStep(5)
          }
        },
        () => useProjectStore.getState().setStreaming(false)
      )
    } catch {
      const s = useProjectStore.getState()
      s.appendToLastMessage('\n\n[Connection error — using demo data]')
      s.setContextFields(DEPLOYMENT_CONTEXT)
      s.setShowNode(true)
      s.setActiveWarning(MOCK_WARNING)
      s.addMessage({ id: mkId(), type: 'warning-card', content: '', timestamp: Date.now(), warning: MOCK_WARNING })
      s.setShowSuppliers(true)
      s.setDemoStep(5)
      s.setStreaming(false)
    }
  }, [])

  return (
    <div className="flex flex-col h-screen">
      <Header projectTitle="BuildGuard Node" onExport={handleExport} />
      <div className="flex flex-1 gap-2 p-2 overflow-hidden">
        <LeftPanel />
        <CenterPanel />
        <RightPanel onSend={handleSend} />
      </div>
      <ProgressBar />
    </div>
  )
}
