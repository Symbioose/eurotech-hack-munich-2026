export default function MarketplaceLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0a0a0a] px-5 text-white">
      <div className="w-full max-w-md rounded-lg border border-white/[0.08] bg-white/[0.03] p-5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/35">
          Build Pack Marketplace
        </p>
        <div className="mt-4 space-y-3">
          <div className="h-4 w-2/3 rounded-sm bg-white/[0.08]" />
          <div className="h-3 w-full rounded-sm bg-white/[0.05]" />
          <div className="h-3 w-5/6 rounded-sm bg-white/[0.05]" />
        </div>
      </div>
    </main>
  )
}
