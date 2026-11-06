import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { afterEach, beforeEach, test } from 'node:test'
import { feedSlides } from '../src/features/feed/feedSlides.ts'

const sourceRoot = new URL('../src/', import.meta.url).href
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL?.startsWith(sourceRoot) && specifier.startsWith('.')) {
      const url = new URL(specifier, context.parentURL)
      if (existsSync(new URL(url.href + '.ts'))) return nextResolve(url.href + '.ts', context)
    }
    return nextResolve(specifier, context)
  },
})
let createFeedEntry, getFeedEntry, feedSessionAtEntry
try {
  ;({ createFeedEntry, getFeedEntry, feedSessionAtEntry } =
    await import('../src/features/feed/entry.ts'))
} finally {
  hooks.deregister()
}

const identity = { actorId: 42, learnerId: 42, generation: 3 }
const position = { user_id: 42, last_content_id: 8, resume_available: true, record_generation: 3 }
const content = (id) => ({ content_id: id, title: `영상 ${id}`, status: 'PUBLISHED' })
const item = (id) => ({
  content: content(id),
  recommendation_reason: 'UNWATCHED',
  recommendation_label: `추천 ${id}`,
})
const ranked = {
  items: [item(8), item(2), item(3)],
  resume_unavailable: false,
  record_generation: 3,
}
const ids = (entry) => entry.items.map((item) => item.content.content_id)
const realFetch = globalThis.fetch
const realWindow = globalThis.window
beforeEach(() => {
  globalThis.window = new EventTarget()
  globalThis.fetch = async () => assert.fail('예상하지 않은 API 요청')
})
afterEach(() => {
  globalThis.fetch = realFetch
  if (realWindow === undefined) delete globalThis.window
  else globalThis.window = realWindow
})

test('검색에서 선택한 영상으로 시작하고 나머지는 서버 추천 순서와 이유를 유지한다', () => {
  const entry = createFeedEntry(ranked, position, content(2))
  assert.deepEqual(ids(entry), [2, 8, 3])
  assert.equal(entry.initialContentId, 2)
  assert.equal(entry.explicitStart, true)
  assert.equal(entry.items[0].recommendation_label, '검색에서 선택한 영상')
  assert.equal(entry.items[1], ranked.items[0])
  assert.equal(entry.items[2].recommendation_label, '추천 3')
  assert.deepEqual(
    ranked.items.map((row) => row.content.content_id),
    [8, 2, 3],
  )
})

test('선택 영상과 추천 영상이 중복되어도 각 영상은 한 번만 이어진다', () => {
  const entry = createFeedEntry(
    { ...ranked, items: [...ranked.items, item(2), item(8)] },
    position,
    content(2),
  )
  assert.deepEqual(ids(entry), [2, 8, 3])
  assert.deepEqual(
    feedSlides(ids(entry), [], null).map((slide) => slide.key),
    ['video:2', 'video:8', 'video:3', 'end'],
  )
})

test('일반 피드 진입은 기존 마지막 위치로 재개하고, 유효한 위치가 없으면 첫 추천부터 시작한다', () => {
  assert.equal(createFeedEntry(ranked, { ...position, last_content_id: 3 }).initialContentId, 3)
  assert.equal(createFeedEntry(ranked, { ...position, last_content_id: 99 }).initialContentId, 8)
  assert.equal(
    createFeedEntry(ranked, { ...position, resume_available: false }).initialContentId,
    8,
  )
  assert.equal(createFeedEntry({ ...ranked, items: [] }, position).initialContentId, null)
  assert.equal(createFeedEntry(ranked, position).explicitStart, false)
})

test('직접 선택한 영상이 있으면 과거 이어보기 실패 안내를 보여주지 않는다', () => {
  const feed = { ...ranked, resume_unavailable: true }
  assert.equal(createFeedEntry(feed, position).resumeUnavailable, true)
  assert.equal(createFeedEntry(feed, position, content(2)).resumeUnavailable, false)
})

test('검색으로 진입하면 이전 복기 화면 대신 선택 영상부터 열고 누적 기록은 유지한다', () => {
  const pending = { id: 'review-1', previousContentId: 8, nextContentId: 3 }
  const state = {
    completed: [8],
    count: 1,
    evaluatedAt: 0,
    shown: [7],
    retry: [],
    cards: [pending],
    pending,
  }
  const next = feedSessionAtEntry(state, true)
  assert.equal(next.pending, null)
  assert.equal(state.pending, pending)
  for (const field of ['completed', 'count', 'evaluatedAt', 'shown', 'retry', 'cards'])
    assert.equal(next[field], state[field])
  assert.equal(feedSlides([2, 8, 3], next.cards, next.pending)[0].key, 'video:2')
  assert.equal(feedSessionAtEntry(state, false), state)
})

test('추천 응답에 선택 영상이 있으면 목록 추가 조회 없이 피드 조회만으로 시작 목록을 구성한다', async () => {
  const calls = []
  const controller = new AbortController()
  globalThis.fetch = async (url, options) => {
    calls.push(url)
    assert.equal(options.method, 'GET')
    assert.equal(options.signal, controller.signal)
    assert.equal(options.headers.get('X-Actor-Id'), '42')
    assert.ok(['/api/users/42/feed', '/api/users/42/feed-state'].includes(url))
    return Response.json(url.endsWith('feed-state') ? position : ranked)
  }
  const entry = await getFeedEntry(identity, 2, controller.signal)
  assert.deepEqual(ids(entry), [2, 8, 3])
  assert.equal(calls.length, 2)
})

test('추천에 없는 선택 영상은 상세 API로 읽어 첫 번째에 추가한다', async () => {
  const calls = []
  const controller = new AbortController()
  globalThis.fetch = async (url, options) => {
    calls.push(url)
    assert.equal(options.method, 'GET')
    assert.equal(options.signal, controller.signal)
    assert.equal(options.headers.get('X-Actor-Id'), '42')
    if (url === '/api/contents/99?view=learner&user_id=42')
      return Response.json({ content: content(99) })
    assert.ok(['/api/users/42/feed', '/api/users/42/feed-state'].includes(url))
    return Response.json(url.endsWith('feed-state') ? position : ranked)
  }
  const entry = await getFeedEntry(identity, 99, controller.signal)
  assert.deepEqual(ids(entry), [99, 8, 2, 3])
  assert.equal(entry.initialContentId, 99)
  assert.equal(calls.length, 3)
})

test('선택 영상이 삭제되거나 비공개가 되어 조회에 실패하면 다른 영상을 조용히 대신 재생하지 않는다', async () => {
  globalThis.fetch = async (url) => {
    if (url.startsWith('/api/contents/'))
      return Response.json(
        { detail: { code: 'CONTENT_NOT_FOUND', message: '영상을 찾을 수 없어요.' } },
        { status: 404 },
      )
    return Response.json(url.endsWith('feed-state') ? position : ranked)
  }
  await assert.rejects(getFeedEntry(identity, 99), { code: 'CONTENT_NOT_FOUND' })
})
