'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { BuildPackHeader } from '@/components/marketplace/BuildPackHeader'
import { KitContents } from '@/components/marketplace/KitContents'
import { ProcurementActions } from '@/components/marketplace/ProcurementActions'
import { RfqPackPanel } from '@/components/marketplace/RfqPackPanel'
import { SupplierRoutePanel } from '@/components/marketplace/SupplierRoutePanel'
import { exportBomCsv, exportDesignJson, exportReadinessPack } from '@/lib/export'
import { deriveBuildPack } from '@/lib/marketplace/build-pack'
import { restoreProjectSnapshot, saveCurrentProjectSnapshot } from '@/lib/project-storage'
import { useProjectStore } from '@/lib/store'
import type { McpToolCallUI, SourceRefreshState } from '@/lib/types'

type MarketplacePageProps = {
  projectId: string
}

type RefreshResponse = {
  refreshed_at: string
  results: {
    compliance: { status: string; provider: string; results?: TavilyCandidate[] }
    hardware: { status: string; provider: string; results?: TavilyCandidate[] }
  }
  mcpToolCalls: McpToolCallUI[]
}

type TavilyCandidate = {
  title?: string
  url?: string
  content?: string
}

function sourceStatusFromRefresh(body: RefreshResponse): SourceRefreshState {
  const statuses = [body.results.compliance.status, body.results.hardware.status]
  const candidates = [
    ...(body.results.compliance.results ?? []).map((result) => ({
      kind: 'compliance' as const,
      title: result.title ?? result.url ?? 'Compliance candidate',
      url: result.url ?? '',
      snippet: result.content,
    })),
    ...(body.results.hardware.results ?? []).map((result) => ({
      kind: 'hardware' as const,
      title: result.title ?? result.url ?? 'Hardware candidate',
      url: result.url ?? '',
      snippet: result.content,
    })),
  ].filter((candidate) => candidate.url)

  if (statuses.includes('ok')) {
    return {
      status: 'candidate',
      message: candidates.length > 0 ? `${candidates.length} candidate source(s) found` : 'Candidate updates found',
      refreshedAt: body.refreshed_at,
      candidates,
    }
  }

  if (statuses.every((status) => status === 'not_configured')) {
    return {
      status: 'not_configured',
      message: 'Tavily key not configured',
      refreshedAt: body.refreshed_at,
      candidates: [],
    }
  }

  return {
    status: 'error',
    message: 'Refresh returned partial results',
    refreshedAt: body.refreshed_at,
    candidates,
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

function SourcingCandidates({ sourceRefresh }: { sourceRefresh: SourceRefreshState }) {
  const candidates = sourceRefresh.candidates ?? []

  return (
    <section className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/35">
            Tavily Candidates
          </p>
          <p className="mt-0.5 text-xs text-white/45">
            Candidate web findings. Review before promoting them to trusted sources.
          </p>
        </div>
        <span className="rounded-sm border border-white/[0.08] bg-black/20 px-2 py-1 text-[10px] uppercase tracking-wide text-white/40">
          {sourceRefresh.status}
        </span>
      </div>

      {candidates.length === 0 ? (
        <p className="mt-3 rounded-md border border-white/[0.06] bg-black/15 px-3 py-3 text-xs text-white/35">
          {sourceRefresh.status === 'not_configured'
            ? 'Set TAVILY_API_KEY to run live source research.'
            : 'Run sourcing refresh to collect candidate compliance and distributor links.'}
        </p>
      ) : (
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {candidates.slice(0, 8).map((candidate) => (
            <a
              key={`${candidate.kind}-${candidate.url}`}
              href={candidate.url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md border border-white/[0.06] bg-black/15 px-3 py-2 hover:bg-white/[0.04]"
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="rounded-sm border border-blue-500/25 bg-blue-500/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-blue-200">
                  {candidate.kind}
                </span>
                <span className="text-[9px] text-white/25">candidate</span>
              </div>
              <p className="line-clamp-2 text-xs font-medium text-white/75">{candidate.title}</p>
              {candidate.snippet && (
                <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-white/38">
                  {candidate.snippet}
                </p>
              )}
            </a>
          ))}
        </div>
      )}
    </section>
  )
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

  useEffect(() => {
    if (useProjectStore.getState().bom.length === 0) {
      restoreProjectSnapshot(projectId)
    }
  }, [projectId])

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
      saveCurrentProjectSnapshot(projectId)
    } catch {
      setSourceRefresh({ status: 'error', message: 'Refresh failed' })
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <main className="h-screen overflow-y-auto bg-[#0a0a0a] text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-5 py-5">
        <div className="flex items-center justify-between gap-3">
          <Link
            href={`/project/${projectId}/workspace`}
            className="rounded-md border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs font-medium text-white/65 hover:bg-white/[0.06] hover:text-white/85"
          >
            Back to Workspace
          </Link>
          <Link
            href="/"
            className="rounded-md border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs font-medium text-white/45 hover:bg-white/[0.06] hover:text-white/70"
          >
            Projects
          </Link>
        </div>
        <BuildPackHeader pack={pack} />
        <ProcurementActions
          pack={pack}
          refreshing={refreshing || sourceRefresh.status === 'checking'}
          onBuyParts={handleBuyParts}
          onExportRfq={handleExportRfq}
          onRefreshSources={handleRefreshSources}
        />
        <KitContents pack={pack} />
        <SourcingCandidates sourceRefresh={sourceRefresh} />
        <div className="grid gap-4 lg:grid-cols-2">
          <SupplierRoutePanel pack={pack} />
          <RfqPackPanel pack={pack} />
        </div>
      </div>
    </main>
  )
}
