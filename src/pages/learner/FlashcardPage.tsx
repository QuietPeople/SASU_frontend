import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useLocation, useSearchParams } from 'react-router'
import { api, queryString, type ApiPage } from '../../api/client'
import {
  getFlashcardAnswer,
  learningKey,
  recordLearningEvent,
  type LearningFlashcard,
  type LearningIdentity,
} from '../../api/learning'
import { useSession } from '../../state/session'
import { Button, StateBlock } from '../../shared/ui'

export function FlashcardPage() {
  const { actorId, learnerId, generation, isPending, error, refreshSettings } = useSession()
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
  return (
    <>
      {error ? (
        <div className="sasu-page" role="alert">
          <p>학습자 정보를 갱신하지 못했어요. {error.message}</p>
          <Button onClick={() => void refreshSettings()}>정보 다시 불러오기</Button>
        </div>
      ) : null}
      <CardList key={`${actorId}:${learnerId}:${generation}`} identity={identity} />
    </>
  )
}

function CardList({ identity }: { identity: LearningIdentity }) {
  const [params, setParams] = useSearchParams()
  const location = useLocation()
  const returnTo =
    (location.state as { returnTo?: string } | null)?.returnTo ?? params.get('returnTo')
  const backTo = returnTo?.startsWith('/learner/library') ? returnTo : '/learner/library?tab=cards'
  const rawVersion = params.get('questionVersionId')
  const versionId = rawVersion === null ? null : Number(rawVersion)
  const category = Number(params.get('category')) || undefined
  const page = Math.max(1, Math.trunc(Number(params.get('page')) || 1))
  const cards = useQuery({
    queryKey: learningKey(identity, 'flashcards', versionId, category, page),
    queryFn: async ({ signal }) => {
      let currentPage = versionId === null ? page : 1
      while (true) {
        const result = await api<ApiPage<LearningFlashcard>>(
          `/users/${identity.learnerId}/reviews/flashcards${queryString({ page: currentPage, size: 20, category_id: category })}`,
          { actorId: identity.actorId, signal },
        )
        if (
          versionId === null ||
          result.items.some((card) => card.question_version_id === versionId) ||
          !result.has_next
        )
          return result
        currentPage += 1
      }
    },
    enabled: versionId === null || (Number.isInteger(versionId) && versionId > 0),
    retry: false,
  })
  if (versionId !== null && (!Number.isInteger(versionId) || versionId <= 0))
    return (
      <div className="sasu-page">
        <StateBlock
          title="올바른 카드 주소가 아니에요."
          action={<Link to={backTo}>보관함으로</Link>}
        />
      </div>
    )
  if (cards.isPending)
    return (
      <div className="sasu-page">
        <StateBlock title="카드를 불러오는 중이에요." />
      </div>
    )
  if (cards.isError)
    return (
      <div className="sasu-page">
        <StateBlock
          title="카드를 불러오지 못했어요."
          text={cards.error.message}
          action={<Button onClick={() => void cards.refetch()}>다시 시도</Button>}
        />
      </div>
    )
  const index =
    versionId === null
      ? params.get('edge') === 'last'
        ? cards.data.items.length - 1
        : 0
      : cards.data.items.findIndex((card) => card.question_version_id === versionId)
  const card = cards.data.items[index]
  if (!card)
    return (
      <div className="sasu-page">
        <StateBlock
          title="현재 이용할 수 있는 카드가 없어요."
          text="보관함에서 최신 카드 목록을 확인해 주세요."
          action={<Link to={backTo}>카드 보관함으로</Link>}
        />
      </div>
    )
  const move = (direction: -1 | 1) => {
    const next = new URLSearchParams(params)
    next.delete('edge')
    next.set('returnTo', backTo)
    const adjacent = cards.data.items[index + direction]
    if (adjacent) next.set('questionVersionId', String(adjacent.question_version_id))
    else {
      next.delete('questionVersionId')
      next.set('page', String(cards.data.page + direction))
      if (direction === -1) next.set('edge', 'last')
    }
    setParams(next)
  }
  return (
    <OpenedCard
      key={`${card.question_version_id}`}
      identity={identity}
      card={card}
      backTo={backTo}
      previous={index > 0 || cards.data.page > 1 ? () => move(-1) : undefined}
      next={index + 1 < cards.data.items.length || cards.data.has_next ? () => move(1) : undefined}
    />
  )
}

function OpenedCard({
  identity,
  card,
  backTo,
  previous,
  next,
}: {
  identity: LearningIdentity
  card: LearningFlashcard
  backTo: string
  previous?: () => void
  next?: () => void
}) {
  const [viewId] = useState(() => crypto.randomUUID())
  const [flipId] = useState(() => crypto.randomUUID())
  const [reveal, setReveal] = useState(false)
  const viewed = useMutation({
    mutationFn: () =>
      recordLearningEvent(identity, viewId, {
        event_type: 'FLASHCARD_VIEWED',
        content_id: card.content_id,
        question_version_id: card.question_version_id,
      }),
  })
  const logView = viewed.mutate
  // 앞면이 화면에 반영된 뒤 노출을 기록한다. 재시도에도 같은 UUID를 사용한다.
  useEffect(() => {
    logView()
  }, [logView])
  const answer = useQuery({
    queryKey: learningKey(identity, 'card-answer', card.question_version_id, flipId),
    queryFn: ({ signal }) => getFlashcardAnswer(identity, card.question_version_id, signal),
    enabled: reveal,
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
  })
  const flipped = useMutation({
    mutationFn: () =>
      recordLearningEvent(identity, flipId, {
        event_type: 'FLASHCARD_FLIPPED',
        content_id: card.content_id,
        question_version_id: card.question_version_id,
      }),
  })
  const logFlip = flipped.mutate
  // 정답 조회·표시를 먼저 완료한다. 이벤트 저장 실패는 이미 표시한 정답을 숨기지 않는다.
  useEffect(() => {
    if (answer.isSuccess) logFlip()
  }, [answer.isSuccess, logFlip])
  return (
    <div className="sasu-page sasu-flash">
      <div className="sasu-review__top">
        <Link className="sasu-link" to={backTo}>
          ← 보관함으로
        </Link>
        <span className="sasu-sub">
          {card.content_title} · {card.category.name}
        </span>
      </div>
      <section className="sasu-card sasu-flash__card">
        <p className="sasu-eyebrow">질문 카드</p>
        <p className="sasu-flash__q">{card.front}</p>
        {viewed.isError ? (
          <div role="alert">
            <p>{viewed.error.message}</p>
            <Button onClick={() => logView()}>열람 기록 다시 저장</Button>
          </div>
        ) : null}
        {!reveal ? (
          <>
            <p className="sasu-muted">답을 떠올려 보세요.</p>
            <Button variant="primary" onClick={() => setReveal(true)}>
              정답 확인
            </Button>
          </>
        ) : answer.isPending ? (
          <p role="status">정답을 불러오는 중이에요.</p>
        ) : answer.isError ? (
          <div role="alert">
            <p>{answer.error.message}</p>
            <Button onClick={() => void answer.refetch()}>다시 시도</Button>
          </div>
        ) : (
          <div className="sasu-flash__answer" role="status">
            <span className="sasu-lp__label">정답</span>
            <p className="sasu-flash__a">{answer.data.back}</p>
            <p className="sasu-muted">{answer.data.explanation}</p>
          </div>
        )}
        {flipped.isError ? (
          <div role="alert">
            <p>펼침 기록: {flipped.error.message}</p>
            <Button onClick={() => logFlip()}>펼침 기록 다시 저장</Button>
          </div>
        ) : null}
      </section>
      <div className="sasu-row">
        <Link
          className="sasu-link"
          to={`/learner/watch/${card.content_id}?from=card&questionVersionId=${card.question_version_id}&category=${card.category.category_id}&returnTo=${encodeURIComponent(backTo)}`}
        >
          원본 영상
        </Link>
        <Button disabled={!previous} onClick={previous}>
          이전 카드
        </Button>
        <Button disabled={!next} onClick={next}>
          다음 카드
        </Button>
        <Link className="sasu-link" to={backTo}>
          복습 종료
        </Link>
      </div>
      <p className="sasu-help">카드 열람과 정답 펼침은 퀴즈 정답 제출로 기록되지 않아요.</p>
    </div>
  )
}
