'use client'

import Link from 'next/link'
import { useProjectStore } from '@/lib/store'
import { ExportMenu } from './ExportMenu'

type Props = {
  projectId?: string
  projectTitle?: string
}

export function Header({ projectId, projectTitle }: Props) {
  const subscribedBomLen = useProjectStore((s) => s.bom.length)
  const bomLen = useProjectStore.getState().bom.length || subscribedBomLen
  const showBuildPack = Boolean(projectId && bomLen > 0)

  return (
    <div className="flex items-center justify-between px-4 h-11 border-b border-white/[0.06] shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-sm font-medium text-white/90 tracking-tight">Physical Cursor</span>
        {projectTitle && (
          <>
            <span className="text-white/20">/</span>
            <span className="text-sm text-white/50 truncate max-w-[240px]">{projectTitle}</span>
          </>
        )}
      </div>
      <div className="flex items-center gap-2">
        {showBuildPack && (
          <Link
            href={`/project/${projectId}/marketplace`}
            className="text-xs px-3 py-1.5 rounded border border-emerald-400/20 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/15 transition-colors"
          >
            Order Build Pack
          </Link>
        )}
        <ExportMenu />
      </div>
    </div>
  )
}
