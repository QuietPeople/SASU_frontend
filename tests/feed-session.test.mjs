import assert from 'node:assert/strict'
import { beforeEach, afterEach, test } from 'node:test'
import {
  readFeedSession,
  writeFeedSession,
  clearOldFeedSessions,
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
    attemptId: 'ddcae18c-41ca-4202-a3cc-72f2d6b16b23',
    eventId: 'c927f95e-01c6-43bc-b96f-1b690019ce05',
    nextContentId: 12,
    shown: true,
    submission: { optionId: 9 },
  },
}

test('새로고침 후에도 복기 카운터·노출 집합·풀이와 이벤트 UUID·미확정 답을 복원한다', async () => {
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

test('건너뛰기 제출의 null 답과 후보 없음 후 유지된 카운터도 복원한다', async () => {
  const skipped = {
    ...state,
    count: 6,
    evaluatedAt: 6,
    pending: { ...state.pending, submission: { optionId: null } },
  }
  writeFeedSession(identity, skipped)
  const fresh = await import('../src/features/feed/session.ts?skip=1')
  assert.deepEqual(fresh.readFeedSession(identity), skipped)
})
