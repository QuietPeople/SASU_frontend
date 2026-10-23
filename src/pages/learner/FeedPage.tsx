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
import { queryString } from '../../api/client'
import { ContentViewer } from '../../features/content-viewer/ContentViewer'
import type { WatchNavigationState } from '../../features/content-viewer/types'
import { useSession } from '../../state/session'
import { Button, StateBlock } from '../../shared/ui'

export function FeedPage({ mode }: { mode: 'feed' | 'watch' }) {
  if (mode === 'feed') {
    return (
      <div className="sasu-page">
        <StateBlock
          title="추천 피드는 아직 준비 중이에요."
          text="지금은 검색에서 공개 영상을 선택해 학습할 수 있어요."
          action={
            <Link className="sasu-btn sasu-btn--primary" to="/learner/search">
              영상 검색하기
            </Link>
          }
        />
        <p className="sasu-help">피드 사이 복습도 추천 피드와 함께 제공될 예정이에요.</p>
      </div>
    )
  }
  return <WatchPage />
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
  if (isPending && !identity)
    return (
      <div className="sasu-page">
        <StateBlock title="학습자 정보를 불러오는 중이에요." />
      </div>
    )
  if (error && !identity)
    return (
      <div className="sasu-page">
        <StateBlock
          title="학습자 정보를 불러오지 못했어요."
          text={error.message}
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
          title="올바른 영상 주소가 아니에요."
          action={<Link to="/learner/search">영상 검색</Link>}
        />
      </div>
    )
  return (
    <>
      {error ? (
        <div className="sasu-page" role="alert">
          <p>학습자 정보를 갱신하지 못했어요. {error.message}</p>
          <Button onClick={() => void refreshSettings()}>정보 다시 불러오기</Button>
        </div>
      ) : null}
      <WatchContent
        key={`${actorId}:${learnerId}:${generation}:${id}`}
        identity={identity}
        contentId={id}
      />
    </>
  )
}

function WatchContent({ identity, contentId }: { identity: LearningIdentity; contentId: number }) {
  const [params] = useSearchParams()
  const location = useLocation()
  const detail = useQuery({
    queryKey: learningKey(identity, 'content', contentId),
    queryFn: ({ signal }) => getLearningContent(identity, contentId, signal),
    retry: false,
  })
  const question = useQuery({
    queryKey: learningKey(identity, 'question', contentId),
    queryFn: ({ signal }) => getLearningQuestion(identity, contentId, signal),
    retry: false,
  })
  const from = params.get('from')
  const routeState = location.state as Partial<WatchNavigationState> | null
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
  const version = params.get('questionVersionId')
  const series = routeState?.curriculumId ?? Number(params.get('series'))
  const reviewQuery = queryString({
    questionVersionId: version,
    returnTo: params.get('returnTo'),
    category: params.get('category'),
    reviewSession: params.get('reviewSession'),
    reviewScope: params.get('reviewScope'),
  })
  const backTo = routeState?.returnTo?.startsWith('/learner/')
    ? routeState.returnTo
    : from === 'wrong'
      ? `/learner/review/${contentId}${reviewQuery}`
      : from === 'card'
        ? `/learner/cards${reviewQuery}`
        : context === 'LIBRARY'
          ? '/learner/library?tab=saved'
          : context === 'CURRICULUM' && series > 0
            ? `/learner/series/${series}`
            : '/learner/search'
  const backLabel =
    context === 'LIBRARY'
      ? '← 보관함으로'
      : context === 'CURRICULUM'
        ? '← 시리즈로'
        : context === 'REVIEW'
          ? '← 복습으로'
          : '← 검색으로'
  const rawIds = Array.isArray(routeState?.contentIds)
    ? routeState.contentIds
    : (params.get('list') ?? '').split(',')
  const ids = rawIds.map(Number).filter((id) => Number.isInteger(id) && id > 0)
  const nextState: WatchNavigationState = {
    ...routeState,
    context,
    returnTo: backTo,
    contentIds: ids,
  }
  const currentIndex = ids.indexOf(contentId)
  const nextId = currentIndex >= 0 ? ids[currentIndex + 1] : undefined
  const nextTo = nextId ? `/learner/watch/${nextId}?${params.toString()}` : undefined
  if (detail.isPending)
    return (
      <div className="sasu-page">
        <StateBlock title="영상을 불러오는 중이에요." />
      </div>
    )
  if (detail.isError && !detail.data)
    return (
      <div className="sasu-page">
        <StateBlock
          title="영상을 불러오지 못했어요."
          text={detail.error.message}
          action={
            <>
              <Button onClick={() => void detail.refetch()}>다시 시도</Button>
              <Link to={backTo}>{backLabel}</Link>
            </>
          }
        />
      </div>
    )
  if (
    !detail.data.content.video_url ||
    !detail.data.content.media_revision ||
    !detail.data.content.video_duration
  )
    return (
      <div className="sasu-page">
        <StateBlock
          title="현재 재생할 수 없는 영상이에요."
          action={<Link to={backTo}>{backLabel}</Link>}
        />
      </div>
    )
  return (
    <>
      {detail.isError ? (
        <div className="sasu-page" role="alert">
          <p>영상 정보를 갱신하지 못했어요. {detail.error.message}</p>
          <Button onClick={() => void detail.refetch()}>정보 다시 불러오기</Button>
        </div>
      ) : null}
      <ContentViewer
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
        nextState={nextState}
      />
    </>
  )
}
