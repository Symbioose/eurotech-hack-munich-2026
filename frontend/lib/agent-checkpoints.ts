import type { SimulationWarning } from './types'

export function formatRiskCheckpointMessage(warning: SimulationWarning): string {
  const severity = warning.severity === 'critical' ? 'critical issue' : `${warning.severity} issue`
  return [
    `Hardware expert found a ${severity}: ${warning.title}.`,
    warning.explanation,
    `Recommended fix: ${warning.fix.label} (+$${warning.fix.costDelta}).`,
    'You can apply the fix now, or tell me your constraint and I will adapt the design.',
  ].join('\n\n')
}
