import { create } from 'zustand'
import type {
  ChatMessage,
  ChatToolCall,
  ConversationState,
  ContextGateState,
  ViewMode,
  DemoStep,
  BOMRow,
  ContextField,
  SimulationWarning,
  Component3D,
  PipelineStageName,
  GbaRouteDisplayStep,
  McpToolCallUI,
  SourceRefreshState,
  SimulationState,
} from './types'
import type { PipelineState } from './pipeline/types'

type ProjectStore = {
  messages: ChatMessage[]
  isStreaming: boolean
  addMessage: (msg: ChatMessage) => void
  upsertToolCallMessage: (toolCall: ChatToolCall) => void
  appendToLastMessage: (chunk: string) => void
  setStreaming: (v: boolean) => void
  contextGate: ContextGateState | null
  setContextGate: (state: ContextGateState | null) => void
  conversationState: ConversationState
  setConversationState: (state: ConversationState) => void

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
  mcpToolCalls: McpToolCallUI[]
  sourceRefresh: SourceRefreshState
  simulation: SimulationState
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
  setMcpToolCalls: (calls: McpToolCallUI[]) => void
  setSourceRefresh: (state: SourceRefreshState) => void
  setSimulation: (state: Partial<SimulationState>) => void
  resetSimulation: () => void

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
  contextGate: null as ContextGateState | null,
  conversationState: 'awaiting_context' as ConversationState,
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
  mcpToolCalls: [] as McpToolCallUI[],
  sourceRefresh: { status: 'idle', message: 'Seeded sources' } as SourceRefreshState,
  simulation: {
    status: 'idle',
    scenario: 'catastrophic',
    currentStep: 0,
    totalSteps: 0,
    activeStressAction: 'none',
    deviceFailureProb: 0,
    risksByComponent: {},
    error: null,
  } as SimulationState,
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

  upsertToolCallMessage: (toolCall) =>
    set((s) => {
      const existingIndex = s.messages.findIndex(
        (msg) => msg.type === 'tool-call' && msg.toolCall?.id === toolCall.id
      )
      const message: ChatMessage = {
        id: `tool-${toolCall.id}`,
        type: 'tool-call',
        content: '',
        timestamp: toolCall.startedAt,
        toolCall,
      }

      if (existingIndex === -1) {
        return { messages: [...s.messages, message] }
      }

      const messages = [...s.messages]
      const previousToolCall = messages[existingIndex].toolCall
      const definedPatch = Object.fromEntries(
        Object.entries(toolCall).filter(([, value]) => value !== undefined)
      ) as Partial<ChatToolCall>
      messages[existingIndex] = {
        ...messages[existingIndex],
        toolCall: {
          ...previousToolCall,
          ...definedPatch,
          startedAt: previousToolCall?.startedAt ?? toolCall.startedAt,
        } as ChatToolCall,
      }
      return { messages }
    }),

  appendToLastMessage: (chunk) =>
    set((s) => {
      const msgs = [...s.messages]
      if (msgs.length === 0) return s
      const last = msgs[msgs.length - 1]
      msgs[msgs.length - 1] = { ...last, content: last.content + chunk }
      return { messages: msgs }
    }),

  setStreaming: (v) => set({ isStreaming: v }),
  setContextGate: (contextGate) => set({ contextGate }),
  setConversationState: (conversationState) => set({ conversationState }),
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
  setMcpToolCalls: (calls) => set({ mcpToolCalls: calls }),
  setSourceRefresh: (sourceRefresh) => set({ sourceRefresh }),
  setSimulation: (patch) => set((s) => ({ simulation: { ...s.simulation, ...patch } })),
  resetSimulation: () => set({ simulation: initialState.simulation }),
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
