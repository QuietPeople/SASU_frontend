import { api, queryString, type ApiPage } from '../../api/client'
import type { LearningIdentity, WrongAnswer } from '../../api/learning'

export async function reviewTargets(
  identity: LearningIdentity,
  contentId: number,
  versionId: number | null,
  category: number | undefined,
  signal?: AbortSignal,
  q = '',
) {
  let target: WrongAnswer | undefined
  let firstOther: WrongAnswer | undefined
  for (let page = 1; ; page += 1) {
    const result = await api<ApiPage<WrongAnswer>>(
      `/users/${identity.learnerId}/reviews/wrong-answers${queryString({ page, size: 100, status: 'PENDING', category_id: category, q: q.trim() || undefined })}`,
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
