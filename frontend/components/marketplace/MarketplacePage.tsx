'use client'

import Link from 'next/link'
import { useState } from 'react'
import { BuildPackHeader } from '@/components/marketplace/BuildPackHeader'
import { KitContents } from '@/components/marketplace/KitContents'
import { ProcurementActions } from '@/components/marketplace/ProcurementActions'
import { RfqPackPanel } from '@/components/marketplace/RfqPackPanel'
import { SupplierRoutePanel } from '@/components/marketplace/SupplierRoutePanel'
import { exportBomCsv, exportDesignJson, exportReadinessPack } from '@/lib/export'
import { deriveBuildPack } from '@/lib/marketplace/build-pack'
import { useProjectStore } from '@/lib/store'
import type { McpToolCallUI, SourceRefreshState } from '@/lib/types'

type MarketplacePageProps = {
  projectId: string
}

type RefreshResponse = {
  refreshed_at: string
  results: {
    compliance: { status: string; provider: string }
    hardware: { status: string; provider: string }
  }
  mcpToolCalls: McpToolCallUI[]
}

function sourceStatusFromRefresh(body: RefreshResponse): SourceRefreshState {
  const statuses = [body.results.compliance.status, body.results.hardware.status]

  if (statuses.includes('ok')) {
    return {
      status: 'candidate',
      message: 'Candidate updates found',
      refreshedAt: body.refreshed_at,
    }
  }

  if (statuses.every((status) => status === 'not_configured')) {
    return {
      status: 'not_configured',
      message: 'Tavily key not configured',
      refreshedAt: body.refreshed_at,
    }
  }

  return {
    status: 'error',
    message: 'Refresh returned partial results',
    refreshedAt: body.refreshed_at,
  }
}

function readinessData() {
  const state = useProjectStore.getState()

  return {
    projectTitle: state.projectTitle || 'Hardware product',
    contextFields: state.contextFields,
    bom: state.bom,
    bomTotal: state.bomTotal,
    baselineBomTotal: state.baselineBomTotal,
    fixApplied: state.fixApplied,
    warning: state.activeWarning
      ? {
          title: state.activeWarning.title,
          explanation: state.activeWarning.explanation,
          fixLabel: state.activeWarning.fix.label,
          costDelta: state.activeWarning.fix.costDelta,
        }
      : null,
    gbaRoute: state.gbaRoute,
    rfqQuestions: state.rfqQuestions,
  }
}

export function MarketplacePage({ projectId }: MarketplacePageProps) {
  const subscribedProjectTitle = useProjectStore((state) => state.projectTitle)
  const subscribedBom = useProjectStore((state) => state.bom)
  const subscribedBomTotal = useProjectStore((state) => state.bomTotal)
  const subscribedBaselineBomTotal = useProjectStore((state) => state.baselineBomTotal)
  const subscribedFixApplied = useProjectStore((state) => state.fixApplied)
  const subscribedActiveWarning = useProjectStore((state) => state.activeWarning)
  const subscribedSupplierRoute = useProjectStore((state) => state.gbaRoute)
  const subscribedRfqQuestions = useProjectStore((state) => state.rfqQuestions)
  const subscribedSourceRefresh = useProjectStore((state) => state.sourceRefresh)
  const subscribedPipelineState = useProjectStore((state) => state.pipelineState)
  const setSourceRefresh = useProjectStore((state) => state.setSourceRefresh)
  const setMcpToolCalls = useProjectStore((state) => state.setMcpToolCalls)
  const [refreshing, setRefreshing] = useState(false)
  const currentState = useProjectStore.getState()
  const projectTitle = currentState.projectTitle || subscribedProjectTitle
  const bom = currentState.bom.length > 0 ? currentState.bom : subscribedBom
  const bomTotal = currentState.bom.length > 0 ? currentState.bomTotal : subscribedBomTotal
  const baselineBomTotal =
    currentState.bom.length > 0 ? currentState.baselineBomTotal : subscribedBaselineBomTotal
  const fixApplied = currentState.fixApplied || subscribedFixApplied
  const activeWarning = currentState.activeWarning ?? subscribedActiveWarning
  const supplierRoute = currentState.gbaRoute.length > 0 ? currentState.gbaRoute : subscribedSupplierRoute
  const rfqQuestions = currentState.rfqQuestions.length > 0 ? currentState.rfqQuestions : subscribedRfqQuestions
  const sourceRefresh = currentState.sourceRefresh.status !== 'idle' ? currentState.sourceRefresh : subscribedSourceRefresh
  const pipelineState = currentState.pipelineState ?? subscribedPipelineState

  if (bom.length === 0) {
    return (
      <main className="flex h-screen overflow-y-auto bg-[#0a0a0a] px-5 py-8 text-white">
        <div className="mx-auto flex w-full max-w-lg flex-col items-center justify-center text-center">
          <div className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] p-6">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/35">
              Build Pack Marketplace
            </p>
            <h1 className="mt-2 text-xl font-semibold text-white/90">No Build Pack generated yet</h1>
            <p className="mt-2 text-sm leading-relaxed text-white/45">
              Generate a hardware design first, then return here to buy parts, export RFQ material and review the
              supplier route.
            </p>
            <Link
              href={`/project/${projectId}/workspace`}
              className="mt-5 inline-flex rounded-md border border-blue-500/35 bg-blue-500/15 px-3 py-2 text-sm font-medium text-blue-100 hover:bg-blue-500/25"
            >
              Back to workspace
            </Link>
          </div>
        </div>
      </main>
    )
  }

  const pack = deriveBuildPack({
    projectId,
    projectTitle,
    bom,
    bomTotal,
    baselineBomTotal,
    fixApplied,
    activeWarning,
    supplierRoute,
    rfqQuestions,
    sourceRefresh,
  })

  function handleBuyParts() {
    const buyableOffers = pack.groups
      .flatMap((group) => group.items)
      .map((line) => ({
        offer: line.bestOffer,
        componentId: line.componentId ?? line.id,
      }))
      .filter((item): item is { offer: NonNullable<typeof item.offer>; componentId: string } => Boolean(item.offer))

    for (const item of buyableOffers.slice(0, 6)) {
      const params = new URLSearchParams({
        u: item.offer.url,
        c: item.componentId,
        d: item.offer.distributor,
      })

      window.open(`/api/go?${params.toString()}`, '_blank', 'noopener,noreferrer')
    }
  }

  function handleExportRfq() {
    const title = projectTitle || 'product'

    exportReadinessPack(readinessData())
    exportBomCsv(bom, title)
    if (pipelineState) exportDesignJson(pipelineState, title)
  }

  async function handleRefreshSources() {
    if (refreshing || sourceRefresh.status === 'checking') return

    if (!pipelineState) {
      setSourceRefresh({ status: 'error', message: 'Generate a pipeline before refreshing sources' })
      return
    }

    setRefreshing(true)
    setSourceRefresh({ status: 'checking', message: 'Checking web sources' })

    try {
      const response = await fetch('/api/research/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pipelineState }),
      })

      if (!response.ok) throw new Error('Refresh failed')

      const body = (await response.json()) as RefreshResponse
      setSourceRefresh(sourceStatusFromRefresh(body))
      setMcpToolCalls([...useProjectStore.getState().mcpToolCalls, ...body.mcpToolCalls])
    } catch {
      setSourceRefresh({ status: 'error', message: 'Refresh failed' })
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <main className="h-screen overflow-y-auto bg-[#0a0a0a] text-white">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-5 py-5">
        <BuildPackHeader pack={pack} />
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-5">
            <ProcurementActions
              pack={pack}
              refreshing={refreshing || sourceRefresh.status === 'checking'}
              onBuyParts={handleBuyParts}
              onExportRfq={handleExportRfq}
              onRefreshSources={handleRefreshSources}
            />
            <KitContents pack={pack} />
          </div>
          <aside className="space-y-5">
            <SupplierRoutePanel pack={pack} />
            <RfqPackPanel pack={pack} />
          </aside>
        </div>
      </div>
    </main>
  )
}
