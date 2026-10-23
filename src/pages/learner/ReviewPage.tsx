import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useLocation, useParams, useSearchParams } from 'react-router'
import {
  getWrongAnswers,
  getLearningContent,
  recoverLearningAttempt,
  learningKey,
  type LearningAttempt,
  type LearningIdentity,
  type LearningQuestion,
  type WrongAnswer,
} from '../../api/learning'
import { ApiError, queryString } from '../../api/client'
import { useSession } from '../../state/session'
import { QuizView } from '../../shared/QuizView'
import { Button, StateBlock } from '../../shared/ui'

function useReviewReturnTo() {
  const location = useLocation()
  const [params] = useSearchParams()
  const returnTo =
    (location.state as { returnTo?: string } | null)?.returnTo ?? params.get('returnTo')
  return returnTo?.startsWith('/learner/library') ? returnTo : '/learner/library?tab=wrong'
}

export function ReviewPage() {
  const backTo = useReviewReturnTo()
  const { actorId, learnerId, generation, isPending, error, refreshSettings } = useSession()
  const { contentId } = useParams()
  const [params] = useSearchParams()
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
  const versionId = params.get('questionVersionId') ? Number(params.get('questionVersionId')) : null
  if (
    !Number.isInteger(id) ||
    id <= 0 ||
    (versionId !== null && (!Number.isInteger(versionId) || versionId <= 0))
  )
    return (
      <div className="sasu-page">
        <StateBlock
          title="올바른 복습 주소가 아니에요."
          action={<Link to={backTo}>보관함으로</Link>}
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
      <WrongReview
        key={`${actorId}:${learnerId}:${generation}:${id}:${versionId}`}
        identity={identity}
        contentId={id}
        versionId={versionId}
      />
    </>
  )
}

interface ReviewTarget {
  question: LearningQuestion
  contentId: number
  title: string | null
  categoryName: string | null
}

interface ReviewData {
  target?: ReviewTarget
  next?: WrongAnswer
  restoredAttempt?: LearningAttempt
}

function WrongReview({
  identity,
  contentId,
  versionId,
}: {
  identity: LearningIdentity
  contentId: number
  versionId: number | null
}) {
  const backTo = useReviewReturnTo()
  const [params, setParams] = useSearchParams()
  const [newSessionId] = useState(() => crypto.randomUUID())
  const scope = `${identity.actorId}:${identity.learnerId}:${identity.generation}`
  const requestedSession = params.get('reviewSession')
  const restore =
    requestedSession !== null &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestedSession) &&
    params.get('reviewScope') === scope
  const attemptId = restore ? requestedSession : newSessionId

  // 원본 영상 왕복·새로고침에는 같은 풀이를 사용하고 새 보관함 진입은 새 세션으로 시작한다.
  useEffect(() => {
    if (params.get('reviewSession') === attemptId && params.get('reviewScope') === scope) return
    const next = new URLSearchParams(params)
    next.set('reviewSession', attemptId)
    next.set('reviewScope', scope)
    next.set('returnTo', backTo)
    setParams(next, { replace: true })
  }, [params, setParams, attemptId, scope, backTo])

  const wrong = useQuery<ReviewData>({
    queryKey: learningKey(identity, 'wrong-review', contentId, versionId, attemptId),
    enabled: (query) => query.state.data === undefined,
    queryFn: async ({ signal }) => {
      if (restore) {
        let restoredAttempt: LearningAttempt | undefined
        try {
          restoredAttempt = await recoverLearningAttempt(identity, attemptId, signal)
        } catch (cause) {
          // URL만 만들어지고 아직 풀이가 생성되지 않은 경우에는 현재 오답에서 시작한다.
          if (!(
            cause instanceof ApiError &&
            cause.status === 404 &&
            cause.code === 'ATTEMPT_NOT_FOUND'
          ))
            throw cause
        }
        if (restoredAttempt) {
          if (
            restoredAttempt.user_id !== identity.learnerId ||
            restoredAttempt.record_generation !== identity.generation ||
            restoredAttempt.response_path !== 'WRONG_NOTE' ||
            restoredAttempt.question.content_id !== contentId ||
            (versionId !== null && restoredAttempt.question.question_version_id !== versionId)
          ) {
            throw new ApiError(
              409,
              'REVIEW_SESSION_MISMATCH',
              '이 주소와 복습 풀이 정보가 일치하지 않아요. 보관함에서 다시 선택해 주세요.',
            )
          }
          let title: string | null = null
          let categoryName: string | null = null
          try {
            const detail = await getLearningContent(identity, contentId, signal)
            title = detail.content.title
            categoryName = detail.content.category?.name ?? null
          } catch (cause) {
            // 비공개로 바뀐 콘텐츠도 서버가 허용한 기존 풀이 결과는 확인할 수 있다.
            if (!(cause instanceof ApiError && cause.status === 404)) throw cause
          }
          return {
            target: { question: restoredAttempt.question, contentId, title, categoryName },
            restoredAttempt,
          }
        }
      }
      let page = 1
      let next: WrongAnswer | undefined
      while (true) {
        const result = await getWrongAnswers(identity, page, signal)
        const target = result.items.find(
          (item) =>
            item.content.content_id === contentId &&
            (versionId === null || item.question.question_version_id === versionId),
        )
        next ??= result.items.find((item) => item.content.content_id !== contentId)
        if (target || !result.has_next)
          return {
            target: target
              ? {
                  question: target.question,
                  contentId,
                  title: target.content.title,
                  categoryName: target.content.category?.name ?? null,
                }
              : undefined,
            next,
          }
        page += 1
      }
    },
    retry: false,
    // 제출 뒤에도 사용자가 이동할 때까지 현재 문항과 결과를 유지한다.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  })
  if (wrong.isPending)
    return (
      <div className="sasu-page">
        <StateBlock title="복습할 문항을 불러오는 중이에요." />
      </div>
    )
  if (wrong.isError)
    return (
      <div className="sasu-page">
        <StateBlock
          title="복습 문항을 불러오지 못했어요."
          text={wrong.error.message}
          action={
            <>
              {!(
                wrong.error instanceof ApiError && wrong.error.code === 'REVIEW_SESSION_MISMATCH'
              ) ? (
                <Button onClick={() => void wrong.refetch()}>다시 시도</Button>
              ) : null}
              <Link className="sasu-link" to={backTo}>
                현재 오답 목록 확인
              </Link>
            </>
          }
        />
      </div>
    )
  if (!wrong.data.target)
    return (
      <div className="sasu-page">
        <StateBlock
          title="현재 미해결 오답이 아닌 문항이에요."
          text="이미 해결되었거나 문항이 새 버전으로 바뀌었을 수 있어요. 보관함에서 현재 목록을 확인해 주세요."
          action={<Link to={backTo}>오답 보관함으로</Link>}
        />
      </div>
    )
  return (
    <OpenedReview
      key={attemptId}
      identity={identity}
      target={wrong.data.target}
      next={wrong.data.next}
      attemptId={attemptId}
      scope={scope}
      restoredAttempt={wrong.data.restoredAttempt}
    />
  )
}

function OpenedReview({
  identity,
  target,
  next,
  attemptId,
  scope,
  restoredAttempt,
}: {
  identity: LearningIdentity
  target: ReviewTarget
  next?: WrongAnswer
  attemptId: string
  scope: string
  restoredAttempt?: LearningAttempt
}) {
  const backTo = useReviewReturnTo()
  const sourceTo = `/learner/watch/${target.contentId}${queryString({ from: 'wrong', questionVersionId: target.question.question_version_id, returnTo: backTo, reviewSession: attemptId, reviewScope: scope })}`
  return (
    <div className="sasu-page sasu-review">
      <div className="sasu-review__top">
        <Link className="sasu-link" to={backTo}>
          ← 보관함으로
        </Link>
        <span className="sasu-sub">
          오답 복습 · {target.title ?? `콘텐츠 ${target.contentId}`} · {target.categoryName}
        </span>
      </div>
      <section className="sasu-card">
        <p>
          <Link className="sasu-link" to={sourceTo}>
            원본 영상 보기
          </Link>
        </p>
        <QuizView
          identity={identity}
          question={target.question}
          responsePath="WRONG_NOTE"
          attemptId={attemptId}
          restoredAttempt={restoredAttempt}
          context={`원본 영상: ${target.title ?? `콘텐츠 ${target.contentId}`}`}
          footer={(result) => (
            <div className="sasu-row">
              {result === 'CORRECT' && next ? (
                <Link
                  className="sasu-btn sasu-btn--primary"
                  to={`/learner/review/${next.content.content_id}?questionVersionId=${next.question.question_version_id}`}
                  state={{ returnTo: backTo }}
                >
                  다음 복습 →
                </Link>
              ) : (
                <Link className="sasu-link" to={backTo}>
                  보관함으로
                </Link>
              )}
            </div>
          )}
        />
        <p className="sasu-help">
          정답을 맞히면 미해결 오답이 풀려요. 건너뛰기는 추가 오답으로 기록하지 않아요.
        </p>
      </section>
    </div>
  )
}
