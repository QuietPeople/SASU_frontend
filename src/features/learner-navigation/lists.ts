import type { QueryClient } from '@tanstack/react-query'
import { api, queryString, type ApiPage } from '../../api/client'
import {
  learningKey,
  type LearningFlashcard,
  type LearningIdentity,
  type WrongAnswer,
} from '../../api/learning'

export function cardPageKey(
  identity: LearningIdentity,
  category: number | undefined,
  page: number,
) {
  return learningKey(identity, 'flashcards', 'page', category, page)
}

export async function locateCard(
  cache: QueryClient,
  identity: LearningIdentity,
  category: number | undefined,
  page: number,
  versionId: number | null,
  signal?: AbortSignal,
) {
  const prefix = learningKey(identity, 'flashcards', 'page', category)
  if (versionId !== null) {
    for (const [, data] of cache.getQueriesData<ApiPage<LearningFlashcard>>({ queryKey: prefix }))
      if (data?.items.some((item) => item.question_version_id === versionId)) {
        page = data.page
        break
      }
  }
  const requestedPage = page
  let scannedFromStart = page === 1
  while (true) {
    signal?.throwIfAborted()
    const result = await cache.fetchQuery({
      queryKey: cardPageKey(identity, category, page),
      queryFn: ({ signal: pageSignal }) =>
        api<ApiPage<LearningFlashcard>>(
          `/users/${identity.learnerId}/reviews/flashcards${queryString({ page, size: 20, category_id: category })}`,
          { actorId: identity.actorId, signal: pageSignal },
        ),
      staleTime: 30_000,
    })
    signal?.throwIfAborted()
    if (versionId === null || result.items.some((item) => item.question_version_id === versionId))
      return result
    if (!scannedFromStart && page === requestedPage) {
      page = 1
      scannedFromStart = true
      continue
    }
    if (!result.has_next) return result
    page += 1
  }
}

export async function reviewTargets(
  identity: LearningIdentity,
  contentId: number,
  versionId: number | null,
  category: number | undefined,
  signal?: AbortSignal,
) {
  let target: WrongAnswer | undefined
  let firstOther: WrongAnswer | undefined
  for (let page = 1; ; page += 1) {
    const result = await api<ApiPage<WrongAnswer>>(
      `/users/${identity.learnerId}/reviews/wrong-answers${queryString({ page, size: 100, status: 'PENDING', category_id: category })}`,
      { actorId: identity.actorId, signal },
    )
    for (const item of result.items) {
      if (
        item.content.content_id === contentId &&
        (versionId === null || item.question.question_version_id === versionId)
      ) {
        target = item
      } else if (item.content.content_id !== contentId) {
        firstOther ??= item
        if (target) return { target, next: item }
      }
    }
    // 끝에 도달했거나 현재 문항이 해결되어 빠졌으면 남은 목록의 처음부터 이어간다.
    if (!result.has_next) return { target, next: firstOther }
  }
}
