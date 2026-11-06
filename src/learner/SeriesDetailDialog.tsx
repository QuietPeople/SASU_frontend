import { FeedbackProvider } from '../shared/FeedbackProvider'
import { Skeleton } from '../shared/Skeleton'
import { useEffect, useId, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { api, queryString } from '../api/client'
import type { CurriculumDetail, CurriculumStep } from '../api/learner'
import { Thumbnail } from '../shared/Thumbnail'
import { useSession } from '../state/session'
import { LearnerState } from './LearnerState'
import { Button } from './ui'

export function SeriesDetailDialog({
  id,
  listQuery,
  onClose,
}: {
  id: number
  listQuery: string
  onClose: () => void
}) {
  const { actorId, learnerId, generation } = useSession()
  const navigate = useNavigate()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const backdropDown = useRef(false)
  const titleId = useId()
  const validId = Number.isSafeInteger(id) && id > 0
  const enabled = actorId !== null && learnerId !== null
  const detail = useQuery({
    queryKey: ['learner', 'curriculum', actorId, learnerId, generation, id],
    queryFn: ({ signal }) =>
      api<CurriculumDetail>(
        `/curriculums/${id}${queryString({ view: 'learner', user_id: learnerId })}`,
        { actorId, signal },
      ),
    enabled: enabled && validId,
  })
  const selected = detail.data
  const resumeStep =
    selected?.steps.find((step) => step.available && !step.completed) ??
    selected?.steps.find((step) => step.available)
  const openStep = (contentId: number) => {
    if (
      !selected ||
      !selected.steps.some((step) => step.content_id === contentId && step.available)
    )
      return
    navigate(`/learner/watch/${contentId}`, {
      state: {
        context: 'CURRICULUM',
        curriculumId: selected.summary.curriculum_id,
        returnTo: `/learner/series/${id}${listQuery ? `?${listQuery}` : ''}`,
        contentIds: selected.steps.filter((step) => step.available).map((step) => step.content_id),
      },
    })
  }
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
      previous?.focus({ preventScroll: true })
    }
  }, [])

  return (
    <dialog
      ref={dialogRef}
      className="learner-series-dialog"
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
        <header className="learner-series-dialog__header">
          <div>
            <p>시리즈 · 학습 내용</p>
            <h2 id={titleId}>{selected?.summary.title ?? '시리즈 학습 내용'}</h2>
          </div>
          <button
            ref={closeRef}
            className="learner-series-dialog__close"
            type="button"
            aria-label="시리즈 학습 내용 닫기"
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
        <div className="learner-series-dialog__body">
          {!validId ? (
            <LearnerState title="올바른 시리즈를 선택해 주세요." />
          ) : !enabled ? (
            <LearnerState title="학습자를 선택해 주세요." />
          ) : detail.isPending ? (
            <div className="learner-series__loading">
              <Skeleton variant="list" label="시리즈 학습 내용을 불러오는 중" />
            </div>
          ) : detail.error ? (
            <LearnerState
              title="학습 내용을 불러오지 못했어요."
              error={detail.error}
              action={<Button onClick={() => void detail.refetch()}>다시 시도</Button>}
            />
          ) : selected ? (
            <>
              <section className="learner-series-dialog__summary" aria-label="시리즈 학습 진행률">
                <Thumbnail
                  className="learner-series-dialog__cover"
                  src={selected.summary.thumbnail_url}
                  refreshKey={detail.dataUpdatedAt}
                />
                <div className="learner-series-dialog__overview">
                  <div className="learner-series-dialog__meta">
                    <span>영상 {selected.summary.total_steps}개</span>
                    <span>학습 가능 {selected.summary.available_steps}개</span>
                  </div>
                  {selected.summary.description && (
                    <p className="learner-series-dialog__description">
                      {selected.summary.description}
                    </p>
                  )}
                  <div className="learner-series-dialog__progress">
                    <div>
                      <span>
                        학습 완료 <strong>{selected.summary.completed_steps ?? '—'}</strong> /{' '}
                        {selected.summary.total_steps}
                      </span>
                      <strong>{selected.summary.progress_percent ?? '—'}%</strong>
                    </div>
                    <progress
                      max={100}
                      value={selected.summary.progress_percent ?? undefined}
                      aria-label="시리즈 학습 진행률"
                    />
                  </div>
                </div>
              </section>
              <section className="learner-series-dialog__curriculum" aria-label="시리즈 영상 목록">
                <div className="learner-series-dialog__section-head">
                  <h3>
                    학습 순서 <span>{selected.steps.length}</span>
                  </h3>
                  <p>원하는 영상부터 학습할 수 있어요.</p>
                </div>
                {!selected.steps.length ? (
                  <LearnerState title="아직 등록된 영상이 없어요." />
                ) : (
                  <ol className="learner-series-dialog__steps">
                    {selected.steps.map((step) => (
                      <SeriesStep
                        key={step.curriculum_content_id}
                        step={step}
                        refreshKey={detail.dataUpdatedAt}
                        onOpen={() => openStep(step.content_id)}
                      />
                    ))}
                  </ol>
                )}
                <p className="learner-series-dialog__criteria">
                  단계 완료는 시청 90% 이상과 해당 문항 정답을 함께 충족해야 해요.
                </p>
              </section>
            </>
          ) : null}
        </div>
        <footer className="learner-series-dialog__footer">
          {resumeStep && !detail.error ? (
            <>
              <div className="learner-series-dialog__next">
                <span>
                  {resumeStep.completed ? '다시 볼 영상' : '다음 학습'} ·{' '}
                  {String(resumeStep.step_order).padStart(2, '0')}
                </span>
                <strong>{resumeStep.content?.title ?? '학습 영상'}</strong>
              </div>
              <Button variant="primary" onClick={() => openStep(resumeStep.content_id)}>
                {resumeStep.completed
                  ? '다시 학습하기'
                  : selected?.steps.some((step) => step.watch_completed || step.question_correct)
                    ? '이어서 학습하기'
                    : '학습 시작하기'}
              </Button>
            </>
          ) : (
            <>
              <p>
                {selected && !detail.error
                  ? '현재 학습할 수 있는 영상이 없어요.'
                  : '시리즈 목록으로 돌아갈 수 있어요.'}
              </p>
              <Button onClick={onClose}>닫기</Button>
            </>
          )}
        </footer>
      </FeedbackProvider>
    </dialog>
  )
}

function SeriesStep({
  step,
  refreshKey,
  onOpen,
}: {
  step: CurriculumStep
  refreshKey: number
  onOpen: () => void
}) {
  const status = !step.available
    ? '이용 불가'
    : step.completed === null
      ? '기록 없음'
      : step.completed
        ? '학습 완료'
        : step.watch_completed || step.question_correct
          ? '학습 중'
          : '학습 전'
  return (
    <li
      className={`learner-series-step${!step.available ? ' learner-series-step--unavailable' : ''}`}
    >
      <span className="learner-series-step__number">
        {String(step.step_order).padStart(2, '0')}
      </span>
      <Thumbnail src={step.content?.thumbnail_url} refreshKey={refreshKey} />
      <div className="learner-series-step__info">
        {step.content?.category && (
          <span className="learner-series-step__category">{step.content.category.name}</span>
        )}
        <h4>{step.content?.title ?? '이용할 수 없는 영상'}</h4>
        <div className="learner-series-step__records">
          <span data-complete={step.watch_completed || undefined}>
            시청{' '}
            {step.watch_completed === null ? '기록 없음' : step.watch_completed ? '완료' : '미완료'}
          </span>
          <span data-complete={step.question_correct || undefined}>
            {!step.content?.has_quiz
              ? '퀴즈 없음'
              : step.question_correct === null
                ? '퀴즈 기록 없음'
                : step.question_correct
                  ? '퀴즈 정답'
                  : '퀴즈 미완료'}
          </span>
        </div>
      </div>
      <div className="learner-series-step__actions">
        <span
          className="learner-series-step__status"
          data-complete={(step.available && step.completed) || undefined}
        >
          {status}
        </span>
        <Button size="sm" disabled={!step.available} onClick={onOpen}>
          {step.completed ? '다시 보기' : '영상 보기'}
        </Button>
      </div>
    </li>
  )
}
