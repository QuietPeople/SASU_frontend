import { ErrorFeedback } from '../../shared/ErrorFeedback'
import { Notification } from '../../shared/Notification'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useLocation, useSearchParams } from 'react-router'
import { positiveId } from '../learner-navigation/state'
import { getFeedEntry, feedSessionAtEntry, type FeedEntry, type FeedDisplayItem } from './entry'
import { getFeedCandidate, saveFeedPosition } from '../../api/feed'
import {
  getLearningContent,
  getLearningQuestion,
  learningKey,
  type LearningIdentity,
  type WatchResult,
} from '../../api/learning'
import { ContentViewer } from '../content-viewer/ContentViewer'
import { SwipeViewport, type SwipeItem } from '../content-viewer/SwipeViewport'
import { SwipeScene } from '../content-viewer/SwipeScene'
import { feedSlides } from './feedSlides'
import { LEARNING_PRELOAD_STALE_MS } from '../content-viewer/preloadPolicy'
import { BufferedVideo } from '../content-viewer/BufferedVideo'
import { FeedEndCard } from './FeedEndCard'
import { FeedCardPreview } from './FeedCardPreview'
import { FLASHCARD_STYLES } from '../../shared/useFlashcardStyle'
import { VideoLoading, VideoLoadingFrame } from '../content-viewer/VideoLoading'
import { VideoUnavailable } from '../content-viewer/VideoUnavailable'
import { createViewerSession, type ViewerSession } from '../content-viewer/viewerSession'
import { FeedReviewCard } from './FeedReviewCard'
import { Button } from '../../learner/ui'
import { LearnerState as StateBlock } from '../../learner/LearnerState'
import { useSession } from '../../state/session'
import {
  readFeedSession,
  writeFeedSession,
  createFeedCard,
  updateFeedCard,
  cardBetween,
  type FeedSession,
  type PendingFeedReview,
} from './session'

export function PersonalizedFeed() {
  const location = useLocation()
  const [params] = useSearchParams()
  const startContentId = positiveId(params.get('start'))
  const requestedReturn = location.state?.returnTo
  const returnTo =
    typeof requestedReturn === 'string' && /^\/learner\/search(?:\?|$)/.test(requestedReturn)
      ? requestedReturn
      : '/learner/search'
  const { actorId, learnerId, generation, settings, refreshSettings } = useSession()
  const identity = useMemo(
    () =>
      actorId !== null && learnerId !== null && generation !== null
        ? { actorId, learnerId, generation }
        : null,
    [actorId, learnerId, generation],
  )
  if (!identity)
    return (
      <div className="sasu-page">
        <StateBlock
          title="학습자 정보를 확인해 주세요."
          action={<Button onClick={() => void refreshSettings()}>다시 확인</Button>}
        />
      </div>
    )
  return (
    <FeedLoader
      key={`${actorId}:${learnerId}:${generation}:${location.key}`}
      identity={identity}
      interval={settings?.review_interval ?? 5}
      startContentId={startContentId}
      returnTo={returnTo}
    />
  )
}

function FeedLoader({
  identity,
  interval,
  startContentId,
  returnTo,
}: {
  identity: LearningIdentity
  interval: number
  startContentId?: number
  returnTo: string
}) {
  const [revision, setRevision] = useState(0)
  const [entryId] = useState(() => crypto.randomUUID())
  const feed = useQuery({
    queryKey: learningKey(identity, 'feed', entryId, revision, startContentId),
    queryFn: ({ signal }) =>
      getFeedEntry(identity, revision === 0 ? startContentId : undefined, signal),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })
  if (feed.isPending) return <VideoLoadingFrame />
  if (!feed.data)
    return (
      <div className="sasu-page">
        <StateBlock
          title="영상을 불러오지 못했어요."
          error={feed.error}
          action={
            <>
              <Button onClick={() => void feed.refetch()}>다시 시도</Button>
              {startContentId !== undefined && revision === 0 && (
                <Button onClick={() => setRevision((value) => value + 1)}>추천 영상 보기</Button>
              )}
              <Link to={returnTo}>검색으로</Link>
            </>
          }
        />
      </div>
    )
  return (
    <FeedFlow
      key={revision}
      identity={identity}
      interval={interval}
      entry={feed.data}
      returnTo={returnTo}
      reload={() => setRevision((value) => value + 1)}
    />
  )
}

function FeedFlow({
  identity,
  interval,
  entry,
  returnTo,
  reload,
}: {
  identity: LearningIdentity
  interval: number
  entry: FeedEntry
  returnTo: string
  reload: () => void
}) {
  // 시청 보고·좋아요의 배경 재조회로 현재 영상과 추천 순서가 바뀌지 않게 한다.
  const [initial] = useState(entry)
  const items = initial.items
  const [currentId, setCurrentId] = useState(initial.initialContentId)
  const [state, setState] = useState(() =>
    feedSessionAtEntry(readFeedSession(identity), initial.explicitStart),
  )
  const stateRef = useRef(state)
  const [storageFailed, setStorageFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const moving = useRef(false)
  const mounted = useRef(true)
  const [preparedCard, setPreparedCard] = useState<PendingFeedReview | null>(null)
  const [styleSeed] = useState(() => Math.floor(Math.random() * FLASHCARD_STYLES.length))
  const styleFor = (id: string) =>
    FLASHCARD_STYLES[
      [...id].reduce(
        (hash, char) => (hash + char.charCodeAt(0)) % FLASHCARD_STYLES.length,
        styleSeed,
      )
    ]
  const [playback] = useState(createViewerSession)
  const candidateRequest = useRef<AbortController | null>(null)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      candidateRequest.current?.abort()
    }
  }, [])
  const update = useCallback(
    (change: (previous: FeedSession) => FeedSession) => {
      if (!mounted.current) return
      const next = change(stateRef.current)
      if (next === stateRef.current) return
      stateRef.current = next
      setStorageFailed(!writeFeedSession(identity, next))
      setState(next)
    },
    [identity],
  )
  const onWatchReport = useCallback(
    (id: number, result: WatchResult) => {
      if (
        !mounted.current ||
        result.record_generation !== identity.generation ||
        !result.feed_completion_eligible
      )
        return
      update((previous) =>
        previous.completed.includes(id)
          ? previous
          : {
              ...previous,
              completed: [...previous.completed, id],
              count: previous.count + 1,
            },
      )
    },
    [identity.generation, update],
  )
  const index = items.findIndex((item) => item.content.content_id === currentId)
  const nextId = items[index + 1]?.content.content_id ?? null
  const previousId = items[index < 0 ? items.length - 1 : index - 1]?.content.content_id
  const prepareAdvance = async (): Promise<(() => void) | false> => {
    if (moving.current || !mounted.current) return false
    moving.current = true
    setBusy(true)
    setError(null)
    try {
      const current = stateRef.current
      const inserted =
        cardBetween(current, currentId, nextId) ??
        (preparedCard?.previousContentId === currentId && preparedCard.nextContentId === nextId
          ? preparedCard
          : undefined)
      if (inserted) {
        return () =>
          update((previous) => ({
            ...previous,
            pending: inserted,
            cards: previous.cards.some((card) => card.id === inserted.id)
              ? previous.cards
              : [...previous.cards, inserted],
          }))
      }
      if (current.count >= interval && current.completed.length > current.evaluatedAt) {
        const controller = new AbortController()
        candidateRequest.current = controller
        const result = await getFeedCandidate(
          identity,
          current.shown,
          current.retry,
          controller.signal,
        )
        if (!mounted.current) return false
        if (result.candidate) {
          const card = createFeedCard(result.candidate, currentId, nextId)
          setPreparedCard(card)
          return () =>
            update((previous) => ({
              ...previous,
              pending: card,
              cards: [...previous.cards, card],
            }))
        }
        // 후보가 없으면 카운터를 유지하고, 새 콘텐츠 완료 후에만 다시 후보를 요청한다.
        update((previous) => ({ ...previous, evaluatedAt: previous.completed.length }))
      }
      return () => {
        if (mounted.current) {
          setPreparedCard(null)
          setCurrentId(nextId)
        }
      }
    } catch (cause) {
      if (mounted.current && !(cause instanceof Error && cause.name === 'AbortError'))
        setError(cause instanceof Error ? cause : new Error('복기 대상을 확인하지 못했어요.'))
      return false
    } finally {
      moving.current = false
      if (mounted.current) setBusy(false)
    }
  }
  const advance = async () => {
    const commit = await prepareAdvance()
    if (commit) commit()
    return Boolean(commit)
  }
  const onReady = useCallback(() => {
    update((previous) => {
      const pending = previous.pending
      if (!pending || pending.shown) return previous
      return {
        ...updateFeedCard(previous, pending.id, { shown: true }),
        count: 0,
        evaluatedAt: previous.completed.length,
        shown: [...new Set([...previous.shown, pending.question.question_version_id])],
        retry: previous.retry.filter((id) => id !== pending.question.question_version_id),
      }
    })
  }, [update])
  const onFlip = useCallback(
    (id: string, flipped: boolean) => {
      update((previous) => updateFeedCard(previous, id, { flipped }))
    },
    [update],
  )
  const finishReview = (direction: 'next' | 'previous') => {
    const card = stateRef.current.pending
    const next =
      direction === 'next' ? (card?.nextContentId ?? null) : (card?.previousContentId ?? currentId)
    update((previous) => ({ ...previous, pending: null }))
    setCurrentId(items.some((item) => item.content.content_id === next) ? next : null)
    setError(null)
  }
  const goPrevious = () => {
    const card = cardBetween(stateRef.current, previousId ?? null, currentId)
    if (card) update((previous) => ({ ...previous, pending: card }))
    else if (previousId !== undefined) setCurrentId(previousId)
  }

  const cardPreview = (card: PendingFeedReview) => (
    <FeedCardPreview key={card.id} identity={identity} card={card} style={styleFor(card.id)} />
  )
  const slides = feedSlides(
    items.map((item) => item.content.content_id),
    preparedCard && !state.cards.some((card) => card.id === preparedCard.id)
      ? [...state.cards, preparedCard]
      : state.cards,
    state.pending,
  )
  const activeKey = state.pending
    ? `review:${state.pending.id}`
    : currentId === null
      ? 'end'
      : `video:${currentId}`
  const endScreen = (
    <FeedEndCard empty={items.length === 0}>
      <Button variant="primary" onClick={reload}>
        추천 다시 불러오기
      </Button>
      {previousId !== undefined && <Button onClick={goPrevious}>이전 항목</Button>}
      <Link className="sasu-link" to={returnTo}>
        영상 검색하기
      </Link>
    </FeedEndCard>
  )
  const scrollItems: SwipeItem[] = slides.map((slide) => ({
    key: slide.key,
    ...(slide.kind === 'video'
      ? {
          renderVideo: (mediaHost, activeContent, active) => (
            <BufferedVideo
              identity={identity}
              contentId={slide.contentId}
              content={items.find((item) => item.content.content_id === slide.contentId)?.content}
              overlay={{
                recommendationLabel: items.find(
                  (item) => item.content.content_id === slide.contentId,
                )?.recommendation_label,
              }}
              active={active}
              mediaHost={mediaHost}
            >
              {activeContent}
            </BufferedVideo>
          ),
        }
      : {
          preview: slide.kind === 'review' ? cardPreview(slide.card) : endScreen,
        }),
  }))

  return (
    <>
      {storageFailed ? (
        <ErrorFeedback
          title="복기 진행 상태를 보관하지 못했어요."
          text="새로고침하면 진행 상태가 사라질 수 있어요."
        />
      ) : null}
      {initial.resumeUnavailable && items.length > 0 ? (
        <Notification
          tone="info"
          title="마지막 영상은 현재 이용할 수 없어요."
          message="다른 추천 영상부터 보여 드려요."
        />
      ) : null}
      {error ? (
        <StateBlock
          variant="toast"
          title="복기 대상을 확인하지 못했어요."
          error={error}
          action={
            <Button onClick={() => void advance()} disabled={busy}>
              다시 확인
            </Button>
          }
        />
      ) : null}
      <SwipeViewport items={scrollItems} activeKey={activeKey}>
        {state.pending ? (
          <FeedReviewCard
            key={state.pending.id}
            identity={identity}
            card={state.pending}
            style={styleFor(state.pending.id)}
            onReady={onReady}
            onFlip={onFlip}
            onNavigate={finishReview}
          />
        ) : currentId !== null && index >= 0 ? (
          <FeedVideo
            key={currentId}
            playback={playback}
            identity={identity}
            item={items[index]}
            returnTo={returnTo}
            onWatchReport={(result) => onWatchReport(currentId, result)}
            onNext={advance}
            prepareNext={prepareAdvance}
            onPrevious={previousId === undefined ? undefined : goPrevious}
            busy={busy}
          />
        ) : (
          <SwipeScene
            media={endScreen}
            onNavigate={async (direction) => {
              if (direction !== 'previous' || previousId === undefined) return false
              goPrevious()
              return true
            }}
          />
        )}
      </SwipeViewport>
    </>
  )
}

function FeedVideo({
  playback,
  identity,
  item,
  returnTo,
  onNext,
  onPrevious,
  onWatchReport,
  busy,
  prepareNext,
}: {
  identity: LearningIdentity
  item: FeedDisplayItem
  returnTo: string
  playback: ViewerSession
  onNext: () => Promise<boolean>
  onPrevious?: () => void
  onWatchReport: (result: WatchResult) => void
  busy: boolean
  prepareNext: () => Promise<(() => void) | false>
}) {
  const id = item.content.content_id
  const detail = useQuery({
    queryKey: learningKey(identity, 'content', id),
    queryFn: ({ signal }) => getLearningContent(identity, id, signal),
    staleTime: LEARNING_PRELOAD_STALE_MS,
  })
  const question = useQuery({
    queryKey: learningKey(identity, 'question', id),
    queryFn: ({ signal }) => getLearningQuestion(identity, id, signal),
    staleTime: LEARNING_PRELOAD_STALE_MS,
  })
  const position = useMutation({
    scope: { id: `feed-position:${identity.learnerId}:${identity.generation}` },
    mutationFn: () => saveFeedPosition(identity, id),
  })
  const save = position.mutate
  useEffect(() => {
    save()
  }, [save])

  if (detail.isPending) return <SwipeScene panelPending media={<VideoLoading />} />
  if (
    !detail.data ||
    !detail.data.content.video_url ||
    !detail.data.content.media_revision ||
    !detail.data.content.video_duration
  )
    return (
      <SwipeScene
        media={
          <VideoUnavailable
            title="현재 영상을 불러올 수 없어요."
            error={detail.error}
            action={
              <>
                <Button onClick={() => void detail.refetch()}>다시 시도</Button>
                <Button disabled={busy} onClick={() => void onNext()}>
                  다음 영상
                </Button>
              </>
            }
          />
        }
        onNavigate={async (direction) => {
          if (direction === 'next') return onNext()
          if (!onPrevious) return false
          onPrevious()
          return true
        }}
      />
    )
  return (
    <>
      {position.isError ? (
        <StateBlock
          variant="toast"
          title="마지막 영상 위치를 저장하지 못했어요."
          error={position.error}
          action={<Button onClick={() => save()}>위치 다시 저장</Button>}
        />
      ) : null}
      {detail.isError ? (
        <StateBlock
          variant="toast"
          title="영상 정보를 갱신하지 못했어요."
          error={detail.error}
          action={<Button onClick={() => void detail.refetch()}>정보 다시 불러오기</Button>}
        />
      ) : null}
      <ContentViewer
        playback={playback}
        key={detail.data.content.media_revision}
        identity={identity}
        detail={detail.data}
        question={question.data}
        questionError={question.error}
        retryQuestion={() => void question.refetch()}
        context="FEED"
        backTo={returnTo}
        backLabel="영상 검색"
        recommendationLabel={item.recommendation_label}
        onNext={onNext}
        onPrevious={onPrevious}
        onWatchReport={onWatchReport}
        prepareNext={prepareNext}
        navigationPending={busy}
      />
    </>
  )
}
