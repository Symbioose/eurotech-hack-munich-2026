'use client'
import { use, useCallback, useState, useEffect } from 'react'
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
  const { id } = use(params)
  const [projectTitle, setProjectTitle] = useState('BuildGuard Node')

  useEffect(() => {
    try {
      const projects = JSON.parse(localStorage.getItem('pc_projects') || '[]')
      const project = projects.find((p: { id: string }) => p.id === id)
      if (project?.title && project.title !== 'New Project') {
        setProjectTitle(project.title)
      }
    } catch {}
  }, [id])

  function updateProject(updates: { title?: string; status?: string }) {
    try {
      const projects = JSON.parse(localStorage.getItem('pc_projects') || '[]')
      localStorage.setItem('pc_projects', JSON.stringify(
        projects.map((p: { id: string }) => p.id === id ? { ...p, ...updates } : p)
      ))
    } catch {}
  }

  function handleExport() {
    const { contextFields, bom, activeWarning } = useProjectStore.getState()
    exportReadinessPack({
      projectTitle,
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

    const currentMessages = useProjectStore.getState().messages
    const isFirstMessage = currentMessages.filter(m => m.type === 'user').length === 0
    if (isFirstMessage && content.trim()) {
      const title = content.trim().slice(0, 60)
      setProjectTitle(title)
      updateProject({ title })
    }

    const history = currentMessages
      .filter(m => (m.type === 'user' || m.type === 'ai') && m.content.trim())
      .map(m => ({
        role: (m.type === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: m.content,
      }))

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
        history,
        (type, data) => {
          const s = useProjectStore.getState()
          if (type === 'text') {
            s.appendToLastMessage(data as string)
          } else if (type === 'context') {
            const fields = Array.isArray(data) && data.length > 0
              ? (data as { label: string; value: string }[])
              : DEPLOYMENT_CONTEXT
            s.setContextFields(fields)
            s.setDemoStep(1)
          } else if (type === 'node') {
            s.setShowNode(true)
            s.setDemoStep(2)
          } else if (type === 'bom') {
            if (Array.isArray(data) && data.length > 0) {
              const rows = (data as { part: string; supplierRoute: string; cost: number }[]).map((row, i) => ({
                id: `bom-${i}`,
                part: row.part ?? '',
                supplierRoute: row.supplierRoute ?? '',
                cost: Number(row.cost) || 0,
              }))
              s.setBOM(rows)
            }
            s.setDemoStep(3)
          } else if (type === 'warning') {
            const aiWarning = data as { severity?: string; title?: string; explanation?: string; affectedComponents?: string[] } | null
            const warning = {
              ...MOCK_WARNING,
              severity: (aiWarning?.severity as 'critical' | 'warning' | 'note') ?? MOCK_WARNING.severity,
              title: aiWarning?.title ?? MOCK_WARNING.title,
              explanation: aiWarning?.explanation ?? MOCK_WARNING.explanation,
              affectedComponents: aiWarning?.affectedComponents ?? MOCK_WARNING.affectedComponents,
            }
            s.setActiveWarning(warning)
            s.addMessage({
              id: mkId(),
              type: 'warning-card',
              content: '',
              timestamp: Date.now(),
              warning,
            })
            s.setDemoStep(4)
          } else if (type === 'suppliers') {
            s.setShowSuppliers(true)
            s.setDemoStep(5)
          }
        },
        () => {
          useProjectStore.getState().setStreaming(false)
          updateProject({ status: 'complete' })
        }
      )
    } catch {
      const s = useProjectStore.getState()
      s.setContextFields(DEPLOYMENT_CONTEXT)
      s.setShowNode(true)
      s.setActiveWarning(MOCK_WARNING)
      s.addMessage({ id: mkId(), type: 'warning-card', content: '', timestamp: Date.now(), warning: MOCK_WARNING })
      s.setShowSuppliers(true)
      s.setDemoStep(5)
      s.setStreaming(false)
      updateProject({ status: 'complete' })
    }
  }, [])

  return (
    <div className="flex flex-col h-screen">
      <Header projectTitle={projectTitle} onExport={handleExport} />
      <div className="flex flex-1 gap-2 p-2 overflow-hidden">
        <LeftPanel />
        <CenterPanel />
        <RightPanel onSend={handleSend} />
      </div>
      <ProgressBar />
    </div>
  )
}
