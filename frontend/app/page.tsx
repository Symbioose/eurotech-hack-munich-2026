import { Header } from '@/components/ui/Header'
import { ProjectsGrid } from '@/components/home/ProjectsGrid'

export default function HomePage() {
  return (
    <div className="flex flex-col h-screen">
      <Header />
      <main className="flex-1 overflow-auto p-6">
        <h1 className="text-lg font-medium text-white/80 mb-6">Projects</h1>
        <ProjectsGrid />
      </main>
    </div>
  )
}
