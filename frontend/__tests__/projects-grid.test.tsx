import { act } from 'react'
import { renderToString } from 'react-dom/server'
import { hydrateRoot } from 'react-dom/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ProjectsGrid } from '../components/home/ProjectsGrid'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

describe('ProjectsGrid', () => {
  const storage = new Map<string, string>()

  beforeEach(() => {
    storage.clear()
    const localStorageStub = {
      getItem: vi.fn((key: string) => storage.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => storage.set(key, value)),
      removeItem: vi.fn((key: string) => storage.delete(key)),
      clear: vi.fn(() => storage.clear()),
    }
    vi.stubGlobal('localStorage', localStorageStub)
    Object.defineProperty(window, 'localStorage', {
      value: localStorageStub,
      configurable: true,
    })
  })

  it('hydrates without rendering localStorage projects in the server snapshot', async () => {
    localStorage.setItem(
      'pc_projects',
      JSON.stringify([
        {
          id: 'project-1',
          title: 'Stored Project',
          createdAt: 0,
          status: 'complete',
        },
      ])
    )

    const html = renderToString(<ProjectsGrid />)
    expect(html).toContain('New Project')
    expect(html).not.toContain('Stored Project')

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const container = document.createElement('div')
    container.innerHTML = html

    await act(async () => {
      hydrateRoot(container, <ProjectsGrid />)
      await Promise.resolve()
    })

    const errors = consoleError.mock.calls.map((call) => String(call[0])).join('\n')
    expect(errors).not.toContain('Hydration failed')
    consoleError.mockRestore()
  })
})
