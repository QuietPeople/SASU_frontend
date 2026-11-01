import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router'
import { api, mediaUrl } from '../../api/client'
import { invalidateLearnerReaction } from '../../api/queryInvalidation'
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

// 스와이프로 넘어온 방향을 다음 화면이 이어받아 들어오는 애니메이션에 쓴다.
let enterFrom: 'below' | 'above' | null = null

function isNavigationControl(target: EventTarget | null) {
  return (
    target instanceof Element &&
    Boolean(
      target.closest(
        'button, a, input, textarea, select, [contenteditable="true"], [role="radio"], [role="tab"], .sasu-lp',
      ),
    )
  )
}

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
  prevTo?: string
  nextState?: WatchNavigationState
  listIndex?: number
  listTotal?: number
  recommendationLabel?: string
  onNext?: () => void | Promise<void>
  onPrevious?: () => void
  onWatchReport?: (result: WatchResult) => void
  navigationTime?: RefObject<number>
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
  prevTo,
  nextState,
  listIndex,
  listTotal,
  recommendationLabel,
  onNext,
  onPrevious,
  onWatchReport,
  navigationTime: navigationTimeRef,
  navigationPending = false,
  nextLabel = '다음 ↓',
}: ContentViewerProps) {
  const content = detail.content
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const player = useRef<HTMLVideoElement>(null)
  const main = useRef<HTMLDivElement>(null)
  const moving = useRef(false)
  const localNavigationTime = useRef(0)
  const [navigating, setNavigating] = useState(false)
  const [ended, setEnded] = useState(false)
  const [openedQuestion, setOpenedQuestion] = useState<LearningQuestion | null>(null)
  const [tab, setTab] = useState<'core' | 'quiz'>('core')
  const [playError, setPlayError] = useState(false)
  const [playErrorId] = useState(() => crypto.randomUUID())
  const [panelOpen, setPanelOpen] = useState(true)
  const [toast, setToast] = useState<{ text: string; id: number } | null>(null)

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 1600)
    return () => window.clearTimeout(timer)
  }, [toast])
  const [entering] = useState<'below' | 'above' | null>(enterFrom)
  useEffect(() => {
    enterFrom = null
  }, [])

  // 나가는 방향(전환 애니메이션용)
  const [exit, setExit] = useState<'up' | 'down' | null>(null)
  const touchStart = useRef<{ x: number; y: number } | null>(null)

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
  // 제스처와 방향키도 버튼과 같은 피드 이동·시청 보고 흐름을 사용한다.
  const go = useCallback(
    (direction: 'next' | 'previous') => {
      if (openedQuestion || moving.current || navigationPending) return
      const action = direction === 'next' ? onNext : onPrevious
      const to = direction === 'next' ? nextTo : prevTo
      if (!action && !to) return
      const now = Date.now()
      const lastMove = navigationTimeRef?.current ?? localNavigationTime.current
      if (now - lastMove < 800) return
      if (navigationTimeRef) navigationTimeRef.current = now
      else localNavigationTime.current = now

      if (action) {
        void move(direction)
        return
      }
      enterFrom = direction === 'next' ? 'below' : 'above'
      setExit(direction === 'next' ? 'up' : 'down')
      window.setTimeout(() => navigate(to!, { state: nextState }), 160)
    },
    [
      openedQuestion,
      navigationPending,
      onNext,
      onPrevious,
      nextTo,
      prevTo,
      navigationTimeRef,
      move,
      navigate,
      nextState,
    ],
  )

  const onTouchStart = (event: React.TouchEvent) => {
    touchStart.current =
      !event.defaultPrevented && event.touches.length === 1 && !isNavigationControl(event.target)
        ? { x: event.touches[0].clientX, y: event.touches[0].clientY }
        : null
  }
  const onTouchEnd = (event: React.TouchEvent) => {
    const start = touchStart.current
    touchStart.current = null
    const end = event.changedTouches[0]
    if (!start || !end || event.defaultPrevented || event.touches.length) return
    const moved = start.y - end.clientY
    if (Math.abs(moved) < 50 || Math.abs(end.clientX - start.x) > Math.abs(moved)) return
    go(moved > 0 ? 'next' : 'previous')
  }

  useEffect(() => {
    const area = main.current
    if (!area) return
    const keyboard = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        openedQuestion ||
        isNavigationControl(event.target) ||
        (event.target instanceof Element && event.target.closest('video')) ||
        (event.target instanceof Node &&
          event.target !== document.body &&
          !area.contains(event.target))
      )
        return
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
      event.preventDefault()
      if (event.repeat) return
      go(event.key === 'ArrowDown' ? 'next' : 'previous')
    }
    const wheel = (event: WheelEvent) => {
      if (
        event.ctrlKey ||
        event.defaultPrevented ||
        openedQuestion ||
        isNavigationControl(event.target) ||
        Math.abs(event.deltaY) < 40 ||
        Math.abs(event.deltaX) > Math.abs(event.deltaY)
      )
        return
      const overPlayer = event.target instanceof Element && event.target.closest('.sasu-player')
      // 영상 밖에서는 기존 추천 피드의 휠 이동 범위와 페이지 스크롤을 유지한다.
      if (
        !overPlayer &&
        (context !== 'FEED' || area.getBoundingClientRect().height > window.innerHeight)
      )
        return
      event.preventDefault()
      go(event.deltaY > 0 ? 'next' : 'previous')
    }
    window.addEventListener('keydown', keyboard)
    area.addEventListener('wheel', wheel, { passive: false })
    return () => {
      window.removeEventListener('keydown', keyboard)
      area.removeEventListener('wheel', wheel)
    }
  }, [context, go, openedQuestion])
  const reaction = useMutation({
    mutationFn: async ({ kind, on }: { kind: 'like' | 'saved'; on: boolean }) => {
      await api(`/users/${identity.learnerId}/contents/${content.content_id}/${kind}`, {
        method: on ? 'PUT' : 'DELETE',
        ...identity,
      })
    },
    onSuccess: (_, { kind, on }) => {
      setToast({
        text:
          kind === 'saved'
            ? on
              ? '보관함에 저장했어요'
              : '보관함에서 뺐어요'
            : on
              ? '좋아요를 눌렀어요'
              : '좋아요를 취소했어요',
        id: Date.now(),
      })
      return invalidateLearnerReaction(queryClient, identity, content.content_id, kind)
    },
  })
  const playErrorReport = useMutation({
    mutationFn: () =>
      recordLearningEvent(identity, playErrorId, {
        event_type: 'PLAY_ERROR',
        content_id: content.content_id,
        error_code: 'VIDEO_PLAYBACK_FAILED',
      }),
  })
  // 처음 퀴즈를 보여 줄 때 버전을 고정하고 같은 영상 방문에서는 풀이를 유지한다.
  // 탭 전환이나 영상 다시보기, 배경 재조회로 새 attempt를 만들지 않는다.
  if (!openedQuestion && ended && tab === 'quiz' && question) setOpenedQuestion(question)

  // 한 줄 정리와 핵심 정리가 같은 내용이면 한 번만 표시한다.
  const summary = (detail.one_line_summary ?? '').trim()
  const core = (detail.core_content ?? '').trim()
  const showCore = core !== '' && core !== summary

  const watched = watch.result?.watch_completed || content.watch_completed
  const motion =
    exit === 'up'
      ? 'is-exit-up'
      : exit === 'down'
        ? 'is-exit-down'
        : entering === 'below'
          ? 'is-enter-below'
          : entering === 'above'
            ? 'is-enter-above'
            : ''

  return (
    <div className={`sasu-page sasu-feed ${panelOpen ? '' : 'is-lp-closed'}`}>
      <div className={`sasu-feed__main ${motion}`} ref={main}>
        <div className="sasu-feed__bar">
          <Link className="sasu-backlink" to={backTo}>
            ← {backLabel.replace(/^←\s*/, '')}
          </Link>
          <span className="sasu-ctxchip">
            {context === 'FEED' ? '추천 피드' : '영상 학습'}
            {recommendationLabel ? ` · ${recommendationLabel}` : ''}
          </span>
        </div>
        <header className="sasu-feed__head">
          <h1 className="sasu-title">{content.title ?? '제목 없음'}</h1>
          <div className="sasu-metaline">
            <span className="sasu-metaline__cat">{content.category?.name ?? '미지정'}</span>
            {content.tags.map((tag) => (
              <span className="sasu-metaline__tag" key={tag.name}>
                #{tag.name}
              </span>
            ))}
          </div>
        </header>
        <div className="sasu-feed__stage">
          <div
            className="sasu-player"
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
            onTouchCancel={() => {
              touchStart.current = null
            }}
          >
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
                maxHeight: 'min(640px, 70vh)',
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
                playErrorReport.mutate()
              }}
            >
              브라우저에서 영상 재생을 지원하지 않습니다.
            </video>

            {/* 영상 안 좌상단: 조회수·시청 상태 */}
            <div className="sasu-ov-top">
              {listIndex && listTotal ? (
                <span className="sasu-ov-pill sasu-ov-pill--idx">
                  {listIndex} / {listTotal}
                </span>
              ) : null}
              <span className="sasu-ov-pill">
                조회 {watch.result?.view_count ?? content.view_count}
              </span>
              <span className={`sasu-ov-pill ${watched ? 'sasu-ov-pill--done' : ''}`}>
                {watched ? '✓ 시청 완료' : '시청 중'}
              </span>
            </div>

            {/* 영상 안 우측: 좋아요·저장·학습 패널 토글 */}
            <div className="sasu-ov">
              <div className="sasu-ov__item">
                <button
                  type="button"
                  className={`sasu-ov__btn sasu-ov__btn--like ${content.liked ? 'is-on' : ''}`}
                  aria-pressed={content.liked ?? false}
                  aria-label="좋아요"
                  disabled={reaction.isPending}
                  onClick={() => reaction.mutate({ kind: 'like', on: !content.liked })}
                >
                  <svg viewBox="0 0 24 24" width="22" height="22">
                    <path d="M12 21s-7.5-4.6-10-9.3C.4 8.4 2 5 5.2 5c2 0 3.3 1.1 4.2 2.4h1.2C11.5 6.1 12.8 5 14.8 5 18 5 19.6 8.4 18 11.7 15.5 16.4 12 21 12 21z" />
                  </svg>
                </button>
                <span className="sasu-ov__count">{content.like_count}</span>
              </div>
              <div className="sasu-ov__item">
                <button
                  type="button"
                  className={`sasu-ov__btn sasu-ov__btn--save ${content.saved ? 'is-on' : ''}`}
                  aria-pressed={content.saved ?? false}
                  aria-label={content.saved ? '보관함에 저장됨' : '보관함에 저장'}
                  disabled={reaction.isPending}
                  onClick={() => reaction.mutate({ kind: 'saved', on: !content.saved })}
                >
                  <svg viewBox="0 0 24 24" width="22" height="22">
                    <path d="M6 3h12a1 1 0 0 1 1 1v16l-7-4-7 4V4a1 1 0 0 1 1-1z" />
                  </svg>
                </button>
                <span className="sasu-ov__count">저장</span>
              </div>
              <div className="sasu-ov__item">
                <button
                  type="button"
                  className="sasu-ov__btn"
                  aria-expanded={panelOpen}
                  aria-label={panelOpen ? '학습 패널 접기' : '학습 패널 펴기'}
                  onClick={() => setPanelOpen((open) => !open)}
                >
                  <svg viewBox="0 0 24 24" width="22" height="22">
                    <path d={panelOpen ? 'M9 6l6 6-6 6' : 'M15 6l-6 6 6 6'} />
                  </svg>
                </button>
                <span className="sasu-ov__count">학습</span>
              </div>
            </div>
          </div>
        </div>
        {onNext || nextTo || prevTo ? (
          <p className="sasu-swipehint">
            {openedQuestion
              ? '퀴즈를 푸는 중에는 아래 버튼으로 이동해요'
              : '영상 위에서 위아래로 스와이프하면 다른 영상으로 넘어가요'}
          </p>
        ) : null}
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
        {playErrorReport.isError ? (
          <p role="alert">오류 기록: {playErrorReport.error.message}</p>
        ) : null}
        {onNext ? (
          <div className="sasu-row sasu-feed__nav">
            <Button
              disabled={!onPrevious || navigating || navigationPending}
              onClick={() => void move('previous')}
            >
              ↑ 이전
            </Button>
            <Button loading={navigating || navigationPending} onClick={() => void move('next')}>
              {nextLabel}
            </Button>
          </div>
        ) : prevTo || nextTo ? (
          <div className="sasu-row sasu-feed__nav">
            {prevTo ? (
              <Link className="sasu-link" to={prevTo} state={nextState}>
                ↑ 이전
              </Link>
            ) : null}
            {nextTo ? (
              <Link className="sasu-link" to={nextTo} state={nextState}>
                다음 ↓
              </Link>
            ) : null}
          </div>
        ) : null}
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
      <aside className="sasu-lp" aria-label="학습 패널" hidden={!panelOpen}>
        <div className="sasu-lp__head">
          <h2 className="sasu-lp__title">영상과 함께 학습해요</h2>
          <button
            type="button"
            className="sasu-lp__fold"
            onClick={() => setPanelOpen(false)}
            aria-label="학습 패널 접기"
          >
            접기
          </button>
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
                <div className="sasu-lp__sec">
                  <span className="sasu-lp__label">핵심 정리</span>
                  <p className="sasu-lp__core">{core}</p>
                </div>
              ) : null}
              {!summary && !core ? <p className="sasu-muted">등록된 핵심 정리가 없어요.</p> : null}
              {detail.related_curriculums.length ? (
                <div className="sasu-lp__sec">
                  <span className="sasu-lp__label">관련 학습</span>
                  <ul className="sasu-lp__related-list">
                    {detail.related_curriculums.map((item) => (
                      <li key={item.curriculum_id}>
                        <Link to={`/learner/series/${item.curriculum_id}`}>
                          <span className="sasu-lp__rel-ic" aria-hidden="true">
                            ▶
                          </span>
                          <span className="sasu-lp__rel-t">{item.title}</span>
                          <span className="sasu-lp__rel-go" aria-hidden="true">
                            ›
                          </span>
                        </Link>
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
                        {nextTo ? '다음 영상 ↓' : backLabel}
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
        <dl className="sasu-lp__foot">
          <div className="sasu-lp__foot-item">
            <dt className="sasu-lp__foot-label">출처</dt>
            <dd className="sasu-lp__foot-value">{detail.source || '미등록'}</dd>
          </div>
          <div className="sasu-lp__foot-item">
            <dt className="sasu-lp__foot-label">검토일</dt>
            <dd className="sasu-lp__foot-value">{detail.reviewed_on || '미등록'}</dd>
          </div>
        </dl>
      </aside>
      {toast ? (
        <p className="sasu-toast" role="status">
          <span className="sasu-toast__ic" aria-hidden="true">
            ✓
          </span>
          {toast.text}
        </p>
      ) : null}
    </div>
  )
}
