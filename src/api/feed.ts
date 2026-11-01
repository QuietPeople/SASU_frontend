import { ApiError, api, GENERATION_MISMATCH_EVENT } from './client'
import type { LearningContent, LearningIdentity, LearningQuestion } from './learning'

export interface FeedItem {
  content: LearningContent
  recommendation_reason:
    'LAST_CONTENT' | 'INTEREST_CATEGORY' | 'RELATED_TAG' | 'UNWATCHED' | 'LATEST'
  recommendation_label: string
}
export interface Feed {
  items: FeedItem[]
  resume_unavailable: boolean
  record_generation: number
}
export interface FeedPosition {
  user_id: number
  last_content_id: number | null
  resume_available: boolean
  record_generation: number
}
export interface FeedCandidate {
  candidate: LearningQuestion | null
  record_generation: number
}

function currentGeneration<T extends { record_generation: number }>(
  result: T,
  identity: LearningIdentity,
): T {
  if (result.record_generation !== identity.generation) {
    window.dispatchEvent(new CustomEvent(GENERATION_MISMATCH_EVENT))
    throw new ApiError(
      409,
      'RECORD_GENERATION_MISMATCH',
      '학습 기록이 변경되었어요. 현재 정보를 다시 확인해 주세요.',
    )
  }
  return result
}

export async function getFeed(identity: LearningIdentity, signal?: AbortSignal) {
  const options = { actorId: identity.actorId, signal }
  const [feed, position] = await Promise.all([
    api<Feed>(`/users/${identity.learnerId}/feed`, options),
    api<FeedPosition>(`/users/${identity.learnerId}/feed-state`, options),
  ])
  return {
    feed: currentGeneration(feed, identity),
    position: currentGeneration(position, identity),
  }
}

export async function saveFeedPosition(identity: LearningIdentity, contentId: number) {
  return currentGeneration(
    await api<FeedPosition>(`/users/${identity.learnerId}/feed-state`, {
      method: 'PATCH',
      ...identity,
      body: { last_content_id: contentId },
    }),
    identity,
  )
}

export async function getFeedCandidate(
  identity: LearningIdentity,
  shown: number[],
  retry: number[],
  signal?: AbortSignal,
) {
  if (shown.length > 1000 || retry.length > 1000) {
    throw new ApiError(
      422,
      'REVIEW_SESSION_LIMIT',
      '이 창의 복기 이용 한도에 도달했어요. 새 창에서 이어서 학습해 주세요.',
    )
  }
  return currentGeneration(
    await api<FeedCandidate>(`/users/${identity.learnerId}/reviews/feed/candidate`, {
      method: 'POST',
      actorId: identity.actorId,
      signal,
      body: { shown_question_version_ids: shown, retry_question_version_ids: retry },
    }),
    identity,
  )
}
