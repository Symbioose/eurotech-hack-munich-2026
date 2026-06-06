'use client'
import { useProjectStore } from '@/lib/store'

const STEPS = [
  'Context',
  '3D Node',
  'X-Ray',
  'Risk',
  'Apply Fix',
  'Suppliers',
  'Export',
]

export function ProgressBar() {
  const currentStep = useProjectStore((s) => s.currentStep)

  return (
    <div className="flex items-center h-10 px-4 border-t border-white/[0.06] shrink-0 gap-1">
      {STEPS.map((label, i) => {
        const isComplete = i < currentStep
        const isActive = i === currentStep
        return (
          <div key={label} className="flex items-center gap-1 flex-1">
            <div className={`flex items-center gap-1.5 ${isActive ? 'text-white' : isComplete ? 'text-white/40' : 'text-white/20'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-[#3b82f6]' : isComplete ? 'bg-white/30' : 'bg-white/10'}`} />
              <span className="text-[10px] font-medium tracking-wide uppercase">{label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-px mx-1 ${isComplete ? 'bg-white/20' : 'bg-white/5'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}
