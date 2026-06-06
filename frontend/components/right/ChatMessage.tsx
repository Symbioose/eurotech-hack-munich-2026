'use client'
import type { ChatMessage as ChatMessageType } from '@/lib/types'
import { WarningCard } from './WarningCard'

type Props = { message: ChatMessageType }

export function ChatMessage({ message }: Props) {
  if (message.type === 'warning-card' && message.warning) {
    return (
      <div className="my-2">
        <WarningCard warning={message.warning} />
      </div>
    )
  }

  if (message.type === 'file-upload') {
    return (
      <div className="flex items-center gap-2 bg-white/[0.03] rounded px-3 py-2 text-xs text-white/50 border border-white/[0.06]">
        <span>📎</span>
        <span>{message.fileName}</span>
      </div>
    )
  }

  const isUser = message.type === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
        isUser
          ? 'bg-blue-500/10 text-white/90 border border-blue-500/20'
          : 'bg-white/[0.04] text-white/80 border border-white/[0.06]'
      }`}>
        {message.content}
      </div>
    </div>
  )
}
