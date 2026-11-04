import { createContext, type Dispatch, type SetStateAction } from 'react'
import type { VideoDirection } from './viewerSession'

export interface SwipeSceneHandlers {
  navigate: (direction: VideoDirection) => Promise<boolean>
  interaction: (active: boolean) => void
}

export interface MaterialPanelState {
  open: boolean
  tab: 'core' | 'quiz'
}

export const SwipeContext = createContext<{
  media: HTMLDivElement | null
  extras: HTMLDivElement | null
  panel: HTMLDivElement | null
  materialPanel: MaterialPanelState
  setMaterialPanel: Dispatch<SetStateAction<MaterialPanelState>>
  bind: (handlers: SwipeSceneHandlers) => () => void
  setAppearance: (appearance: { hasPanel: boolean; panelPending: boolean; review: boolean }) => void
} | null>(null)
