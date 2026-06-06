import type { SimulationWarning } from './types'

export function formatRiskCheckpointMessage(warning: SimulationWarning): string {
  const lead =
    warning.severity === 'critical'
      ? '⛔ I stopped this build before it reaches manufacturing.'
      : `Heads up — I caught a ${warning.severity}-level issue before manufacturing.`
  return [
    lead,
    `${warning.title} — ${warning.explanation}`,
    warning.severity === 'critical'
      ? 'Left unfixed, this ships as a latent field failure. Recommended fix: ' +
        `${warning.fix.label} (+$${warning.fix.costDelta}).`
      : `Recommended fix: ${warning.fix.label} (+$${warning.fix.costDelta}).`,
    'Apply the fix now, or tell me your constraint and I will adapt the design.',
  ].join('\n\n')
}
