'use client'
import { useProjectStore } from '@/lib/store'

const STEPS = [
  'Prompt',
  'Context',
  'Components',
  '3D Node',
  'BOM',
  'Risk',
  'Fix',
  'RFQ',
  'Export',
]

export function ProgressBar() {
  const currentStep = useProjectStore((s) => s.currentStep)

  return (
    <div className="flex items-center h-10 px-4 border-t border-[#e0dfd8] bg-[#f5f4f0] shrink-0 gap-1">
      {STEPS.map((label, i) => {
        const isComplete = i < currentStep
        const isActive = i === currentStep
        return (
          <div key={label} className="flex items-center gap-1 flex-1">
            <div className={`flex items-center gap-1.5 ${isActive ? 'text-[#111]' : isComplete ? 'text-[#888]' : 'text-[#bbb]'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-[#111]' : isComplete ? 'bg-[#bbb]' : 'bg-[#e0dfd8]'}`} />
              <span className="text-[10px] font-medium tracking-wide uppercase">{label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-px mx-1 ${isComplete ? 'bg-[#bbb]' : 'bg-[#e0dfd8]'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}
