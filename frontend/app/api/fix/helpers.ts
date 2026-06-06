import { MOCK_WARNING } from '@/lib/buildguard-data'
import type { SimulationWarning } from '@/lib/types'

const WARNING_REGISTRY: Record<string, SimulationWarning> = {
  IP_INSUFFICIENT: MOCK_WARNING,
}

export function getFixForWarning(warningId: string): SimulationWarning['fix'] | null {
  const warning = WARNING_REGISTRY[warningId]
  return warning ? warning.fix : null
}
