import {
  useCallback,
  useContext,
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router'
import { api } from '../../api/client'
import { invalidateLearnerReaction } from '../../api/queryInvalidation'
import {
  learningKey,
  recordLearningEvent,
  type LearningContentDetail,
  type LearningIdentity,
  type LearningQuestion,
  type WatchContext,
  type WatchResult,
} from '../../api/learning'
import { QuizView } from '../../learner/QuizView'
import { Button } from '../../learner/ui'
import { useContentViewer } from './useContentViewer'
import { FeedVideoPlayer } from './FeedVideoPlayer'
import { bindVideoPlayback, type PlaybackIntent } from './videoPlayback'
import type { WatchNavigationState } from './types'
import type { CurriculumDetail } from '../../api/learner'
import type { ViewerSession, VideoDirection } from './viewerSession'
import { SwipeScene } from './SwipeScene'
import { SwipeContext } from './swipeContext'
import { BufferedVideoContext } from './bufferedVideoContext'
import { bindActiveVideoEvents, type ActiveVideoEvent } from './videoBuffer'
import './content-viewer.css'
import './panel-quiz.css'

interface ContentViewerProps {
  playback: ViewerSession
  series?: {
    data: CurriculumDetail | undefined
    loading: boolean
    error: Error | null
    retry: () => void
    path: (contentId: number) => string
  }
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
  onNext?: () => void | boolean | Promise<void | boolean>
  onPrevious?: () => void
  onWatchReport?: (result: WatchResult) => void
  prepareNext?: () => Promise<(() => void) | false>
  navigationPending?: boolean
}

export function ContentViewer({
  playback,
  series,
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
  prepareNext,
  navigationPending = false,
}: ContentViewerProps) {
  const viewport = useContext(SwipeContext)
  if (!viewport) throw new Error('ContentViewer에는 SwipeViewport가 필요합니다.')
  const { materialPanel, setMaterialPanel } = viewport
  const { open: panelOpen, tab } = materialPanel
  const setPanelOpen = (open: boolean) => setMaterialPanel((previous) => ({ ...previous, open }))
  const setTab = (tab: 'core' | 'quiz') => setMaterialPanel((previous) => ({ ...previous, tab }))
  const content = detail.content
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const bufferedVideo = useContext(BufferedVideoContext)
  if (!bufferedVideo) throw new Error('ContentViewer에는 준비된 영상 요소가 필요합니다.')
  const player = useRef(bufferedVideo)
  const moving = useRef(false)
  const dragging = useRef(false)
  const [swiping, setSwiping] = useState(false)
  const [navigating, setNavigating] = useState(false)
  const [openedQuestion, setOpenedQuestion] = useState<LearningQuestion | null>(null)
  const [playError, setPlayError] = useState(false)
  const [playErrorId] = useState(() => crypto.randomUUID())
  const firstPlaybackEnded = useRef(false)
  const [playPrompt, setPlayPrompt] = useState(false)
  const [playbackIntent, setPlaybackIntent] = useState<PlaybackIntent>('play')
  const [navigationError, setNavigationError] = useState('')
  const panelId = useId()
  const panelToggle = useRef<HTMLButtonElement>(null)
  const tabButtons = useRef<(HTMLButtonElement | null)[]>([])
  const active = useRef(true)
  const videoPlayback = useRef<ReturnType<typeof bindVideoPlayback> | null>(null)
  const resumePlayback = useCallback(() => {
    void videoPlayback.current?.resume()
  }, [])

  const closePanel = () => {
    setPanelOpen(false)
    panelToggle.current?.focus({ preventScroll: true })
  }
  const previousPanel = useRef(materialPanel)
  useEffect(() => {
    const previous = previousPanel.current
    previousPanel.current = materialPanel
    // 영상 교체로 열린 패널을 복원할 때는 방향키 포커스를 빼앗지 않는다.
    if (!panelOpen || (previous.open && previous.tab === tab)) return
    tabButtons.current[tab === 'core' ? 0 : 1]?.focus({ preventScroll: true })
  }, [materialPanel, panelOpen, tab])

  const [toast, setToast] = useState<{ text: string; id: number } | null>(null)

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 1600)
    return () => window.clearTimeout(timer)
  }, [toast])
  const watch = useContentViewer({
    identity,
    contentId: content.content_id,
    mediaRevision: content.media_revision!,
    duration: content.video_duration!,
    context,
    onReport: onWatchReport,
  })
  const flushWatch = watch.flush
  const transition = useCallback(
    async (action: () => void | boolean | Promise<void | boolean>) => {
      if (moving.current || navigationPending) return false
      moving.current = true
      setNavigating(true)
      setNavigationError('')
      let advanced = false
      try {
        videoPlayback.current?.suspend()
        // 추천·목록·시리즈 이동 모두 현재 방문 보고가 끝난 뒤에 진행한다.
        if (!(await flushWatch(player.current ?? undefined)) || !active.current) return false
        advanced = (await action()) !== false
        return advanced
      } catch {
        if (active.current)
          setNavigationError('다음 화면으로 이동하지 못했어요. 다시 시도해 주세요.')
        return false
      } finally {
        if (active.current) {
          moving.current = false
          setNavigating(false)
          if (!advanced) {
            resumePlayback()
          }
        }
      }
    },
    [flushWatch, navigationPending, resumePlayback],
  )
  const move = (direction: VideoDirection) =>
    transition(async () => {
      const to = direction === 'next' ? nextTo : prevTo
      const navigateTo = to ? () => navigate(to, { state: nextState }) : undefined
      const action = direction === 'next' ? (onNext ?? navigateTo) : (onPrevious ?? navigateTo)
      // 이번 보고로 복기 간격에 도달할 수 있으므로 flush 이후에 다음 항목을 확정한다.
      const commit = direction === 'next' && prepareNext ? await prepareNext() : action
      if (!commit || !active.current) return false
      return commit()
    })
  const onSwipeInteraction = (interacting: boolean) => {
    dragging.current = interacting
    setSwiping(interacting)
  }
  const likeRequestPending = useRef(false)
  const reaction = useMutation({
    mutationFn: async ({ kind, on }: { kind: 'like' | 'saved'; on: boolean }) => {
      const path = `/users/${identity.learnerId}/contents/${content.content_id}/${kind}`
      const options = {
        method: on ? ('PUT' as const) : ('DELETE' as const),
        ...identity,
      }
      if (kind === 'like')
        return api<{ content_id: number; liked: boolean; like_count: number }>(path, options)
      await api(path, options)
      return null
    },
    onSuccess: (result, { kind, on }) => {
      if (kind === 'like' && result) {
        // 재조회가 늦거나 실패해도 서버가 확정한 좋아요 상태로 중복 요청을 막는다.
        queryClient.setQueryData<LearningContentDetail>(
          learningKey(identity, 'content', content.content_id),
          (previous) =>
            previous ? { ...previous, content: { ...previous.content, ...result } } : previous,
        )
      }
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
    onSettled: (_, __, { kind }) => {
      if (kind === 'like') likeRequestPending.current = false
    },
  })
  const currentLiked = () =>
    queryClient.getQueryData<LearningContentDetail>(
      learningKey(identity, 'content', content.content_id),
    )?.content.liked ?? content.liked
  const requestLike = (on: boolean) => {
    if (moving.current || navigationPending || reaction.isPending || likeRequestPending.current)
      return
    likeRequestPending.current = true
    reaction.mutate({ kind: 'like', on })
  }
  const toggleLike = () => requestLike(!currentLiked())
  const likeFromGesture = () => {
    if (!currentLiked()) requestLike(true)
  }
  const togglePlayback = () => {
    if (moving.current || dragging.current || navigationPending || playError) return
    videoPlayback.current?.toggle()
  }
  const playErrorReport = useMutation({
    mutationFn: () =>
      recordLearningEvent(identity, playErrorId, {
        event_type: 'PLAY_ERROR',
        content_id: content.content_id,
        error_code: 'VIDEO_PLAYBACK_FAILED',
      }),
  })
  const handleVideoEvent = useEffectEvent((type: ActiveVideoEvent) => {
    const video = player.current
    switch (type) {
      case 'play':
        setPlayError(false)
        setPlayPrompt(false)
        break
      case 'volumechange':
        playback.update({ muted: video.muted, volume: video.volume })
        break
      case 'playing':
        watch.onPlay(video)
        break
      case 'waiting':
        watch.onWaiting(video)
        break
      case 'ratechange':
        watch.onRateChange(video)
        break
      case 'timeupdate':
        watch.onTimeUpdate(video)
        break
      case 'pause':
        watch.onPause(video)
        break
      case 'seeking':
        watch.onSeeking()
        break
      case 'seeked':
        watch.onSeeked(video)
        break
      case 'ended':
        watch.onEnded(video)
        if (active.current && !moving.current && !navigationPending) {
          if (!firstPlaybackEnded.current) {
            firstPlaybackEnded.current = true
            setTab(question === null ? 'core' : 'quiz')
            setPanelOpen(true)
          }
          video.currentTime = 0
          resumePlayback()
        }
        break
      case 'error':
        setPlayError(true)
        playErrorReport.mutate()
        break
    }
  })
  useEffect(() => {
    return bindActiveVideoEvents(player.current, handleVideoEvent)
  }, [])
  useEffect(() => {
    active.current = true
    const video = player.current
    if (video) {
      if (video.currentTime !== 0) video.currentTime = 0
      video.muted = playback.read().muted
      video.volume = playback.read().volume
      videoPlayback.current = bindVideoPlayback(video, {
        canPlay: () => active.current && !moving.current,
        onBlocked: () => setPlayPrompt(true),
        onIntentChange: setPlaybackIntent,
      })
      resumePlayback()
    }
    return () => {
      active.current = false
      videoPlayback.current?.dispose()
      videoPlayback.current = null
    }
  }, [playback, resumePlayback])
  // 퀴즈 탭을 처음 열 때 문항 버전을 고정하며 영상 종료를 기다리지 않는다.
  // 자동 반복·탭 전환·배경 재조회에서도 풀이를 유지한다.
  if (!openedQuestion && panelOpen && tab === 'quiz' && question) {
    setOpenedQuestion(question)
  }

  // 한 줄 정리와 핵심 정리가 같은 내용이면 한 번만 표시한다.
  const summary = (detail.one_line_summary ?? '').trim()
  const core = (detail.core_content ?? '').trim()
  const showCore = core !== '' && core !== summary
  // 짧은 내용은 위로 모으고, 긴 내용은 표시 중인 필드별 높이 상한 안에서 스크롤한다.
  const materialWeights = [
    summary && 'var(--material-summary-share)',
    showCore && 'var(--material-core-share)',
    !summary && !core && '1',
    detail.related_curriculums.length > 0 && 'var(--material-related-share)',
    detail.caution_enabled && '1.4',
  ].filter(Boolean)

  const watched = watch.result?.watch_completed || content.watch_completed

  return (
    <SwipeScene
      onNavigate={move}
      onInteraction={onSwipeInteraction}
      media={
        <FeedVideoPlayer
          disabled={swiping || navigating || navigationPending || playError}
          playPrompt={playPrompt}
          pausedByUser={playbackIntent === 'pause'}
          onTogglePlayback={togglePlayback}
          onLike={likeFromGesture}
        >
          <header className="sasu-feed__head">
            <h1 className="sasu-title">{content.title ?? '제목 없음'}</h1>
            <div className="content-viewer__metadata">
              <div className="sasu-metaline">
                <span className="sasu-metaline__cat">{content.category?.name ?? '미지정'}</span>
                {content.tags.map((tag) => (
                  <span className="sasu-metaline__tag" key={tag.name}>
                    #{tag.name}
                  </span>
                ))}
              </div>
              <span className="content-viewer__views">
                조회수 {watch.result?.view_count ?? content.view_count}
              </span>
            </div>
          </header>
          {playError ? (
            <div className="content-viewer__error" role="alert">
              <p>영상을 재생하지 못했어요.</p>
              <Button
                onClick={() => {
                  player.current?.load()
                  setPlayError(false)
                  resumePlayback()
                }}
              >
                다시 불러오기
              </Button>
              <Link className="sasu-link" to={backTo}>
                {backLabel.replace(/^←\s*/, '')}
              </Link>
            </div>
          ) : null}
          <div className="sasu-ov-top">
            <div className="content-viewer__status">
              {listIndex && listTotal ? (
                <span className="sasu-ov-pill sasu-ov-pill--idx">
                  {listIndex} / {listTotal}
                </span>
              ) : null}
              <span className="sasu-ov-pill">{watched ? '시청 완료' : '시청 전'}</span>
            </div>
            {recommendationLabel || context !== 'FEED' ? (
              <div className="content-viewer__recommendation">
                {recommendationLabel || (context === 'CURRICULUM' ? '시리즈 학습' : '영상 학습')}
              </div>
            ) : null}
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
                onClick={toggleLike}
              >
                <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78Z" />
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
                className={`sasu-ov__btn sasu-ov__btn--materials ${panelOpen ? 'is-on' : ''}`}
                ref={panelToggle}
                aria-controls={panelId}
                aria-expanded={panelOpen}
                aria-label={panelOpen ? '학습자료 접기' : '학습자료 펼치기'}
                onClick={() => {
                  if (panelOpen) closePanel()
                  else setPanelOpen(true)
                }}
              >
                <svg
                  className="content-viewer__materials-icon"
                  viewBox="0 0 24 24"
                  width="22"
                  height="22"
                  aria-hidden="true"
                >
                  <path d="M3 4.5c3.2-1.2 6-.7 9 1.2v15c-3-1.9-5.8-2.4-9-1.2zM21 4.5c-3.2-1.2-6-.7-9 1.2v15c3-1.9 5.8-2.4 9-1.2z" />
                </svg>
              </button>
              <span className="sasu-ov__count">학습자료</span>
            </div>
          </div>
        </FeedVideoPlayer>
      }
      panel={
        <>
          <button
            type="button"
            className="content-viewer__panel-backdrop"
            aria-label="학습자료 닫기"
            aria-hidden={!panelOpen}
            inert={!panelOpen}
            onClick={closePanel}
          />
          <aside
            id={panelId}
            className="sasu-lp"
            aria-label="학습자료"
            aria-hidden={!panelOpen}
            inert={!panelOpen}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.stopPropagation()
                closePanel()
              }
            }}
          >
            <div className="sasu-lp__head">
              <h2 className="sasu-lp__title">학습자료</h2>
            </div>
            {series ? (
              <details className="content-viewer__series">
                <summary>
                  시리즈 학습 순서{' '}
                  <span>{listIndex ? `${listIndex} / ${listTotal ?? 1}` : '목록 보기'}</span>
                </summary>
                {series.loading ? <p role="status">학습 순서를 불러오는 중이에요.</p> : null}
                {series.error ? (
                  <div role="alert">
                    <p>학습 순서를 불러오지 못했어요.</p>
                    <Button size="sm" onClick={series.retry}>
                      다시 시도
                    </Button>
                  </div>
                ) : null}
                {series.data ? (
                  <>
                    <h3>{series.data.summary.title}</h3>
                    <ol>
                      {[...series.data.steps]
                        .sort((a, b) => a.step_order - b.step_order)
                        .map((step) => (
                          <li key={step.curriculum_content_id}>
                            <button
                              type="button"
                              aria-current={
                                step.content_id === content.content_id ? 'step' : undefined
                              }
                              disabled={
                                !step.available || !step.content || navigating || navigationPending
                              }
                              onClick={() => {
                                if (step.content_id === content.content_id) return
                                void transition(() =>
                                  navigate(series.path(step.content_id), { state: nextState }),
                                )
                              }}
                            >
                              <span>{step.step_order}</span>
                              <span>
                                {step.content?.title ?? '현재 이용할 수 없는 영상'}
                                <small>
                                  {step.content_id === content.content_id
                                    ? '현재 학습 중'
                                    : step.completed
                                      ? '학습 완료'
                                      : step.available
                                        ? '이 영상으로 이동'
                                        : '이용 불가'}
                                </small>
                              </span>
                            </button>
                          </li>
                        ))}
                    </ol>
                  </>
                ) : null}
              </details>
            ) : null}
            <div className="sasu-lp__tabs" role="tablist" aria-label="학습 자료" data-active={tab}>
              {(['core', 'quiz'] as const).map((value, index) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  ref={(element) => {
                    tabButtons.current[index] = element
                  }}
                  id={`${panelId}-${value}-tab`}
                  aria-controls={`${panelId}-${value}-panel`}
                  tabIndex={tab === value ? 0 : -1}
                  onKeyDown={(event) => {
                    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
                    event.preventDefault()
                    setTab(
                      event.key === 'Home'
                        ? 'core'
                        : event.key === 'End'
                          ? 'quiz'
                          : value === 'core'
                            ? 'quiz'
                            : 'core',
                    )
                  }}
                  aria-selected={tab === value}
                  className={`sasu-lp__tab ${tab === value ? 'is-active' : ''}`}
                  onClick={() => setTab(value)}
                >
                  {value === 'core' ? '핵심 정리' : '퀴즈'}
                </button>
              ))}
            </div>
            <div className="sasu-lp__body">
              <div
                role="tabpanel"
                className="sasu-lp__core-panel"
                style={
                  {
                    '--material-total-weight': `calc(${materialWeights.join(' + ')})`,
                    '--material-gap-count': Math.max(0, materialWeights.length - 1),
                  } as CSSProperties
                }
                id={`${panelId}-core-panel`}
                aria-labelledby={`${panelId}-core-tab`}
                hidden={tab !== 'core'}
                tabIndex={0}
              >
                {summary ? (
                  <div className="sasu-lp__oneline">
                    <span className="sasu-lp__label">한 줄 정리</span>
                    <p
                      className="sasu-lp__scroll"
                      role="region"
                      aria-label="한 줄 정리 내용"
                      tabIndex={0}
                    >
                      {summary}
                    </p>
                  </div>
                ) : null}
                {showCore ? (
                  <div className="sasu-lp__sec sasu-lp__note">
                    <h3 className="sasu-lp__note-title">
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                        focusable="false"
                      >
                        <rect x="5" y="3" width="14" height="18" rx="2" />
                        <path d="M9 8h6M9 12h6M9 16h4" />
                      </svg>
                      핵심 정리
                    </h3>
                    <div
                      className="sasu-lp__core sasu-lp__scroll"
                      role="region"
                      aria-label="핵심 정리 내용"
                      tabIndex={0}
                    >
                      {core.split(/\r?\n(?:[\t ]*\r?\n)+/).map((paragraph, index) => (
                        <p key={index}>{paragraph}</p>
                      ))}
                    </div>
                  </div>
                ) : null}
                {!summary && !core ? (
                  <p className="sasu-muted">등록된 핵심 정리가 없어요.</p>
                ) : null}
                {detail.related_curriculums.length ? (
                  <div className="sasu-lp__sec sasu-lp__related">
                    <span className="sasu-lp__label">관련 학습</span>
                    <ul
                      className="sasu-lp__related-list sasu-lp__scroll"
                      aria-label="관련 학습 목록"
                      tabIndex={0}
                    >
                      {detail.related_curriculums.map((item) => (
                        <li key={item.curriculum_id}>
                          <Link to={`/learner/series/${item.curriculum_id}`}>
                            <span className="sasu-lp__rel-ic" aria-hidden="true">
                              <svg
                                width="22"
                                height="22"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.7"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                focusable="false"
                              >
                                <rect x="8" y="3" width="13" height="5" rx="1.5" />
                                <rect x="8" y="16" width="13" height="5" rx="1.5" />
                                <path d="M3 5v13h5M3 5h5M14 8v8" />
                              </svg>
                            </span>
                            <span className="sasu-lp__rel-t">
                              <span className="sasu-lp__rel-title">{item.title}</span>
                              <small>시리즈 살펴보기</small>
                            </span>
                            <span className="sasu-lp__rel-go" aria-hidden="true">
                              <svg
                                width="18"
                                height="18"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.7"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                focusable="false"
                              >
                                <path d="m9 6 6 6-6 6" />
                              </svg>
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
                    <p
                      className="sasu-lp__scroll"
                      role="region"
                      aria-label="실무 용어 해석 주의 내용"
                      tabIndex={0}
                    >
                      {detail.caution_text}
                    </p>
                  </div>
                ) : null}
              </div>
              <div
                role="tabpanel"
                className="sasu-lp__quiz-panel sasu-lp__scroll"
                id={`${panelId}-quiz-panel`}
                aria-labelledby={`${panelId}-quiz-tab`}
                hidden={tab !== 'quiz'}
                tabIndex={0}
              >
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
                    appearance="material-preview"
                  />
                ) : question === undefined ? (
                  <p role="status">문항을 불러오는 중이에요.</p>
                ) : question === null ? (
                  <p>등록된 퀴즈가 없어요. 영상 학습을 마치고 다음으로 이동할 수 있어요.</p>
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
        </>
      }
    >
      {playErrorReport.isError ? (
        <p role="alert">오류 기록: {playErrorReport.error.message}</p>
      ) : null}
      {navigationError ? <p role="alert">{navigationError}</p> : null}
      {reaction.isError ? <p role="alert">{reaction.error.message}</p> : null}
      {watch.error ? (
        <div role="alert">
          <p>시청 기록: {watch.error}</p>
          <Button size="sm" onClick={watch.retry}>
            기록 다시 저장
          </Button>
        </div>
      ) : null}
    </SwipeScene>
  )
}
