import type { LearningIdentity, LearningQuestion } from '../../api/learning'

export interface PendingFeedReview {
  question: LearningQuestion
  id: string
  viewEventId: string
  flipEventId: string
  previousContentId: number | null
  nextContentId: number | null
  shown: boolean
  flipped: boolean
}
export interface FeedSession {
  completed: number[]
  count: number
  evaluatedAt: number
  shown: number[]
  retry: number[]
  pending: PendingFeedReview | null
  cards: PendingFeedReview[]
}

const prefix = 'sasu:feed:v1:'
const memory = new Map<string, FeedSession>()
function key(identity: LearningIdentity) {
  return `${prefix}${identity.learnerId}:${identity.generation}`
}
function empty(): FeedSession {
  return { completed: [], count: 0, evaluatedAt: 0, shown: [], retry: [], pending: null, cards: [] }
}
function ids(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((id) => Number.isSafeInteger(id) && id > 0)
}
function validQuestion(value: unknown): value is LearningQuestion {
  if (!value || typeof value !== 'object') return false
  const question = value as LearningQuestion
  return (
    ids([question.question_id, question.question_version_id, question.content_id]) &&
    typeof question.question_text === 'string' &&
    ['OX', 'MCQ_3', 'MCQ_4'].includes(question.question_type) &&
    Array.isArray(question.options) &&
    question.options.every(
      (o) => ids([o.option_id, o.option_order]) && typeof o.option_text === 'string',
    )
  )
}

function validCard(value: unknown): value is PendingFeedReview {
  if (!value || typeof value !== 'object') return false
  const card = value as PendingFeedReview
  return (
    validQuestion(card.question) &&
    typeof card.id === 'string' &&
    typeof card.viewEventId === 'string' &&
    typeof card.flipEventId === 'string' &&
    typeof card.shown === 'boolean' &&
    typeof card.flipped === 'boolean' &&
    (card.previousContentId === null || ids([card.previousContentId])) &&
    (card.nextContentId === null || ids([card.nextContentId]))
  )
}

function validCounters(value: unknown): value is FeedSession {
  if (!value || typeof value !== 'object') return false
  const v = value as FeedSession
  return (
    ids(v.completed) &&
    ids(v.shown) &&
    ids(v.retry) &&
    Number.isSafeInteger(v.count) &&
    v.count >= 0 &&
    Number.isSafeInteger(v.evaluatedAt) &&
    v.evaluatedAt >= 0 &&
    v.retry.every((id) => v.shown.includes(id))
  )
}

export function createFeedCard(
  question: LearningQuestion,
  previousContentId: number | null,
  nextContentId: number | null,
): PendingFeedReview {
  return {
    question,
    id: crypto.randomUUID(),
    viewEventId: crypto.randomUUID(),
    flipEventId: crypto.randomUUID(),
    previousContentId,
    nextContentId,
    shown: false,
    flipped: false,
  }
}

export function updateFeedCard(
  state: FeedSession,
  id: string,
  change: Partial<Pick<PendingFeedReview, 'shown' | 'flipped'>>,
): FeedSession {
  return {
    ...state,
    pending: state.pending?.id === id ? { ...state.pending, ...change } : state.pending,
    cards: state.cards.map((card) => (card.id === id ? { ...card, ...change } : card)),
  }
}

export function cardBetween(state: FeedSession, before: number | null, after: number | null) {
  return state.cards.find(
    (card) => card.previousContentId === before && card.nextContentId === after,
  )
}

function restore(value: unknown): FeedSession | null {
  if (!validCounters(value)) return null
  if (Array.isArray(value.cards)) {
    if (!value.cards.every(validCard) || (value.pending !== null && !validCard(value.pending)))
      return null
    return value
  }
  // 기존 퀴즈형 복기의 카운터는 이어받되, 노출 이벤트 키를 카드 이벤트에 재사용하지 않는다.
  const legacy = value.pending as unknown as {
    question?: LearningQuestion
    attemptId?: string
    eventId?: string
    nextContentId?: number | null
    shown?: boolean
  } | null
  if (legacy === null) return { ...value, cards: [] }
  if (
    !legacy ||
    !validQuestion(legacy.question) ||
    typeof legacy.attemptId !== 'string' ||
    typeof legacy.eventId !== 'string' ||
    typeof legacy.shown !== 'boolean' ||
    !(legacy.nextContentId === null || ids([legacy.nextContentId]))
  )
    return null
  const card = {
    ...createFeedCard(legacy.question, null, legacy.nextContentId!),
    shown: legacy.shown,
  }
  return { ...value, pending: card, cards: [card] }
}

// 추천 순서는 서버를 따르고, 이 탭의 복기 진행만 보관한다.
export function readFeedSession(identity: LearningIdentity): FeedSession {
  const storageKey = key(identity)
  try {
    const raw = sessionStorage.getItem(storageKey)
    if (raw) {
      const value: unknown = JSON.parse(raw)
      const restored = restore(value)
      if (restored) {
        writeFeedSession(identity, restored)
        return restored
      }
    }
  } catch {
    /* 저장소 제한 시 이 탭의 메모리 상태를 사용한다. */
  }
  return memory.get(storageKey) ?? empty()
}

export function writeFeedSession(identity: LearningIdentity, state: FeedSession) {
  const storageKey = key(identity)
  memory.set(storageKey, state)
  try {
    sessionStorage.setItem(storageKey, JSON.stringify(state))
    return true
  } catch {
    return false
  }
}

export function clearOldFeedSessions(userId: number, generation: number) {
  const userPrefix = `${prefix}${userId}:`
  const current = `${userPrefix}${generation}`
  for (const storageKey of memory.keys()) {
    if (storageKey.startsWith(userPrefix) && storageKey !== current) memory.delete(storageKey)
  }
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const storageKey = sessionStorage.key(i)
      if (storageKey?.startsWith(userPrefix) && storageKey !== current)
        sessionStorage.removeItem(storageKey)
    }
  } catch {
    /* 저장소 접근이 제한되어도 현재 세대의 상태만 사용한다. */
  }
}
