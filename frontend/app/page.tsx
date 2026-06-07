import { ProjectsGrid } from '@/components/home/ProjectsGrid'
import { Header } from '@/components/ui/Header'

export default function HomePage() {
  return (
    <div className="flex flex-col h-screen">
      <Header />
      <main className="flex-1 overflow-auto p-6">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
          <div className="space-y-1">
            <h1 className="text-xl font-medium text-white/90">Projects</h1>
            <p className="text-sm text-white/45">
              Create a new hardware brief or resume a saved project.
            </p>
          </div>
          <ProjectsGrid />
        </div>
      </main>
    </div>
  )
}
