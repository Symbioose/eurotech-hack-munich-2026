import type { SimulationWarning } from './types'

export function formatRiskCheckpointMessage(warning: SimulationWarning): string {
  const lead =
    warning.severity === 'critical'
      ? 'Critical DfMA review required before this build is treated as production-ready.'
      : `Heads up — the DfMA engine found a ${warning.severity}-level issue for review.`
  return [
    lead,
    `${warning.title} — ${warning.explanation}`,
    warning.severity === 'critical'
      ? 'Left unfixed, this remains a material field-risk assumption. Recommended fix: ' +
        `${warning.fix.label} (+$${warning.fix.costDelta}).`
      : `Recommended fix: ${warning.fix.label} (+$${warning.fix.costDelta}).`,
    'Apply the fix now, or tell me your constraint and I will adapt the design.',
  ].join('\n\n')
}
