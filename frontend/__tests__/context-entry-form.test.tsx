import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ContextEntryForm } from '../components/project/ContextEntryForm'

const push = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}))

describe('ContextEntryForm', () => {
  beforeEach(() => {
    push.mockClear()
    const sessionStorageStub = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    }
    vi.stubGlobal('sessionStorage', sessionStorageStub)
    Object.defineProperty(window, 'sessionStorage', {
      value: sessionStorageStub,
      configurable: true,
    })
  })

  it('fills the prompt from a catalog example while keeping free-form generation available', () => {
    render(<ContextEntryForm projectId="project-1" />)

    fireEvent.click(screen.getByRole('button', { name: 'Smart waste bin' }))

    const prompt = screen.getByLabelText('Deployment context')
    expect(prompt).toHaveValue(
      'A smart waste bin for Munich parks that detects fill level, odor and lid openings, runs on battery power, and helps sanitation teams prioritize collection routes.'
    )
    expect(screen.getByRole('button', { name: /Generate hardware brief/i })).toBeEnabled()
  })

  it('submits a selected catalog example into the project workspace', () => {
    render(<ContextEntryForm projectId="project-1" />)

    fireEvent.click(screen.getByRole('button', { name: 'Parking sensor' }))
    fireEvent.click(screen.getByRole('button', { name: /Generate hardware brief/i }))

    expect(sessionStorage.setItem).toHaveBeenCalledWith(
      'pc_prompt_project-1',
      'A roadside parking and traffic sensor for curbside vehicle occupancy that uses solar power and LoRa connectivity without collecting camera footage.'
    )
    expect(push).toHaveBeenCalledWith('/project/project-1/workspace')
  })
})
