import { useEffect, useEffectEvent, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { FlashcardPreview } from '../../shared/FlashcardPreview'
import type { FlashcardStyle } from '../../shared/useFlashcardStyle'
import {
  getFlashcardAnswer,
  learningKey,
  recordLearningEvent,
  type LearningIdentity,
} from '../../api/learning'
import type { VideoDirection } from '../content-viewer/viewerSession'
import { SwipeScene } from '../content-viewer/SwipeScene'
import type { PendingFeedReview } from './session'
import './feed-review-card.css'

interface FeedReviewCardProps {
  identity: LearningIdentity
  card: PendingFeedReview
  style: FlashcardStyle
  onReady: () => void
  onFlip: (id: string, flipped: boolean) => void
  onNavigate: (direction: VideoDirection) => void
}

export function FeedReviewCard({
  identity,
  card,
  style,
  onReady,
  onFlip,
  onNavigate,
}: FeedReviewCardProps) {
  const [swiping, setSwiping] = useState(false)
  const [reveal, setReveal] = useState(card.flipped)
  const ready = useEffectEvent(onReady)
  const viewed = useMutation({
    mutationFn: () =>
      recordLearningEvent(identity, card.viewEventId, {
        event_type: 'FLASHCARD_VIEWED',
        content_id: card.question.content_id,
        question_version_id: card.question.question_version_id,
      }),
  })
  const logView = viewed.mutate
  useEffect(() => {
    ready()
    logView()
  }, [logView])

  const answer = useQuery({
    queryKey: learningKey(identity, 'feed-card-answer', card.id),
    queryFn: ({ signal }) =>
      getFlashcardAnswer(identity, card.question.question_version_id, signal),
    enabled: reveal,
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
  })
  const flipped = useMutation({
    mutationFn: () =>
      recordLearningEvent(identity, card.flipEventId, {
        event_type: 'FLASHCARD_FLIPPED',
        content_id: card.question.content_id,
        question_version_id: card.question.question_version_id,
      }),
  })
  const logFlip = flipped.mutate
  const showBack = reveal && answer.isSuccess
  const rememberFlip = useEffectEvent(() => onFlip(card.id, showBack))
  useEffect(() => {
    if (showBack) logFlip()
    if (!reveal || showBack) rememberFlip()
  }, [showBack, reveal, logFlip])

  return (
    <SwipeScene
      review
      onInteraction={setSwiping}
      onNavigate={async (direction) => {
        onNavigate(direction)
        return true
      }}
      media={
        <div className="sasu-player feed-review__surface" role="region" aria-label="피드 복기 카드">
          <FlashcardPreview
            question={card.question.question_text}
            answer={answer.data?.back ?? ''}
            isOX={card.question.question_type === 'OX'}
            style={style}
            flipped={showBack}
            disabled={swiping || (reveal && answer.isPending)}
            onFlip={() => {
              if (swiping) return
              setReveal((old) => !old)
            }}
          />
          {reveal && answer.isPending ? (
            <p className="feed-review__notice" role="status">
              정답을 불러오는 중이에요.
            </p>
          ) : null}
          {reveal && answer.isError ? (
            <div className="feed-review__notice" role="alert" data-interactive>
              <p>정답을 불러오지 못했어요.</p>
              <button onClick={() => void answer.refetch()}>다시 시도</button>
            </div>
          ) : null}
          {viewed.isError || flipped.isError ? (
            <div className="feed-review__notice" role="alert" data-interactive>
              <p>카드 학습 기록을 저장하지 못했어요.</p>
              <button
                onClick={() => {
                  if (viewed.isError) logView()
                  if (flipped.isError) logFlip()
                }}
              >
                기록 다시 저장
              </button>
            </div>
          ) : null}
        </div>
      }
    />
  )
}
