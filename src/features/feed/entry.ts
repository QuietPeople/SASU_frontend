import { getFeed, type Feed, type FeedItem, type FeedPosition } from '../../api/feed'
import { getLearningContent, type LearningContent, type LearningIdentity } from '../../api/learning'
import type { FeedSession } from './session'

export type FeedDisplayItem = Pick<FeedItem, 'content' | 'recommendation_label'>
export interface FeedEntry {
  items: FeedDisplayItem[]
  initialContentId: number | null
  explicitStart: boolean
  resumeUnavailable: boolean
}

export function createFeedEntry(
  feed: Feed,
  position: FeedPosition,
  selected?: LearningContent,
): FeedEntry {
  const candidates: FeedDisplayItem[] = selected
    ? [{ content: selected, recommendation_label: '검색에서 선택한 영상' }, ...feed.items]
    : feed.items
  const seen = new Set<number>()
  const items = candidates.filter((item) => {
    const id = item.content.content_id
    if (seen.has(id)) return false
    seen.add(id)
    return true
  })
  const resumeId =
    position.resume_available &&
    position.last_content_id !== null &&
    seen.has(position.last_content_id)
      ? position.last_content_id
      : null
  return {
    items,
    initialContentId: selected?.content_id ?? resumeId ?? items[0]?.content.content_id ?? null,
    explicitStart: selected !== undefined,
    resumeUnavailable: selected === undefined && feed.resume_unavailable,
  }
}

export async function getFeedEntry(
  identity: LearningIdentity,
  startContentId?: number,
  signal?: AbortSignal,
) {
  const { feed, position } = await getFeed(identity, signal)
  const selected =
    startContentId === undefined
      ? undefined
      : (feed.items.find((item) => item.content.content_id === startContentId)?.content ??
        (await getLearningContent(identity, startContentId, signal)).content)
  return createFeedEntry(feed, position, selected)
}

export function feedSessionAtEntry(state: FeedSession, explicitStart: boolean): FeedSession {
  // 검색에서 직접 고른 영상은 이전에 열어 둔 복기보다 우선한다. 누적 학습·복기 기록은 유지한다.
  return explicitStart && state.pending ? { ...state, pending: null } : state
}
