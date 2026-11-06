import { flashcardLibraryPath, safeLibraryReturn } from '../../features/learner-navigation/state'
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useLocation, useParams, useSearchParams } from 'react-router'
import {
  getLearningContent,
  getLearningQuestion,
  learningKey,
  type LearningIdentity,
  type WatchContext,
} from '../../api/learning'
import { api, queryString } from '../../api/client'
import { PersonalizedFeed } from '../../features/feed/PersonalizedFeed'
import { ContentViewer } from '../../features/content-viewer/ContentViewer'
import { BufferedVideo } from '../../features/content-viewer/BufferedVideo'
import { VideoLoading } from '../../features/content-viewer/VideoLoading'
import { VideoUnavailable } from '../../features/content-viewer/VideoUnavailable'
import { LEARNING_PRELOAD_STALE_MS } from '../../features/content-viewer/preloadPolicy'
import { SwipeViewport } from '../../features/content-viewer/SwipeViewport'
import { SwipeScene } from '../../features/content-viewer/SwipeScene'
import { ScreenLoading } from '../../app/RouteContent'
import {
  createViewerSession,
  type ViewerSession,
} from '../../features/content-viewer/viewerSession'
import type { CurriculumDetail } from '../../api/learner'
import type { WatchNavigationState } from '../../features/content-viewer/types'
import { useSession } from '../../state/session'
import { Button } from '../../learner/ui'
import { LearnerState as StateBlock } from '../../learner/LearnerState'

export function FeedPage({ mode }: { mode: 'feed' | 'watch' }) {
  if (mode === 'feed') return <PersonalizedFeed />
  return <WatchPage />
}

function watchOrigin(params: URLSearchParams, routeState: Partial<WatchNavigationState> | null) {
  const from = params.get('from')
  const contexts: WatchContext[] = ['SEARCH', 'CURRICULUM', 'LIBRARY', 'REVIEW']
  const context: WatchContext = contexts.includes(routeState?.context as WatchContext)
    ? (routeState!.context as WatchContext)
    : from === 'series'
      ? 'CURRICULUM'
      : from === 'saved' || from === 'library'
        ? 'LIBRARY'
        : from === 'wrong' || from === 'card' || from === 'review'
          ? 'REVIEW'
          : 'SEARCH'
  const series = routeState?.curriculumId ?? Number(params.get('series'))
  const seriesBackTo =
    context === 'CURRICULUM'
      ? routeState?.returnTo?.startsWith('/learner/')
        ? routeState.returnTo
        : Number.isSafeInteger(series) && series > 0
          ? `/learner/series/${series}`
          : '/learner/series'
      : undefined
  return { context, series, seriesBackTo }
}

function WatchPage() {
  const { actorId, learnerId, generation, isPending, error, refreshSettings } = useSession()
  const { contentId } = useParams()
  const identity = useMemo(
    () =>
      actorId !== null && learnerId !== null && generation !== null
        ? { actorId, learnerId, generation }
        : null,
    [actorId, learnerId, generation],
  )
  const playback = useMemo(
    () => createViewerSession(`${actorId}:${learnerId}:${generation}`),
    [actorId, learnerId, generation],
  )
  if (isPending && !identity) return <ScreenLoading label="학습자 정보 불러오는 중" />
  if (error && !identity)
    return (
      <div className="sasu-page">
        <StateBlock
          title="학습자 정보를 불러오지 못했어요."
          error={error}
          action={<Button onClick={() => void refreshSettings()}>다시 시도</Button>}
        />
      </div>
    )
  if (!identity)
    return (
      <div className="sasu-page">
        <StateBlock title="학습자를 선택해 주세요." />
      </div>
    )
  const id = Number(contentId)
  if (!Number.isInteger(id) || id <= 0)
    return (
      <div className="sasu-page">
        <StateBlock
          variant="screen"
          title="올바른 영상 주소가 아니에요."
          action={<Link to="/learner/search">영상 검색</Link>}
        />
      </div>
    )
  return (
    <>
      {error ? (
        <StateBlock
          variant="toast"
          title="학습자 정보를 갱신하지 못했어요."
          error={error}
          action={<Button onClick={() => void refreshSettings()}>정보 다시 불러오기</Button>}
        />
      ) : null}
      <WatchContent
        key={`${actorId}:${learnerId}:${generation}`}
        identity={identity}
        playback={playback}
        contentId={id}
      />
    </>
  )
}

function WatchContent({
  identity,
  contentId,
  playback,
}: {
  identity: LearningIdentity
  contentId: number
  playback: ViewerSession
}) {
  const [params] = useSearchParams()
  const location = useLocation()
  const detail = useQuery({
    queryKey: learningKey(identity, 'content', contentId),
    queryFn: ({ signal }) => getLearningContent(identity, contentId, signal),
    staleTime: LEARNING_PRELOAD_STALE_MS,
    retry: false,
  })
  const question = useQuery({
    queryKey: learningKey(identity, 'question', contentId),
    queryFn: ({ signal }) => getLearningQuestion(identity, contentId, signal),
    staleTime: LEARNING_PRELOAD_STALE_MS,
    retry: false,
  })
  const from = params.get('from')
  const routeState = location.state as Partial<WatchNavigationState> | null
  const { context, series, seriesBackTo } = watchOrigin(params, routeState)
  const version = params.get('questionVersionId')
  const curriculum = useQuery({
    queryKey: [
      'learner',
      'curriculum',
      identity.actorId,
      identity.learnerId,
      identity.generation,
      series,
    ],
    queryFn: ({ signal }) =>
      api<CurriculumDetail>(
        `/curriculums/${series}${queryString({ view: 'learner', user_id: identity.learnerId })}`,
        { actorId: identity.actorId, signal },
      ),
    enabled: context === 'CURRICULUM' && Number.isSafeInteger(series) && series > 0,
    retry: false,
  })
  const reviewQuery = queryString({
    questionVersionId: version,
    returnTo: params.get('returnTo'),
    category: params.get('category'),
    q: params.get('q'),
    reviewSession: params.get('reviewSession'),
    reviewScope: params.get('reviewScope'),
  })
  const backTo = routeState?.returnTo?.startsWith('/learner/')
    ? routeState.returnTo
    : from === 'wrong'
      ? `/learner/review/${contentId}${reviewQuery}`
      : from === 'card'
        ? flashcardLibraryPath(params)
        : context === 'LIBRARY'
          ? safeLibraryReturn(params.get('returnTo'), 'saved')
          : (seriesBackTo ?? '/learner/search')
  const backLabel =
    context === 'LIBRARY' || from === 'card'
      ? '← 보관함으로'
      : context === 'CURRICULUM'
        ? '← 시리즈로'
        : context === 'REVIEW'
          ? '← 복습으로'
          : '← 검색으로'
  const rawIds = Array.isArray(routeState?.contentIds)
    ? routeState.contentIds
    : (params.get('list') ?? '').split(',')
  const ids =
    context === 'CURRICULUM' && curriculum.data
      ? [...curriculum.data.steps]
          .sort((a, b) => a.step_order - b.step_order)
          .filter((step) => step.available && step.content)
          .map((step) => step.content_id)
      : rawIds.map(Number).filter((id) => Number.isInteger(id) && id > 0)
  const nextState: WatchNavigationState = {
    ...routeState,
    context,
    returnTo: backTo,
    contentIds: ids,
    curriculumId: context === 'CURRICULUM' ? series : undefined,
  }
  const videoPath = (id: number) => {
    const query = new URLSearchParams(params)
    if (context === 'CURRICULUM') {
      query.set('from', 'series')
      query.set('series', String(series))
    }
    return `/learner/watch/${id}?${query.toString()}`
  }
  const currentIndex = ids.indexOf(contentId)
  const nextId = currentIndex >= 0 ? ids[currentIndex + 1] : undefined
  const nextTo = nextId ? videoPath(nextId) : undefined
  const prevId = currentIndex > 0 ? ids[currentIndex - 1] : undefined
  const prevTo = prevId ? videoPath(prevId) : undefined
  const renderCurrent = () => {
    if (detail.isPending) return <SwipeScene panelPending media={<VideoLoading />} />
    if (detail.isError && !detail.data)
      return (
        <SwipeScene
          media={
            <VideoUnavailable
              title="영상을 불러오지 못했어요."
              error={detail.error}
              action={
                <>
                  <Button onClick={() => void detail.refetch()}>다시 시도</Button>
                  <Link to={backTo}>{backLabel}</Link>
                </>
              }
            />
          }
        />
      )
    if (
      !detail.data.content.video_url ||
      !detail.data.content.media_revision ||
      !detail.data.content.video_duration
    )
      return (
        <SwipeScene
          media={
            <VideoUnavailable
              title="현재 재생할 수 없는 영상이에요."
              action={<Link to={backTo}>{backLabel}</Link>}
            />
          }
        />
      )
    return (
      <>
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
          series={
            context === 'CURRICULUM' && series > 0
              ? {
                  data: curriculum.data,
                  loading: curriculum.isPending,
                  error: curriculum.error,
                  retry: () => void curriculum.refetch(),
                  path: videoPath,
                }
              : undefined
          }
          key={`${contentId}:${detail.data.content.media_revision}:${context}`}
          identity={identity}
          detail={detail.data}
          question={question.data}
          questionError={question.error}
          retryQuestion={() => void question.refetch()}
          context={context}
          backTo={backTo}
          backLabel={backLabel}
          nextTo={nextTo}
          prevTo={prevTo}
          nextState={nextState}
          listIndex={currentIndex >= 0 ? currentIndex + 1 : undefined}
          listTotal={ids.length > 1 ? ids.length : undefined}
        />
      </>
    )
  }
  const contentIds = ids.includes(contentId) ? [...new Set(ids)] : [contentId]
  return (
    <SwipeViewport
      activeKey={`video:${contentId}`}
      items={contentIds.map((id) => ({
        key: `video:${id}`,
        renderVideo: (mediaHost, activeContent, active) => (
          <BufferedVideo
            identity={identity}
            contentId={id}
            active={active}
            mediaHost={mediaHost}
            overlay={{
              showSeriesBack: context === 'CURRICULUM',
              recommendationLabel: context === 'CURRICULUM' ? '시리즈 학습' : '영상 학습',
              listIndex: ids.indexOf(id) >= 0 ? ids.indexOf(id) + 1 : undefined,
              listTotal: ids.length > 1 ? ids.length : undefined,
            }}
          >
            {activeContent}
          </BufferedVideo>
        ),
      }))}
    >
      {renderCurrent()}
    </SwipeViewport>
  )
}
