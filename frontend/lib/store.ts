import { create } from 'zustand'
import type { ChatMessage, ViewMode, DemoStep, BOMRow, ContextField, SimulationWarning } from './types'
import { BOM_BEFORE_FIX, BOM_FIX_ADDITIONS } from './buildguard-data'

type ProjectStore = {
  // Chat
  messages: ChatMessage[]
  isStreaming: boolean
  addMessage: (msg: ChatMessage) => void
  appendToLastMessage: (chunk: string) => void
  setStreaming: (v: boolean) => void

  // Left panel
  contextFields: ContextField[]
  bom: BOMRow[]
  showSuppliers: boolean
  setContextFields: (fields: ContextField[]) => void
  setBOM: (rows: BOMRow[]) => void
  setShowSuppliers: (v: boolean) => void

  // Center panel
  viewMode: ViewMode
  highlightedComponentId: string | null
  fixApplied: boolean
  showNode: boolean
  setViewMode: (mode: ViewMode) => void
  setHighlightedComponent: (id: string | null) => void
  applyFix: () => void
  setShowNode: (v: boolean) => void

  // Warning
  activeWarning: SimulationWarning | null
  setActiveWarning: (w: SimulationWarning | null) => void

  // Progress
  currentStep: DemoStep
  setDemoStep: (step: DemoStep) => void

  // Reset
  reset: () => void
}

const initialState = {
  messages: [] as ChatMessage[],
  isStreaming: false,
  contextFields: [] as ContextField[],
  bom: BOM_BEFORE_FIX,
  showSuppliers: false,
  viewMode: 'normal' as ViewMode,
  highlightedComponentId: null as string | null,
  fixApplied: false,
  showNode: false,
  activeWarning: null as SimulationWarning | null,
  currentStep: 0 as DemoStep,
}

export const useProjectStore = create<ProjectStore>()((set, get) => ({
  ...initialState,

  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),

  appendToLastMessage: (chunk) =>
    set((s) => {
      const msgs = [...s.messages]
      if (msgs.length === 0) return s
      const last = msgs[msgs.length - 1]
      msgs[msgs.length - 1] = { ...last, content: last.content + chunk }
      return { messages: msgs }
    }),

  setStreaming: (v) => set({ isStreaming: v }),
  setContextFields: (fields) => set({ contextFields: fields }),
  setBOM: (rows) => set({ bom: rows }),
  setShowSuppliers: (v) => set({ showSuppliers: v }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setHighlightedComponent: (id) => set({ highlightedComponentId: id }),

  applyFix: () => {
    const { bom, currentStep } = get()
    set({
      fixApplied: true,
      bom: [...bom, ...BOM_FIX_ADDITIONS],
      currentStep: Math.min(currentStep + 1, 6) as DemoStep,
    })
  },

  setShowNode: (v) => set({ showNode: v }),
  setActiveWarning: (w) => set({ activeWarning: w }),
  setDemoStep: (step) => set({ currentStep: step }),

  reset: () => set({ ...initialState, bom: BOM_BEFORE_FIX }),
}))

// Required for tests to reset state between runs
;(useProjectStore as typeof useProjectStore & { getInitialState: () => typeof initialState }).getInitialState = () => ({ ...initialState, bom: [...BOM_BEFORE_FIX] })
