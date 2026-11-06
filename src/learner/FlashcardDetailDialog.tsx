import { FeedbackProvider } from '../shared/FeedbackProvider'
import { ErrorFeedback } from '../shared/ErrorFeedback'
import { Skeleton } from '../shared/Skeleton'
import { useEffect, useId, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  getFlashcardAnswer,
  learningKey,
  recordLearningEvent,
  type LearningFlashcard,
  type LearningIdentity,
} from '../api/learning'
import { Flashcard } from '../shared/Flashcard'
import type { FlashcardStyle } from '../shared/useFlashcardStyle'

export function FlashcardDetailDialog({
  card,
  identity,
  style,
  onClose,
  onOpenVideo,
}: {
  card: LearningFlashcard
  identity: LearningIdentity
  style: FlashcardStyle
  onClose: () => void
  onOpenVideo: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const backdropDown = useRef(false)
  const titleId = useId()
  const viewStarted = useRef(false)
  const flipStarted = useRef(false)
  const [events] = useState(() => ({ view: crypto.randomUUID(), flip: crypto.randomUUID() }))
  const [reveal, setReveal] = useState(false)
  const viewed = useMutation({
    mutationFn: () =>
      recordLearningEvent(identity, events.view, {
        event_type: 'FLASHCARD_VIEWED',
        content_id: card.content_id,
        question_version_id: card.question_version_id,
      }),
  })
  const logView = viewed.mutate
  useEffect(() => {
    if (viewStarted.current) return
    viewStarted.current = true
    logView()
  }, [logView])
  const answer = useQuery({
    queryKey: learningKey(identity, 'card-answer', card.question_version_id, events.flip),
    queryFn: ({ signal }) => getFlashcardAnswer(identity, card.question_version_id, signal),
    enabled: reveal,
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
  })
  const flipped = useMutation({
    mutationFn: () =>
      recordLearningEvent(identity, events.flip, {
        event_type: 'FLASHCARD_FLIPPED',
        content_id: card.content_id,
        question_version_id: card.question_version_id,
      }),
  })
  const logFlip = flipped.mutate
  useEffect(() => {
    if (!reveal || !answer.isSuccess || flipStarted.current) return
    flipStarted.current = true
    logFlip()
  }, [reveal, answer.isSuccess, logFlip])
  useEffect(() => {
    const dialog = dialogRef.current!
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.showModal()
    closeRef.current?.focus({ preventScroll: true })
    return () => {
      dialog.close()
      document.body.style.overflow = overflow
      if (previous?.isConnected) previous.focus({ preventScroll: true })
    }
  }, [])
  return (
    <dialog
      ref={dialogRef}
      className="learner-flashcard-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onPointerDown={(event) => {
        backdropDown.current = event.target === event.currentTarget
      }}
      onClick={(event) => {
        if (backdropDown.current && event.target === event.currentTarget) onClose()
      }}
    >
      <FeedbackProvider>
        <header className="learner-flashcard-dialog__header">
          <div>
            <p>보관함</p>
            <h2 id={titleId}>플래시카드 복습</h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="learner-flashcard-dialog__close"
            aria-label="플래시카드 닫기"
            onClick={onClose}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </header>
        <div className="learner-flashcard-dialog__body">
          <div className="learner-flashcard-dialog__card">
            <Flashcard
              question={card.front}
              answer={answer.data?.back ?? ''}
              isOX={answer.data?.back === 'O' || answer.data?.back === 'X'}
              style={style}
              flipped={reveal && answer.isSuccess}
              disabled={reveal && answer.isPending}
              onFlip={() => setReveal((value) => !value)}
            />
            {reveal && answer.isPending && (
              <div className="learner-flashcard-dialog__loading" role="status">
                <Skeleton variant="text" label="정답을 불러오는 중" />
              </div>
            )}
          </div>
          <div className="learner-flashcard-dialog__info">
            <section className="learner-flashcard-dialog__source" aria-label="원본영상 정보">
              <div className="learner-flashcard-dialog__source-top">
                <span>{card.category.name}</span>
                <button
                  type="button"
                  className="learner-flashcard-dialog__video"
                  onClick={onOpenVideo}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <rect x="3" y="4" width="18" height="16" rx="4" />
                    <path d="m10 8 6 4-6 4z" />
                  </svg>
                  원본영상
                </button>
              </div>
              <h3>{card.content_title}</h3>
            </section>
            <section className="learner-flashcard-dialog__explanation" aria-label="정답 해설">
              <h3>
                <span aria-hidden="true">A</span>정답 해설
              </h3>
              <div aria-live="polite">
                {reveal && answer.isSuccess ? (
                  <p className="learner-flashcard-dialog__copy">
                    {answer.data.explanation || '등록된 해설이 없어요.'}
                  </p>
                ) : reveal && answer.isError ? (
                  <ErrorFeedback
                    title="정답과 해설을 불러오지 못했어요."
                    error={answer.error}
                    action={
                      <button type="button" onClick={() => void answer.refetch()}>
                        다시 시도
                      </button>
                    }
                  />
                ) : reveal ? (
                  <Skeleton variant="text" label="해설 불러오는 중" />
                ) : (
                  <p className="learner-flashcard-dialog__hint">
                    카드를 뒤집으면 해설을 확인할 수 있어요.
                  </p>
                )}
              </div>
            </section>
            {(viewed.isError || flipped.isError) && (
              <ErrorFeedback
                title="학습 기록을 저장하지 못했어요."
                error={viewed.error ?? flipped.error}
                action={
                  <button
                    type="button"
                    onClick={() => {
                      if (viewed.isError) logView()
                      if (flipped.isError) logFlip()
                    }}
                  >
                    기록 다시 저장
                  </button>
                }
              />
            )}
          </div>
        </div>
      </FeedbackProvider>
    </dialog>
  )
}
