import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router'
import { api, mediaUrl } from '../../api/client'
import {
  recordLearningEvent,
  type LearningContentDetail,
  type LearningIdentity,
  type LearningQuestion,
  type WatchContext,
  type WatchResult,
} from '../../api/learning'
import { QuizView } from '../../shared/QuizView'
import { Button } from '../../shared/ui'
import { useContentViewer } from './useContentViewer'
import type { WatchNavigationState } from './types'

interface ContentViewerProps {
  identity: LearningIdentity
  detail: LearningContentDetail
  question: LearningQuestion | null | undefined
  questionError: Error | null
  retryQuestion: () => void
  context: WatchContext
  backTo: string
  backLabel: string
  nextTo?: string
  nextState?: WatchNavigationState
  recommendationLabel?: string
  onNext?: () => void | Promise<void>
  onPrevious?: () => void
  onWatchReport?: (result: WatchResult) => void
  navigationTime?: { current: number }
  navigationPending?: boolean
  nextLabel?: string
}

export function ContentViewer({
  identity,
  detail,
  question,
  questionError,
  retryQuestion,
  context,
  backTo,
  backLabel,
  nextTo,
  nextState,
  recommendationLabel,
  onNext,
  onPrevious,
  onWatchReport,
  navigationTime,
  navigationPending = false,
  nextLabel = '다음 영상 →',
}: ContentViewerProps) {
  const content = detail.content
  const queryClient = useQueryClient()
  const player = useRef<HTMLVideoElement>(null)
  const main = useRef<HTMLDivElement>(null)
  const moving = useRef(false)
  const localNavigationTime = useRef(0)
  const [navigating, setNavigating] = useState(false)
  const [ended, setEnded] = useState(false)
  const [openedQuestion, setOpenedQuestion] = useState<LearningQuestion | null>(null)
  const [tab, setTab] = useState<'core' | 'quiz'>('core')
  const [playError, setPlayError] = useState(false)
  const [eventError, setEventError] = useState('')
  const [playErrorId] = useState(() => crypto.randomUUID())
  const watch = useContentViewer({
    identity,
    contentId: content.content_id,
    mediaRevision: content.media_revision!,
    duration: content.video_duration!,
    context,
    onReport: onWatchReport,
  })
  const flushWatch = watch.flush
  const move = useCallback(
    async (direction: 'next' | 'previous') => {
      const action = direction === 'next' ? onNext : onPrevious
      if (!action || moving.current || navigationPending) return
      moving.current = true
      setNavigating(true)
      try {
        player.current?.pause()
        // 현재 방문 보고가 완료된 뒤에 복기 간격을 평가한다.
        if (await flushWatch(player.current ?? undefined)) await action()
      } finally {
        moving.current = false
        setNavigating(false)
      }
    },
    [flushWatch, onNext, onPrevious, navigationPending],
  )
  useEffect(() => {
    if (context !== 'FEED') return
    const area = main.current
    if (!area) return
    const lastMove = navigationTime ?? localNavigationTime
    const interactive = (target: EventTarget | null) =>
      target instanceof Element &&
      Boolean(
        target.closest(
          'button, a, input, textarea, select, video, [contenteditable="true"], [role="radio"], [role="tab"]',
        ),
      )
    const keyboard = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        interactive(event.target) ||
        (event.target instanceof Node &&
          event.target !== document.body &&
          !area.contains(event.target))
      )
        return
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
      event.preventDefault()
      if (event.repeat) return
      void move(event.key === 'ArrowDown' ? 'next' : 'previous')
    }
    const wheel = (event: WheelEvent) => {
      if (
        event.ctrlKey ||
        event.defaultPrevented ||
        interactive(event.target) ||
        Math.abs(event.deltaY) < 40 ||
        Math.abs(event.deltaX) > Math.abs(event.deltaY)
      )
        return
      // 세로로 스크롤해야 하는 좁은 화면은 페이지 스크롤을 우선한다.
      if (area.getBoundingClientRect().height > window.innerHeight) return
      event.preventDefault()
      if (Date.now() - lastMove.current < 800) return
      lastMove.current = Date.now()
      void move(event.deltaY > 0 ? 'next' : 'previous')
    }
    window.addEventListener('keydown', keyboard)
    area.addEventListener('wheel', wheel, { passive: false })
    return () => {
      window.removeEventListener('keydown', keyboard)
      area.removeEventListener('wheel', wheel)
    }
  }, [context, move, navigationTime])
  const reaction = useMutation({
    mutationFn: async ({ kind, on }: { kind: 'like' | 'saved'; on: boolean }) => {
      await api(`/users/${identity.learnerId}/contents/${content.content_id}/${kind}`, {
        method: on ? 'PUT' : 'DELETE',
        ...identity,
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries()
    },
  })
  const reportPlayError = async () => {
    try {
      await recordLearningEvent(identity, playErrorId, {
        event_type: 'PLAY_ERROR',
        content_id: content.content_id,
        error_code: 'VIDEO_PLAYBACK_FAILED',
      })
      setEventError('')
    } catch (cause) {
      setEventError(cause instanceof Error ? cause.message : '재생 오류를 기록하지 못했어요.')
    }
  }
  // 처음 퀴즈를 보여 줄 때 버전을 고정하고 같은 영상 방문에서는 풀이를 유지한다.
  // 탭 전환이나 영상 다시보기, 배경 재조회로 새 attempt를 만들지 않는다.
  if (!openedQuestion && ended && tab === 'quiz' && question) setOpenedQuestion(question)

  // 한 줄 정리와 핵심 정리가 같은 내용이면 한 번만 표시한다.
  const summary = (detail.one_line_summary ?? '').trim()
  const core = (detail.core_content ?? '').trim()
  const showCore = core !== '' && core !== summary

  return (
    <div className="sasu-page sasu-feed">
      <div className="sasu-feed__main" ref={main}>
        <div className="sasu-feed__bar">
          <Link className="sasu-link" to={backTo}>
            {backLabel}
          </Link>
          <span className="sasu-eyebrow">{context === 'FEED' ? '추천 피드' : '영상 학습'}</span>
        </div>
        <header className="sasu-feed__head">
          <h1 className="sasu-title">{content.title ?? '제목 없음'}</h1>
          <p className="sasu-sub">
            {content.category?.name ?? '미지정'} ·{' '}
            {content.tags.map((tag) => `#${tag.name}`).join(' ')}
          </p>
          {recommendationLabel ? <p className="sasu-sub">{recommendationLabel}</p> : null}
        </header>
        <div className="sasu-feed__stage">
          <div className="sasu-player">
            <video
              ref={player}
              src={mediaUrl(content.video_url!)}
              controls
              playsInline
              preload="metadata"
              aria-label={content.title ?? '학습 영상'}
              style={{
                display: 'block',
                width: '100%',
                maxHeight: 500,
                aspectRatio: '9 / 16',
                background: '#0f172a',
                borderRadius: 14,
              }}
              onPlay={() => {
                setPlayError(false)
              }}
              onPlaying={(event) => watch.onPlay(event.currentTarget)}
              onWaiting={(event) => watch.onWaiting(event.currentTarget)}
              onRateChange={(event) => watch.onRateChange(event.currentTarget)}
              onTimeUpdate={(event) => watch.onTimeUpdate(event.currentTarget)}
              onPause={(event) => watch.onPause(event.currentTarget)}
              onSeeking={watch.onSeeking}
              onSeeked={(event) => watch.onSeeked(event.currentTarget)}
              onEnded={(event) => {
                watch.onEnded(event.currentTarget)
                setEnded(true)
                setTab('quiz')
              }}
              onError={() => {
                setPlayError(true)
                void reportPlayError()
              }}
            >
              브라우저에서 영상 재생을 지원하지 않습니다.
            </video>
          </div>
        </div>
        {playError ? (
          <div className="sasu-card" role="alert">
            <p>영상을 재생하지 못했어요.</p>
            <Button
              onClick={() => {
                player.current?.load()
                setPlayError(false)
              }}
            >
              다시 불러오기
            </Button>
            <Link className="sasu-link" to="/learner/search">
              다른 영상 찾기
            </Link>
          </div>
        ) : null}
        {eventError ? <p role="alert">오류 기록: {eventError}</p> : null}
        <div className="sasu-row">
          <div className="sasu-actions">
            <button
              type="button"
              className={`sasu-action sasu-action--like ${content.liked ? 'is-on' : ''}`}
              aria-pressed={content.liked ?? false}
              aria-label="좋아요"
              disabled={reaction.isPending}
              onClick={() => reaction.mutate({ kind: 'like', on: !content.liked })}
            >
              <span className="sasu-action__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="20" height="20">
                  <path d="M12 21s-7.5-4.6-10-9.3C.4 8.4 2 5 5.2 5c2 0 3.3 1.1 4.2 2.4h1.2C11.5 6.1 12.8 5 14.8 5 18 5 19.6 8.4 18 11.7 15.5 16.4 12 21 12 21z" />
                </svg>
              </span>
              <span className="sasu-action__count">{content.like_count}</span>
            </button>
            <button
              type="button"
              className={`sasu-action sasu-action--icon-only sasu-action--save ${content.saved ? 'is-on' : ''}`}
              aria-pressed={content.saved ?? false}
              aria-label={content.saved ? '보관함에 저장됨' : '보관함에 저장'}
              disabled={reaction.isPending}
              onClick={() => reaction.mutate({ kind: 'saved', on: !content.saved })}
            >
              <span className="sasu-action__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="20" height="20">
                  <path d="M6 3h12a1 1 0 0 1 1 1v16l-7-4-7 4V4a1 1 0 0 1 1-1z" />
                </svg>
              </span>
            </button>
          </div>
          {onNext ? (
            <div className="sasu-row">
              <Button
                disabled={!onPrevious || navigating || navigationPending}
                onClick={() => void move('previous')}
              >
                이전 영상
              </Button>
              <Button loading={navigating || navigationPending} onClick={() => void move('next')}>
                {nextLabel}
              </Button>
            </div>
          ) : nextTo ? (
            <Link className="sasu-link" to={nextTo} state={nextState}>
              다음 영상 →
            </Link>
          ) : null}
        </div>
        <p className="sasu-sub sasu-watchmeta">
          <span>조회 {watch.result?.view_count ?? content.view_count}</span>
          {watch.result?.watch_completed || content.watch_completed ? (
            <span className="sasu-badge sasu-badge--green">✓ 시청 완료</span>
          ) : (
            <span className="sasu-badge">시청 중</span>
          )}
        </p>
        {reaction.isError ? <p role="alert">{reaction.error.message}</p> : null}
        {watch.error ? (
          <div role="alert">
            <p>시청 기록: {watch.error}</p>
            <Button size="sm" onClick={watch.retry}>
              기록 다시 저장
            </Button>
          </div>
        ) : null}
      </div>
      <aside className="sasu-lp" aria-label="학습 패널">
        <div className="sasu-lp__head">
          <h2 className="sasu-lp__title">영상과 함께 학습해요</h2>
        </div>
        <div className="sasu-lp__tabs" role="tablist" aria-label="학습 자료">
          {(['core', 'quiz'] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              className={`sasu-lp__tab ${tab === value ? 'is-active' : ''}`}
              onClick={() => setTab(value)}
            >
              {value === 'core' ? '핵심 정리' : '퀴즈'}
            </button>
          ))}
        </div>
        <div className="sasu-lp__body">
          {tab === 'core' ? (
            <>
              {summary ? (
                <div className="sasu-lp__oneline">
                  <span className="sasu-lp__label">한 줄 정리</span>
                  <p>{summary}</p>
                </div>
              ) : null}
              {showCore ? (
                <div>
                  <span className="sasu-lp__label">핵심 정리</span>
                  <p style={{ whiteSpace: 'pre-wrap', margin: '4px 0 0' }}>{core}</p>
                </div>
              ) : null}
              {!summary && !core ? <p className="sasu-muted">등록된 핵심 정리가 없어요.</p> : null}
              {detail.related_curriculums.length ? (
                <div>
                  <span className="sasu-lp__label">관련 학습</span>
                  <ul className="sasu-lp__related-list">
                    {detail.related_curriculums.map((item) => (
                      <li key={item.curriculum_id}>
                        <Link to={`/learner/series/${item.curriculum_id}`}>{item.title}</Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {detail.caution_enabled ? (
                <div className="sasu-lp__caution" role="note">
                  <p className="sasu-lp__caution-title">실무 용어 해석 주의</p>
                  <p>{detail.caution_text}</p>
                </div>
              ) : null}
            </>
          ) : null}
          <div hidden={tab !== 'quiz'}>
            {questionError && !openedQuestion ? (
              <div role="alert">
                <p>{questionError.message}</p>
                <Button onClick={retryQuestion}>문항 다시 불러오기</Button>
              </div>
            ) : null}
            {openedQuestion ? (
              <QuizView
                identity={identity}
                question={openedQuestion}
                responsePath="VIDEO_QUIZ"
                footer={(result) => (
                  <div className="sasu-row">
                    {result === 'WRONG' ? (
                      <Link
                        className="sasu-link"
                        to={`/learner/review/${content.content_id}?questionVersionId=${openedQuestion.question_version_id}`}
                      >
                        오답 복습
                      </Link>
                    ) : null}
                    {onNext ? (
                      <Button
                        loading={navigating || navigationPending}
                        onClick={() => void move('next')}
                      >
                        {nextLabel}
                      </Button>
                    ) : (
                      <Link
                        className="sasu-link"
                        to={nextTo ?? backTo}
                        state={nextTo ? nextState : undefined}
                      >
                        {nextTo ? '다음 영상 →' : backLabel}
                      </Link>
                    )}
                  </div>
                )}
              />
            ) : question === undefined ? (
              <p role="status">문항을 불러오는 중이에요.</p>
            ) : question === null ? (
              <p>등록된 퀴즈가 없어요. 영상 학습을 마치고 다음으로 이동할 수 있어요.</p>
            ) : !ended ? (
              <p>영상을 끝까지 보면 퀴즈가 열려요. 시청 완료와 끝 도달은 따로 기록돼요.</p>
            ) : null}
          </div>
        </div>
        <div className="sasu-lp__foot">
          <span className="sasu-lp__foot-item">
            <span className="sasu-lp__foot-label">출처</span>
            {detail.source || '미등록'}
          </span>
          <span className="sasu-lp__foot-item">
            <span className="sasu-lp__foot-label">검토일</span>
            {detail.reviewed_on || '미등록'}
          </span>
        </div>
      </aside>
    </div>
  )
}
