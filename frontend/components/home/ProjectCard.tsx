import Link from 'next/link'
import type { Project } from '@/lib/types'

type Props = {
  project: Project
}

export function ProjectCard({ project }: Props) {
  const dateStr = new Date(project.createdAt).toLocaleDateString('en-HK', {
    day: 'numeric', month: 'short', year: 'numeric'
  })

  return (
    <Link href={project.status === 'complete' ? `/project/${project.id}/workspace` : `/project/${project.id}`}>
      <div className="bg-white border border-[#e0dfd8] rounded-lg p-4 hover:border-[#bbb] transition-colors cursor-pointer group h-40 flex flex-col justify-between">
        <div className="w-full h-20 bg-[#f5f4f0] rounded flex items-center justify-center text-[#bbb] text-xs">
          3D preview
        </div>
        <div>
          <p className="text-sm text-[#111] truncate group-hover:text-[#333] transition-colors">
            {project.title}
          </p>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-[#888]">{dateStr}</span>
            <span className="text-xs text-[#888]">{project.status}</span>
          </div>
        </div>
      </div>
    </Link>
  )
}
