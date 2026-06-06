'use client'
import { use, useEffect } from 'react'
import { ContextEntryForm } from '@/components/project/ContextEntryForm'
import { useProjectStore } from '@/lib/store'

export default function ProjectContextPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params)

  useEffect(() => {
    useProjectStore.getState().reset()
  }, [projectId])

  return <ContextEntryForm projectId={projectId} />
}
