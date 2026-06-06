'use client'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { ChatFeed } from './ChatFeed'
import { ChatInput } from './ChatInput'

type Props = {
  onSend: (content: string, files?: File[]) => void
}

export function RightPanel({ onSend }: Props) {
  return (
    <GlassPanel className="flex flex-col h-full w-[360px] shrink-0">
      <div className="px-4 py-2 border-b border-[#e0dfd8] shrink-0">
        <span className="text-xs text-[#888] uppercase tracking-widest">AI Chat</span>
      </div>
      <ChatFeed />
      <ChatInput onSend={onSend} />
    </GlassPanel>
  )
}
