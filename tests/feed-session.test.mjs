import assert from 'node:assert/strict'
import { beforeEach, afterEach, test } from 'node:test'
import {
  readFeedSession,
  writeFeedSession,
  clearOldFeedSessions,
  createFeedCard,
  updateFeedCard,
  cardBetween,
} from '../src/features/feed/session.ts'

class Storage {
  rows = new Map()
  get length() {
    return this.rows.size
  }
  getItem(key) {
    return this.rows.get(key) ?? null
  }
  setItem(key, value) {
    this.rows.set(key, String(value))
  }
  removeItem(key) {
    this.rows.delete(key)
  }
  key(index) {
    return [...this.rows.keys()][index] ?? null
  }
}
const original = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage')
beforeEach(() =>
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: new Storage() }),
)
afterEach(() => {
  if (original) Object.defineProperty(globalThis, 'sessionStorage', original)
  else delete globalThis.sessionStorage
})
const identity = { actorId: 42, learnerId: 42, generation: 3 }
const state = {
  completed: [1, 2, 3, 4, 5],
  count: 0,
  evaluatedAt: 5,
  shown: [7, 11],
  retry: [7],
  pending: {
    question: {
      question_id: 6,
      question_version_id: 7,
      content_id: 8,
      question_type: 'OX',
      question_text: '맞나요?',
      options: [{ option_id: 9, option_order: 1, option_text: 'O' }],
    },
    id: 'ddcae18c-41ca-4202-a3cc-72f2d6b16b23',
    viewEventId: 'c927f95e-01c6-43bc-b96f-1b690019ce05',
    flipEventId: '769ade93-e7ac-4052-b1ee-7c37c19a57f2',
    previousContentId: 5,
    nextContentId: 12,
    shown: true,
    flipped: true,
  },
  cards: [],
}
state.cards = [state.pending]

test('새로고침 후에도 복기 카운터·삽입 위치·카드 앞뒤 상태·이벤트 UUID를 복원한다', async () => {
  assert.equal(writeFeedSession(identity, state), true)
  const fresh = await import('../src/features/feed/session.ts?reload=1')
  assert.deepEqual(fresh.readFeedSession(identity), state)
  assert.deepEqual(readFeedSession({ ...identity, learnerId: 43 }).completed, [])
  assert.deepEqual(readFeedSession({ ...identity, generation: 4 }).completed, [])
})

test('다른 창은 동일 사용자라도 이전 창의 복기 진행을 재사용하지 않는다', async () => {
  writeFeedSession(identity, state)
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: new Storage() })
  const otherWindow = await import('../src/features/feed/session.ts?window=2')
  assert.equal(otherWindow.readFeedSession(identity).count, 0)
  assert.deepEqual(otherWindow.readFeedSession(identity).completed, [])
  assert.equal(otherWindow.readFeedSession(identity).pending, null)
})

test('세대 정리는 대상 사용자의 이전 상태만 제거하고 다른 사용자·현재 세대는 유지한다', () => {
  const other = { ...identity, learnerId: 43 }
  const current = { ...identity, generation: 4 }
  writeFeedSession(identity, state)
  writeFeedSession(other, state)
  writeFeedSession(current, { ...state, completed: [99], pending: null })
  clearOldFeedSessions(42, 4)
  assert.equal(sessionStorage.getItem('sasu:feed:v1:42:3'), null)
  assert.equal(readFeedSession(identity).pending, null)
  assert.deepEqual(readFeedSession(current).completed, [99])
  assert.deepEqual(readFeedSession(other), state)
})

test('손상된 저장 내용과 잘못된 재출제 집합은 복원하지 않는다', async () => {
  sessionStorage.setItem('sasu:feed:v1:42:3', '{broken')
  const fresh = await import('../src/features/feed/session.ts?invalid=1')
  assert.equal(fresh.readFeedSession(identity).pending, null)
  sessionStorage.setItem('sasu:feed:v1:42:3', JSON.stringify({ ...state, retry: [999] }))
  assert.deepEqual(fresh.readFeedSession(identity).shown, [])
  sessionStorage.setItem(
    'sasu:feed:v1:42:3',
    JSON.stringify({ ...state, pending: { attemptId: 'bad' } }),
  )
  assert.equal(fresh.readFeedSession(identity).pending, null)
})

test('저장소 제한 시 실패를 알리고 메모리로 이어가되 새로고침 복원을 가장하지 않는다', async () => {
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: {
      getItem() {
        throw new Error('blocked')
      },
      setItem() {
        throw new Error('blocked')
      },
    },
  })
  assert.equal(writeFeedSession(identity, state), false)
  assert.deepEqual(readFeedSession(identity), state)
  const fresh = await import('../src/features/feed/session.ts?blocked=1')
  assert.equal(fresh.readFeedSession(identity).pending, null)
})

test('기존 퀴즈형 복기는 카운터를 유지하며 새 카드 이벤트 UUID로 한 번만 전환한다', async () => {
  const legacy = {
    ...state,
    count: 6,
    evaluatedAt: 6,
    pending: {
      question: state.pending.question,
      attemptId: state.pending.id,
      eventId: state.pending.viewEventId,
      nextContentId: 12,
      shown: true,
      submission: { optionId: null },
    },
  }
  delete legacy.cards
  sessionStorage.setItem('sasu:feed:v1:42:3', JSON.stringify(legacy))
  const fresh = await import('../src/features/feed/session.ts?legacy=1')
  const restored = fresh.readFeedSession(identity)
  assert.equal(restored.count, 6)
  assert.equal(restored.pending.shown, true)
  assert.equal(restored.pending.flipped, false)
  assert.notEqual(restored.pending.viewEventId, legacy.pending.eventId)
  assert.notEqual(restored.pending.flipEventId, restored.pending.viewEventId)
  assert.equal('submission' in restored.pending, false)
  assert.deepEqual(restored.cards, [restored.pending])
  assert.deepEqual(fresh.readFeedSession(identity), restored)
})

test('영상 사이의 카드를 다시 방문해도 같은 이벤트 키와 마지막 앞뒤 상태를 사용한다', () => {
  const card = createFeedCard(state.pending.question, 5, 6)
  let flow = { ...state, pending: card, cards: [card] }
  flow = updateFeedCard(flow, card.id, { shown: true, flipped: true })
  assert.equal(flow.pending.flipped, true)
  flow = { ...flow, pending: null }
  const previousItem = cardBetween(flow, 5, 6)
  assert.equal(previousItem.flipped, true)
  assert.equal(previousItem.viewEventId, card.viewEventId)
  assert.equal(previousItem.flipEventId, card.flipEventId)
  assert.equal(cardBetween(flow, 6, 7), undefined)
  assert.equal(flow.count, state.count)
})

test('답을 보지 않고 카드를 넘겨도 응답·오답·재출제 기록을 생성하지 않는다', () => {
  const card = createFeedCard(state.pending.question, 5, 6)
  const flow = updateFeedCard({ ...state, pending: card, cards: [card] }, card.id, { shown: true })
  const skipped = { ...flow, pending: null }
  assert.equal(skipped.cards[0].flipped, false)
  assert.equal('submission' in skipped.cards[0], false)
  assert.equal('attemptId' in skipped.cards[0], false)
  assert.deepEqual(skipped.retry, state.retry)
})
