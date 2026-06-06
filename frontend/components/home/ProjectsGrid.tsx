'use client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import type { Project } from '@/lib/types'
import { ProjectCard } from './ProjectCard'

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
      <div
        onClick={handleNew}
        className="bg-white border border-[#e0dfd8] rounded-lg h-40 flex flex-col items-center justify-center cursor-pointer hover:border-[#bbb] transition-colors group"
      >
        <span className="text-2xl text-[#bbb] group-hover:text-[#888] transition-colors mb-1">+</span>
        <span className="text-xs text-[#888]">New Project</span>
      </div>
      {projects.map((p) => (
        <ProjectCard key={p.id} project={p} />
      ))}
    </div>
  )
}
