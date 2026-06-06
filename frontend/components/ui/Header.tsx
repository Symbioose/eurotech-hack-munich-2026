type Props = {
  projectTitle?: string
  onExport?: () => void
}

export function Header({ projectTitle, onExport }: Props) {
  return (
    <div className="flex items-center justify-between px-4 h-11 border-b border-[#e0dfd8] bg-[#f5f4f0] shrink-0">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-[#111] tracking-tight">Physical Cursor</span>
        {projectTitle && (
          <>
            <span className="text-[#bbb]">/</span>
            <span className="text-sm text-[#888] truncate max-w-[240px]">{projectTitle}</span>
          </>
        )}
      </div>
      {onExport && (
        <button
          onClick={onExport}
          className="text-xs px-3 py-1.5 rounded bg-[#111] text-white hover:bg-[#333] transition-colors"
        >
          Export Pack
        </button>
      )}
    </div>
  )
}
