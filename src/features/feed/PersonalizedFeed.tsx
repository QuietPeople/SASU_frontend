import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { ApiError } from '../../api/client'
import {
  getFeed,
  getFeedCandidate,
  saveFeedPosition,
  type Feed,
  type FeedItem,
  type FeedPosition,
} from '../../api/feed'
import {
  getLearningContent,
  getLearningQuestion,
  learningKey,
  recoverLearningAttempt,
  type LearningIdentity,
  type LearningResponse,
  type WatchResult,
} from '../../api/learning'
import { ContentViewer } from '../content-viewer/ContentViewer'
import { QuizView } from '../../shared/QuizView'
import { Button, StateBlock } from '../../shared/ui'
import { useSession } from '../../state/session'
import {
  readFeedSession,
  writeFeedSession,
  type FeedSession,
  type PendingFeedReview,
} from './session'

export function PersonalizedFeed() {
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
      key={`${actorId}:${learnerId}:${generation}`}
      identity={identity}
      interval={settings?.review_interval ?? 5}
    />
  )
}

function FeedLoader({ identity, interval }: { identity: LearningIdentity; interval: number }) {
  const [revision, setRevision] = useState(0)
  const [entryId] = useState(() => crypto.randomUUID())
  const feed = useQuery({
    queryKey: learningKey(identity, 'feed', entryId, revision),
    queryFn: ({ signal }) => getFeed(identity, signal),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })
  if (feed.isPending)
    return (
      <div className="sasu-page">
        <StateBlock title="추천 영상을 불러오는 중이에요." />
      </div>
    )
  if (!feed.data)
    return (
      <div className="sasu-page">
        <StateBlock
          title="추천 영상을 불러오지 못했어요."
          text={feed.error?.message}
          action={<Button onClick={() => void feed.refetch()}>다시 시도</Button>}
        />
      </div>
    )
  return (
    <FeedFlow
      key={revision}
      identity={identity}
      interval={interval}
      feed={feed.data.feed}
      position={feed.data.position}
      reload={() => setRevision((value) => value + 1)}
    />
  )
}

function FeedFlow({
  identity,
  interval,
  feed,
  position,
  reload,
}: {
  identity: LearningIdentity
  interval: number
  feed: Feed
  position: FeedPosition
  reload: () => void
}) {
  // 시청 보고·좋아요의 배경 재조회로 현재 영상과 추천 순서가 바뀌지 않게 한다.
  const [items] = useState(() =>
    feed.items.filter(
      (item, index, all) =>
        all.findIndex((other) => other.content.content_id === item.content.content_id) === index,
    ),
  )
  const [currentId, setCurrentId] = useState<number | null>(() =>
    position.resume_available &&
    items.some((item) => item.content.content_id === position.last_content_id)
      ? position.last_content_id
      : (items[0]?.content.content_id ?? null),
  )
  const [state, setState] = useState(() => readFeedSession(identity))
  const stateRef = useRef(state)
  const [storageFailed, setStorageFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const moving = useRef(false)
  const mounted = useRef(true)
  const navigationTime = useRef(0)
  const candidateRequest = useRef<AbortController | null>(null)
  const appliedResponse = useRef<number | null>(null)
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
  const advance = async () => {
    if (moving.current || !mounted.current) return
    moving.current = true
    setBusy(true)
    setError('')
    try {
      const current = stateRef.current
      if (current.count >= interval && current.completed.length > current.evaluatedAt) {
        const controller = new AbortController()
        candidateRequest.current = controller
        const result = await getFeedCandidate(
          identity,
          current.shown,
          current.retry,
          controller.signal,
        )
        if (!mounted.current) return
        if (result.candidate) {
          update((previous) => ({
            ...previous,
            pending: {
              question: result.candidate!,
              attemptId: crypto.randomUUID(),
              eventId: crypto.randomUUID(),
              nextContentId: nextId,
              shown: false,
              submission: null,
            },
          }))
          return
        }
        // 후보가 없으면 카운터를 유지하고, 새 콘텐츠 완료 후에만 다시 후보를 요청한다.
        update((previous) => ({ ...previous, evaluatedAt: previous.completed.length }))
      }
      if (mounted.current) setCurrentId(nextId)
    } catch (cause) {
      if (mounted.current && !(cause instanceof Error && cause.name === 'AbortError'))
        setError(cause instanceof Error ? cause.message : '복기 대상을 확인하지 못했어요.')
    } finally {
      moving.current = false
      if (mounted.current) setBusy(false)
    }
  }
  const onReady = useCallback(() => {
    update((previous) => {
      const pending = previous.pending
      if (!pending || pending.shown) return previous
      return {
        ...previous,
        count: 0,
        evaluatedAt: previous.completed.length,
        shown: [...new Set([...previous.shown, pending.question.question_version_id])],
        retry: previous.retry.filter((id) => id !== pending.question.question_version_id),
        pending: { ...pending, shown: true },
      }
    })
  }, [update])
  const onResponse = useCallback(
    (response: LearningResponse) => {
      if (appliedResponse.current === response.response_id) return
      appliedResponse.current = response.response_id
      update((previous) => {
        if (previous.pending?.attemptId !== response.attempt_id) return previous
        const id = response.question.question_version_id
        return {
          ...previous,
          retry:
            response.result === 'WRONG'
              ? [...new Set([...previous.retry, id])]
              : previous.retry.filter((version) => version !== id),
        }
      })
    },
    [update],
  )
  const onSubmission = useCallback(
    (optionId: number | null) => {
      update((previous) =>
        !previous.pending || previous.pending.submission !== null
          ? previous
          : {
              ...previous,
              pending: { ...previous.pending, submission: { optionId } },
            },
      )
    },
    [update],
  )
  const finishReview = () => {
    const next = stateRef.current.pending?.nextContentId ?? null
    update((previous) => ({ ...previous, pending: null }))
    setCurrentId(items.some((item) => item.content.content_id === next) ? next : null)
    setError('')
  }

  return (
    <>
      {storageFailed ? (
        <div className="sasu-page" role="alert">
          이 브라우저에서는 복기 진행 상태를 보관하지 못했어요. 새로고침하면 진행 상태가 사라질 수
          있어요.
        </div>
      ) : null}
      {feed.resume_unavailable ? (
        <div className="sasu-page" role="status">
          마지막 영상은 현재 이용할 수 없어 다른 추천 영상부터 보여 드려요.
        </div>
      ) : null}
      {error ? (
        <div className="sasu-page" role="alert">
          <p>{error}</p>
          <Button onClick={() => void advance()} disabled={busy}>
            다시 확인
          </Button>
        </div>
      ) : null}
      {state.pending ? (
        <FeedReview
          key={state.pending.attemptId}
          identity={identity}
          pending={state.pending}
          onReady={onReady}
          onResponse={onResponse}
          onSubmission={onSubmission}
          onContinue={finishReview}
        />
      ) : currentId !== null && index >= 0 ? (
        <FeedVideo
          key={currentId}
          identity={identity}
          item={items[index]}
          onWatchReport={(result) => onWatchReport(currentId, result)}
          onNext={advance}
          onPrevious={previousId === undefined ? undefined : () => setCurrentId(previousId)}
          busy={busy}
          last={nextId === null}
          navigationTime={navigationTime}
        />
      ) : (
        <div className="sasu-page">
          <StateBlock
            title={items.length ? '추천 영상을 모두 확인했어요.' : '아직 공개된 영상이 없어요.'}
            action={
              <>
                <Button onClick={reload}>추천 다시 불러오기</Button>
                {previousId !== undefined ? (
                  <Button onClick={() => setCurrentId(previousId)}>이전 영상</Button>
                ) : null}
                <Link className="sasu-link" to="/learner/search">
                  영상 검색하기
                </Link>
              </>
            }
          />
        </div>
      )}
    </>
  )
}

function FeedVideo({
  identity,
  item,
  onNext,
  onPrevious,
  onWatchReport,
  busy,
  last,
  navigationTime,
}: {
  identity: LearningIdentity
  item: FeedItem
  onNext: () => Promise<void>
  onPrevious?: () => void
  onWatchReport: (result: WatchResult) => void
  busy: boolean
  last: boolean
  navigationTime: { current: number }
}) {
  const id = item.content.content_id
  const detail = useQuery({
    queryKey: learningKey(identity, 'content', id),
    queryFn: ({ signal }) => getLearningContent(identity, id, signal),
  })
  const question = useQuery({
    queryKey: learningKey(identity, 'question', id),
    queryFn: ({ signal }) => getLearningQuestion(identity, id, signal),
  })
  const position = useMutation({
    scope: { id: `feed-position:${identity.learnerId}:${identity.generation}` },
    mutationFn: () => saveFeedPosition(identity, id),
  })
  const save = position.mutate
  useEffect(() => {
    save()
  }, [save])

  if (detail.isPending)
    return (
      <div className="sasu-page">
        <StateBlock title="영상을 불러오는 중이에요." />
      </div>
    )
  if (
    !detail.data ||
    !detail.data.content.video_url ||
    !detail.data.content.media_revision ||
    !detail.data.content.video_duration
  )
    return (
      <div className="sasu-page">
        <StateBlock
          title="현재 영상을 불러올 수 없어요."
          text={detail.error?.message}
          action={
            <>
              <Button onClick={() => void detail.refetch()}>다시 시도</Button>
              <Button disabled={busy} onClick={() => void onNext()}>
                다음 영상
              </Button>
            </>
          }
        />
      </div>
    )
  return (
    <>
      {position.isError ? (
        <div className="sasu-page" role="alert">
          <p>마지막 영상 위치를 저장하지 못했어요. {position.error.message}</p>
          <Button onClick={() => save()}>위치 다시 저장</Button>
        </div>
      ) : null}
      {detail.isError ? (
        <div className="sasu-page" role="alert">
          <p>영상 정보를 갱신하지 못했어요. {detail.error.message}</p>
          <Button onClick={() => void detail.refetch()}>정보 다시 불러오기</Button>
        </div>
      ) : null}
      <ContentViewer
        key={detail.data.content.media_revision}
        identity={identity}
        detail={detail.data}
        question={question.data}
        questionError={question.error}
        retryQuestion={() => void question.refetch()}
        context="FEED"
        backTo="/learner/search"
        backLabel="영상 검색"
        recommendationLabel={item.recommendation_label}
        onNext={onNext}
        onPrevious={onPrevious}
        onWatchReport={onWatchReport}
        navigationTime={navigationTime}
        navigationPending={busy}
        nextLabel={last ? '피드 마치기' : '다음 영상 →'}
      />
    </>
  )
}

function FeedReview({
  identity,
  pending,
  onReady,
  onResponse,
  onSubmission,
  onContinue,
}: {
  identity: LearningIdentity
  pending: PendingFeedReview
  onReady: () => void
  onResponse: (response: LearningResponse) => void
  onSubmission: (optionId: number | null) => void
  onContinue: () => void
}) {
  const recovery = useQuery({
    queryKey: learningKey(identity, 'feed-attempt-recovery', pending.attemptId),
    queryFn: async ({ signal }) => {
      try {
        const result = await recoverLearningAttempt(identity, pending.attemptId, signal)
        if (
          result.user_id !== identity.learnerId ||
          result.record_generation !== identity.generation ||
          result.response_path !== 'FEED_REVIEW' ||
          result.question.question_version_id !== pending.question.question_version_id
        ) {
          throw new ApiError(
            409,
            'REVIEW_SESSION_MISMATCH',
            '이 복기와 저장된 풀이가 일치하지 않아요.',
          )
        }
        return result
      } catch (cause) {
        if (cause instanceof ApiError && cause.code === 'ATTEMPT_NOT_FOUND') return null
        throw cause
      }
    },
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  })
  const source = useQuery({
    queryKey: learningKey(identity, 'content', pending.question.content_id),
    queryFn: ({ signal }) => getLearningContent(identity, pending.question.content_id, signal),
  })
  if (recovery.isPending)
    return (
      <div className="sasu-page">
        <StateBlock title="복기 풀이를 확인하는 중이에요." />
      </div>
    )
  if (recovery.isError)
    return (
      <div className="sasu-page">
        <StateBlock
          title="복기 풀이를 불러오지 못했어요."
          text={recovery.error.message}
          action={
            <>
              <Button onClick={() => void recovery.refetch()}>다시 시도</Button>
              <Button onClick={onContinue}>복기 닫기</Button>
            </>
          }
        />
      </div>
    )
  return (
    <div className="sasu-page sasu-review">
      <header className="sasu-page__head">
        <p className="sasu-eyebrow">피드 복기</p>
        <h1 className="sasu-title">이전에 본 내용을 떠올려 보세요</h1>
        <p className="sasu-sub">{source.data?.content.title ?? '이전에 학습한 영상'}</p>
      </header>
      <section className="sasu-card">
        <QuizView
          identity={identity}
          question={pending.question}
          responsePath="FEED_REVIEW"
          attemptId={pending.attemptId}
          eventId={pending.eventId}
          restoredAttempt={recovery.data?.submitted ? recovery.data : undefined}
          initialSubmission={pending.submission}
          onSubmission={onSubmission}
          onReady={onReady}
          onResponse={onResponse}
          onUnavailable={onContinue}
          footer={() => (
            <Button variant="primary" onClick={onContinue}>
              {pending.nextContentId === null ? '피드 마치기' : '다음 영상 →'}
            </Button>
          )}
        />
        <p>
          <Link
            className="sasu-link"
            to={`/learner/watch/${pending.question.content_id}?from=review`}
            state={{ context: 'REVIEW', returnTo: '/learner/feed' }}
          >
            원본 영상 보기
          </Link>
        </p>
      </section>
    </div>
  )
}
