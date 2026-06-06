'use client'
import { useEffect, useRef } from 'react'
import { useProjectStore } from '@/lib/store'
import { ChatMessage } from './ChatMessage'

export function ChatFeed() {
  const messages = useProjectStore((s) => s.messages)
  const showNode = useProjectStore((s) => s.showNode)
  const addMessage = useProjectStore((s) => s.addMessage)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showNode) return
    const hasSimulationAction = messages.some(
      (msg) => msg.type === 'action-button' && msg.actionCallback === 'run-simulation'
    )
    if (hasSimulationAction) return

    addMessage({
      id: `simulation-action-${Date.now()}`,
      type: 'action-button',
      content: 'The 3D hardware plan is ready. Run the world-model stress test on this device.',
      timestamp: Date.now(),
      actionLabel: 'Run Simulation',
      actionCallback: 'run-simulation',
    })
  }, [addMessage, messages, showNode])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-3">
      {messages.length === 0 && (
        <div className="flex flex-col items-center justify-center h-full text-center py-12">
          <p className="text-sm text-white/30">Describe the product you want to build</p>
          <p className="text-xs text-white/15 mt-1">Then ask to add, remove or change parts</p>
        </div>
      )}
      {messages.map((msg) => (
        <ChatMessage key={msg.id} message={msg} />
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
