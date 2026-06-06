import { ExportMenu } from './ExportMenu'

type Props = {
  projectTitle?: string
}

export function Header({ projectTitle }: Props) {
  return (
    <div className="flex items-center justify-between px-4 h-11 border-b border-white/[0.06] shrink-0">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-white/90 tracking-tight">Physical Cursor</span>
        {projectTitle && (
          <>
            <span className="text-white/20">/</span>
            <span className="text-sm text-white/50 truncate max-w-[240px]">{projectTitle}</span>
          </>
        )}
      </div>
      <ExportMenu />
    </div>
  )
}
