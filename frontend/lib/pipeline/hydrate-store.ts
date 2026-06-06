import type { PipelineState } from './types'
import {
  bomToUI,
  deploymentContextToFields,
  formatNodeTitle,
  primaryWarningToUI,
  rfqQuestionsToUI,
  sceneToUI,
} from './to-ui'
import { useProjectStore } from '../store'

export function hydrateStoreFromPipeline(state: PipelineState) {
  const s = useProjectStore.getState()
  const warning = primaryWarningToUI(state)

  s.setContextFields(deploymentContextToFields(state.deploymentContext))
  s.setBOM(bomToUI(state))
  s.setBomTotal(state.bom.total_cost_usd)
  s.setBaselineBomTotal(state.baselineBomTotal)
  s.setSceneComponents(sceneToUI(state.scene.nodes))
  s.setRfqQuestions(rfqQuestionsToUI(state))
  s.setGbaRoute(state.gbaRouteDisplay)
  s.setProjectTitle(formatNodeTitle(state.componentGraph.node_type))
  s.setPipelineState(state)
  s.setUsedDeterministic(state.usedDeterministic)
  s.setShowNode(state.scene.nodes.length > 0)
  s.setShowSuppliers(state.rfq.gba_route.length > 0)

  if (warning) {
    s.setActiveWarning(warning)
    if (state.fixApplied) s.setFixApplied(true)
  }

  if (state.fixApplied) {
    s.setDemoStep(8)
  } else if (state.dfma.warnings.length > 0) {
    s.setDemoStep(5)
  } else if (state.rfq.gba_route.length > 0) {
    s.setDemoStep(7)
  }
}

export function pipelineStageToDemoStep(stage: string): 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 {
  switch (stage) {
    case 'context':
      return 1
    case 'components':
      return 2
    case 'scene':
      return 3
    case 'bom':
      return 4
    case 'dfma':
      return 5
    case 'rfq':
      return 7
    default:
      return 0
  }
}
