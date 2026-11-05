import type { PendingFeedReview } from './session'

export type FeedSlide =
  | { key: string; kind: 'video'; contentId: number }
  | { key: string; kind: 'review'; card: PendingFeedReview }
  | { key: 'end'; kind: 'end' }

export function feedSlides(
  contentIds: number[],
  cards: PendingFeedReview[],
  pending: PendingFeedReview | null,
): FeedSlide[] {
  const slides: FeedSlide[] = []
  contentIds.forEach((contentId, index) => {
    slides.push({ key: `video:${contentId}`, kind: 'video', contentId })
    const next = contentIds[index + 1] ?? null
    const card = cards.find(
      (item) => item.previousContentId === contentId && item.nextContentId === next,
    )
    if (card) slides.push({ key: `review:${card.id}`, kind: 'review', card })
  })
  // 새 추천 목록에서 이전 방문의 카드가 빠져도 이미 열린 복기를 끝낼 수 있게 한다.
  if (pending && !slides.some((item) => item.key === `review:${pending.id}`))
    slides.push({ key: `review:${pending.id}`, kind: 'review', card: pending })
  slides.push({ key: 'end', kind: 'end' })
  return slides
}
