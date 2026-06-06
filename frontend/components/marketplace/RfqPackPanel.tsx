import type { BuildPack } from '@/lib/marketplace/build-pack'

type RfqPackPanelProps = {
  pack: BuildPack
}

export function RfqPackPanel({ pack }: RfqPackPanelProps) {
  return (
    <section className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-4">
      <div className="mb-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/35">RFQ Pack</p>
        <p className="mt-0.5 text-xs text-white/45">Open supplier questions for quote handoff</p>
      </div>

      {pack.rfqQuestions.length === 0 ? (
        <div className="rounded-md border border-white/[0.06] bg-black/15 px-3 py-4 text-xs text-white/35">
          No RFQ questions are attached to this build pack.
        </div>
      ) : (
        <ol className="space-y-2">
          {pack.rfqQuestions.map((question, index) => (
            <li
              key={`${index}-${question}`}
              className="flex gap-3 rounded-md border border-white/[0.06] bg-black/15 px-3 py-2"
            >
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-[10px] tabular-nums text-white/40">
                {index + 1}
              </span>
              <p className="text-xs leading-snug text-white/70">{question}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
