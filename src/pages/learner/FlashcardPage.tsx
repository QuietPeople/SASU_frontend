import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useLocation, useSearchParams } from 'react-router'
import { queryString } from '../../api/client'
import {
  getFlashcardAnswer,
  learningKey,
  recordLearningEvent,
  type LearningFlashcard,
  type LearningIdentity,
} from '../../api/learning'
import { useSession } from '../../state/session'
import { Button } from '../../shared/ui'
import { LearnerState as StateBlock } from '../../features/learner-navigation/LearnerState'
import { Flashcard } from '../../shared/Flashcard'
import { useFlashcardStyle } from '../../shared/useFlashcardStyle'
import { locateCard } from '../../features/learner-navigation/lists'
import {
  positiveId,
  readView,
  safeLibraryReturn,
  writeView,
} from '../../features/learner-navigation/state'
import '../../features/learner-navigation/learner-uiux.css'

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
  return <CardList key={`${actorId}:${learnerId}:${generation}`} identity={identity} />
}

function CardList({ identity }: { identity: LearningIdentity }) {
  const [params, setParams] = useSearchParams()
  const location = useLocation()
  const cache = useQueryClient()
  const returnTo =
    (location.state as { returnTo?: string } | null)?.returnTo ?? params.get('returnTo')
  const backTo = safeLibraryReturn(returnTo, 'cards')
  const rawVersion = params.get('questionVersionId')
  const versionId = rawVersion === null ? null : positiveId(rawVersion)
  const category = positiveId(params.get('category'))
  const page = positiveId(params.get('page')) ?? 1
  const [newCardSession] = useState(() => crypto.randomUUID())
  const requestedSession = params.get('cardSession')
  const cardSession =
    requestedSession &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestedSession)
      ? requestedSession
      : newCardSession
  useEffect(() => {
    if (params.get('cardSession') === cardSession) return
    const next = new URLSearchParams(params)
    next.set('cardSession', cardSession)
    setParams(next, { replace: true })
  }, [params, setParams, cardSession])
  const cards = useQuery({
    queryKey: learningKey(identity, 'flashcards', 'selection', versionId, category, page),
    queryFn: ({ signal }) => locateCard(cache, identity, category, page, versionId ?? null, signal),
    enabled: versionId !== undefined,
    retry: false,
  })
  if (versionId === undefined)
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
          error={cards.error}
          action={<Button onClick={() => void cards.refetch()}>다시 시도</Button>}
        />
      </div>
    )
  const index =
    versionId === null
      ? params.get('edge') === 'last'
        ? cards.data.items.length - 1
        : 0
      : cards.data.items.findIndex((item) => item.question_version_id === versionId)
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
    if (adjacent) {
      next.set('questionVersionId', String(adjacent.question_version_id))
      next.set('page', String(cards.data.page))
    } else {
      next.delete('questionVersionId')
      next.set('page', String(cards.data.page + direction))
      if (direction === -1) next.set('edge', 'last')
    }
    setParams(next)
  }
  const current = new URLSearchParams(params)
  current.set('questionVersionId', String(card.question_version_id))
  current.set('page', String(cards.data.page))
  current.set('returnTo', backTo)
  return (
    <OpenedCard
      key={`${cardSession}:${card.question_version_id}`}
      identity={identity}
      cardSession={cardSession}
      card={card}
      backTo={backTo}
      cardReturnTo={`/learner/cards?${current}`}
      position={(cards.data.page - 1) * cards.data.size + index + 1}
      total={cards.data.total}
      category={category}
      previous={index > 0 || cards.data.page > 1 ? () => move(-1) : undefined}
      next={index + 1 < cards.data.items.length || cards.data.has_next ? () => move(1) : undefined}
    />
  )
}

interface CardVisit {
  reveal: boolean
  viewId: string
  flipId: string
}
function OpenedCard({
  identity,
  cardSession,
  card,
  backTo,
  cardReturnTo,
  position,
  total,
  category,
  previous,
  next,
}: {
  identity: LearningIdentity
  cardSession: string
  card: LearningFlashcard
  backTo: string
  cardReturnTo: string
  position: number
  total: number
  category: number | undefined
  previous?: () => void
  next?: () => void
}) {
  const key = `${identity.actorId}:${identity.learnerId}:${identity.generation}:card:${cardSession}:${card.question_version_id}`
  const [visit] = useState<CardVisit>(() => {
    const saved = readView<CardVisit>(key)
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    return saved &&
      typeof saved.reveal === 'boolean' &&
      uuid.test(saved.viewId) &&
      uuid.test(saved.flipId)
      ? saved
      : { reveal: false, viewId: crypto.randomUUID(), flipId: crypto.randomUUID() }
  })
  const [reveal, setReveal] = useState(visit.reveal)
  const style = useFlashcardStyle()
  useEffect(() => writeView(key, { ...visit, reveal }), [key, visit, reveal])
  const viewed = useMutation({
    mutationFn: () =>
      recordLearningEvent(identity, visit.viewId, {
        event_type: 'FLASHCARD_VIEWED',
        content_id: card.content_id,
        question_version_id: card.question_version_id,
      }),
  })
  const logView = viewed.mutate
  useEffect(() => {
    logView()
  }, [logView])
  const answer = useQuery({
    queryKey: learningKey(identity, 'card-answer', card.question_version_id, visit.flipId),
    queryFn: ({ signal }) => getFlashcardAnswer(identity, card.question_version_id, signal),
    enabled: reveal,
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
  })
  const flipped = useMutation({
    mutationFn: () =>
      recordLearningEvent(identity, visit.flipId, {
        event_type: 'FLASHCARD_FLIPPED',
        content_id: card.content_id,
        question_version_id: card.question_version_id,
      }),
  })
  const logFlip = flipped.mutate
  useEffect(() => {
    if (reveal && answer.isSuccess) logFlip()
  }, [reveal, answer.isSuccess, logFlip])
  const isOX = answer.data?.back === 'O' || answer.data?.back === 'X'
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
      <p className="sasu-search__summary" aria-live="polite">
        {category ? card.category.name : '분야 전체'} · 전체 {total}개 중 {position}번째
      </p>
      <div className="sasu-flash__stage">
        <Flashcard
          question={card.front}
          answer={answer.data?.back ?? ''}
          isOX={isOX}
          style={style}
          flipped={reveal && answer.isSuccess}
          onFlip={() => setReveal((value) => !value)}
          disabled={reveal && answer.isPending}
        />
      </div>
      {reveal && answer.isPending ? <p role="status">정답을 불러오는 중이에요.</p> : null}
      {reveal && answer.isError ? (
        <StateBlock
          title="정답을 불러오지 못했어요."
          error={answer.error}
          action={<Button onClick={() => void answer.refetch()}>다시 시도</Button>}
        />
      ) : null}
      {reveal && answer.isSuccess ? (
        <section className="sasu-card" aria-label="정답 해설">
          <h2 className="sasu-card__title">해설</h2>
          <p>{answer.data.explanation}</p>
        </section>
      ) : null}
      {viewed.isError ? (
        <StateBlock
          title="열람 기록을 저장하지 못했어요."
          error={viewed.error}
          action={<Button onClick={() => logView()}>열람 기록 다시 저장</Button>}
        />
      ) : null}
      {flipped.isError ? (
        <StateBlock
          title="펼침 기록을 저장하지 못했어요."
          error={flipped.error}
          action={<Button onClick={() => logFlip()}>펼침 기록 다시 저장</Button>}
        />
      ) : null}
      <div className="sasu-flash__toolbar">
        <Button disabled={!previous} onClick={previous}>
          이전 카드
        </Button>
        <Button disabled={!next} onClick={next}>
          다음 카드
        </Button>
        <Link
          className="sasu-link"
          to={`/learner/watch/${card.content_id}${queryString({ from: 'card', questionVersionId: card.question_version_id, category, returnTo: backTo })}`}
          state={{ context: 'REVIEW', returnTo: cardReturnTo }}
        >
          원본 영상
        </Link>
        <Link className="sasu-link" to={backTo}>
          복습 종료
        </Link>
      </div>
      <p className="sasu-help">
        카드를 누르거나 Enter·Space 키를 누르면 앞뒤로 뒤집을 수 있어요. 카드 열람과 정답 확인은
        퀴즈 정답 제출로 기록되지 않아요.
      </p>
    </div>
  )
}
