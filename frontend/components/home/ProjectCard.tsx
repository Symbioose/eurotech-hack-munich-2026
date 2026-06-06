import Link from 'next/link'
import type { Project } from '@/lib/types'
import { GlassPanel } from '@/components/ui/GlassPanel'

type Props = {
  project: Project
}

export function ProjectCard({ project }: Props) {
  const dateStr = new Date(project.createdAt).toLocaleDateString('en-HK', {
    day: 'numeric', month: 'short', year: 'numeric'
  })

  return (
    <Link href={`/project/${project.id}`}>
      <GlassPanel className="p-4 hover:border-white/20 transition-colors cursor-pointer group h-40 flex flex-col justify-between">
        <div className="w-full h-20 bg-white/[0.02] rounded flex items-center justify-center text-white/10 text-xs">
          3D preview
        </div>
        <div>
          <p className="text-sm text-white/80 truncate group-hover:text-white transition-colors">
            {project.title}
          </p>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-white/30">{dateStr}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              project.status === 'complete'
                ? 'bg-emerald-500/10 text-emerald-400'
                : 'bg-yellow-500/10 text-yellow-400'
            }`}>
              {project.status}
            </span>
          </div>
        </div>
      </GlassPanel>
    </Link>
  )
}
