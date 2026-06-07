import { act } from 'react'
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Header } from '../components/ui/Header'
import { useProjectStore } from '../lib/store'

vi.mock('../components/ui/ExportMenu', () => ({
  ExportMenu: () => <div>Export Menu</div>,
}))

describe('Header Build Pack CTA', () => {
  beforeEach(() => {
    act(() => {
      useProjectStore.getState().reset()
    })
  })

  it('hides Review Build Pack before a BOM exists', () => {
    const html = renderToString(<Header projectId="project-1" projectTitle="Demo" />)

    expect(html).toContain('Manu')
    expect(html).not.toContain('Review Build Pack')
  })

  it('shows Review Build Pack when BOM rows exist', () => {
    act(() => {
      useProjectStore.getState().setBOM([
        { id: 'sensor', part: 'Sensor', supplierRoute: 'Distributor', cost: 10 },
      ])
    })

    const html = renderToString(<Header projectId="project-1" projectTitle="Demo" />)

    expect(html).toContain('Review Build Pack')
    expect(html).toContain('/project/project-1/marketplace')
  })
})
