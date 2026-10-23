import type { WatchContext } from '../../api/learning'

export interface WatchNavigationState {
  context: WatchContext
  returnTo: string
  contentIds: number[]
  curriculumId?: number
}
