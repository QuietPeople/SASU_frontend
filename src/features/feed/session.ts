import type { LearningIdentity, LearningQuestion } from '../../api/learning'

export interface PendingFeedReview {
  question: LearningQuestion
  attemptId: string
  eventId: string
  nextContentId: number | null
  shown: boolean
  submission: { optionId: number | null } | null
}
export interface FeedSession {
  completed: number[]
  count: number
  evaluatedAt: number
  shown: number[]
  retry: number[]
  pending: PendingFeedReview | null
}

const prefix = 'sasu:feed:v1:'
const memory = new Map<string, FeedSession>()
function key(identity: LearningIdentity) {
  return `${prefix}${identity.learnerId}:${identity.generation}`
}
function empty(): FeedSession {
  return { completed: [], count: 0, evaluatedAt: 0, shown: [], retry: [], pending: null }
}
function ids(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((id) => Number.isSafeInteger(id) && id > 0)
}
function valid(value: unknown): value is FeedSession {
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
    v.retry.every((id) => v.shown.includes(id)) &&
    (v.pending === null ||
      (typeof v.pending?.attemptId === 'string' &&
        typeof v.pending.eventId === 'string' &&
        typeof v.pending.shown === 'boolean' &&
        (v.pending.nextContentId === null || ids([v.pending.nextContentId])) &&
        ids([
          v.pending.question?.question_id,
          v.pending.question?.question_version_id,
          v.pending.question?.content_id,
        ]) &&
        typeof v.pending.question.question_text === 'string' &&
        ['OX', 'MCQ_3', 'MCQ_4'].includes(v.pending.question.question_type) &&
        Array.isArray(v.pending.question.options) &&
        v.pending.question.options.every(
          (o) => ids([o.option_id, o.option_order]) && typeof o.option_text === 'string',
        ) &&
        (v.pending.submission === null ||
          v.pending.submission?.optionId === null ||
          ids([v.pending.submission?.optionId]))))
  )
}

// 추천 순서는 서버를 따르고, 이 탭의 복기 진행만 보관한다.
export function readFeedSession(identity: LearningIdentity): FeedSession {
  const storageKey = key(identity)
  try {
    const raw = sessionStorage.getItem(storageKey)
    if (raw) {
      const value: unknown = JSON.parse(raw)
      if (valid(value)) {
        memory.set(storageKey, value)
        return value
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
