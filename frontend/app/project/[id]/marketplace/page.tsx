import { use } from 'react'
import { MarketplacePage } from '@/components/marketplace/MarketplacePage'

export default function ProjectMarketplaceRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)

  return <MarketplacePage projectId={id} />
}
