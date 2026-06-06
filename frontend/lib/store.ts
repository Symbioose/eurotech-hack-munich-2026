import { create } from 'zustand'
import type {
  ChatMessage,
  ViewMode,
  DemoStep,
  BOMRow,
  ContextField,
  SimulationWarning,
  Component3D,
  PipelineStageName,
  GbaRouteDisplayStep,
} from './types'
import type { PipelineState } from './pipeline/types'

type ProjectStore = {
  messages: ChatMessage[]
  isStreaming: boolean
  addMessage: (msg: ChatMessage) => void
  appendToLastMessage: (chunk: string) => void
  setStreaming: (v: boolean) => void

  contextFields: ContextField[]
  bom: BOMRow[]
  bomTotal: number
  baselineBomTotal: number
  showSuppliers: boolean
  rfqQuestions: string[]
  gbaRoute: GbaRouteDisplayStep[]
  projectTitle: string
  pipelineStage: PipelineStageName
  pipelineState: PipelineState | null
  usedDeterministic: boolean
  setContextFields: (fields: ContextField[]) => void
  setBOM: (rows: BOMRow[]) => void
  setBomTotal: (n: number) => void
  setBaselineBomTotal: (n: number) => void
  setShowSuppliers: (v: boolean) => void
  setRfqQuestions: (q: string[]) => void
  setGbaRoute: (route: GbaRouteDisplayStep[]) => void
  setProjectTitle: (title: string) => void
  setPipelineStage: (s: PipelineStageName) => void
  setPipelineState: (s: PipelineState | null) => void
  setUsedDeterministic: (v: boolean) => void

  viewMode: ViewMode
  highlightedComponentId: string | null
  fixApplied: boolean
  showNode: boolean
  sceneComponents: Component3D[]
  setViewMode: (mode: ViewMode) => void
  setHighlightedComponent: (id: string | null) => void
  setFixApplied: (v: boolean) => void
  setShowNode: (v: boolean) => void
  setSceneComponents: (c: Component3D[]) => void

  activeWarning: SimulationWarning | null
  setActiveWarning: (w: SimulationWarning | null) => void

  currentStep: DemoStep
  setDemoStep: (step: DemoStep) => void

  reset: () => void
}

const initialState = {
  messages: [] as ChatMessage[],
  isStreaming: false,
  contextFields: [] as ContextField[],
  bom: [] as BOMRow[],
  bomTotal: 0,
  baselineBomTotal: 0,
  showSuppliers: false,
  rfqQuestions: [] as string[],
  gbaRoute: [] as GbaRouteDisplayStep[],
  projectTitle: '',
  pipelineStage: null as PipelineStageName,
  pipelineState: null as PipelineState | null,
  usedDeterministic: false,
  viewMode: 'normal' as ViewMode,
  highlightedComponentId: null as string | null,
  fixApplied: false,
  showNode: false,
  sceneComponents: [] as Component3D[],
  activeWarning: null as SimulationWarning | null,
  currentStep: 0 as DemoStep,
}

export const useProjectStore = create<ProjectStore>()((set) => ({
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
  setBomTotal: (n) => set({ bomTotal: n }),
  setBaselineBomTotal: (n) => set({ baselineBomTotal: n }),
  setShowSuppliers: (v) => set({ showSuppliers: v }),
  setRfqQuestions: (q) => set({ rfqQuestions: q }),
  setGbaRoute: (route) => set({ gbaRoute: route }),
  setProjectTitle: (title) => set({ projectTitle: title }),
  setPipelineStage: (s) => set({ pipelineStage: s }),
  setPipelineState: (s) => set({ pipelineState: s }),
  setUsedDeterministic: (v) => set({ usedDeterministic: v }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setHighlightedComponent: (id) => set({ highlightedComponentId: id }),
  setFixApplied: (v) => set({ fixApplied: v }),
  setSceneComponents: (c) => set({ sceneComponents: c }),
  setShowNode: (v) => set({ showNode: v }),
  setActiveWarning: (w) => set({ activeWarning: w }),
  setDemoStep: (step) => set({ currentStep: step }),

  reset: () => set({ ...initialState, bom: [], gbaRoute: [] }),
}))

;(useProjectStore as unknown as { getInitialState: () => typeof initialState }).getInitialState = () => ({
  ...initialState,
  bom: [],
  gbaRoute: [],
})
