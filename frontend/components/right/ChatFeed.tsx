'use client'
import { useEffect, useRef } from 'react'
import { useProjectStore } from '@/lib/store'
import { ChatMessage } from './ChatMessage'

export function ChatFeed() {
  const messages = useProjectStore((s) => s.messages)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-3">
      {messages.length === 0 && (
        <div className="flex flex-col items-center justify-center h-full text-center py-12">
          <p className="text-sm text-[#888]">Describe your smart city problem</p>
          <p className="text-xs text-[#bbb] mt-1">Upload files, ask questions, request changes</p>
        </div>
      )}
      {messages.map((msg) => (
        <ChatMessage key={msg.id} message={msg} />
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
