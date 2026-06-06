'use client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import type { Project } from '@/lib/types'
import { ProjectCard } from './ProjectCard'
import { GlassPanel } from '@/components/ui/GlassPanel'

function loadProjects(): Project[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem('pc_projects') || '[]')
  } catch {
    return []
  }
}

function createProject(): Project {
  return {
    id: crypto.randomUUID(),
    title: 'New Project',
    createdAt: Date.now(),
    status: 'generating',
  }
}

function saveProject(project: Project) {
  const existing = loadProjects()
  const updated = [project, ...existing.filter((p) => p.id !== project.id)]
  localStorage.setItem('pc_projects', JSON.stringify(updated))
}

export function ProjectsGrid() {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])

  useEffect(() => {
    setProjects(loadProjects())
  }, [])

  function handleNew() {
    const project = createProject()
    saveProject(project)
    router.push(`/project/${project.id}`)
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
      <GlassPanel className="h-40 flex flex-col items-center justify-center cursor-pointer hover:border-white/20 transition-colors group">
        <button onClick={handleNew} className="flex flex-col items-center gap-2 w-full h-full justify-center">
          <span className="text-2xl text-white/20 group-hover:text-white/50 transition-colors">+</span>
          <span className="text-xs text-white/40 group-hover:text-white/60 transition-colors">New Project</span>
        </button>
      </GlassPanel>
      {projects.map((p) => (
        <ProjectCard key={p.id} project={p} />
      ))}
    </div>
  )
}
