import { useQuery } from '@tanstack/react-query'
import { FlashcardPreview } from '../../admin/FlashcardPreview'
import type { FlashcardStyle } from '../../admin/useFlashcardStyle'
import { getFlashcardAnswer, learningKey, type LearningIdentity } from '../../api/learning'
import type { PendingFeedReview } from './session'
import './feed-review-card.css'

export function FeedCardPreview({
  identity,
  card,
  style,
}: {
  identity: LearningIdentity
  card: PendingFeedReview
  style: FlashcardStyle
}) {
  const answer = useQuery({
    queryKey: learningKey(identity, 'feed-card-answer', card.id),
    queryFn: ({ signal }) =>
      getFlashcardAnswer(identity, card.question.question_version_id, signal),
    enabled: card.flipped,
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
  })
  return (
    <div className="sasu-player feed-review__surface">
      <FlashcardPreview
        question={card.question.question_text}
        answer={answer.data?.back ?? ''}
        isOX={card.question.question_type === 'OX'}
        style={style}
        flipped={card.flipped && answer.isSuccess}
        disabled
      />
    </div>
  )
}
