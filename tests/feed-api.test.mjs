import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { beforeEach, afterEach, test } from 'node:test'

const feedUrl = new URL('../src/api/feed.ts', import.meta.url)
const learningUrl = new URL('../src/api/learning.ts', import.meta.url)
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if ([feedUrl.href, learningUrl.href].includes(context.parentURL) && specifier === './client')
      return nextResolve(new URL('../src/api/client.ts', import.meta.url).href, context)
    return nextResolve(specifier, context)
  },
})
let feed, learning
try {
  feed = await import(feedUrl.href)
  learning = await import(learningUrl.href)
} finally {
  hooks.deregister()
}

const realFetch = globalThis.fetch
const realWindow = globalThis.window
const identity = { actorId: 42, learnerId: 42, generation: 3 }
const position = { user_id: 42, last_content_id: 8, resume_available: true, record_generation: 3 }
const question = {
  question_id: 6,
  question_version_id: 7,
  content_id: 8,
  question_type: 'OX',
  question_text: '맞나요?',
  options: [
    { option_id: 9, option_order: 1, option_text: 'O' },
    { option_id: 10, option_order: 2, option_text: 'X' },
  ],
}

beforeEach(() => {
  globalThis.window = new EventTarget()
  globalThis.fetch = async () => assert.fail('예상하지 않은 API 요청')
})
afterEach(() => {
  globalThis.fetch = realFetch
  if (realWindow === undefined) delete globalThis.window
  else globalThis.window = realWindow
})

test('피드·위치 조회는 사용자와 취소 신호를 전달하고 서버 순서·이유를 보존한다', async () => {
  const controller = new AbortController()
  const ranked = {
    items: [
      {
        content: { content_id: 8 },
        recommendation_reason: 'LAST_CONTENT',
        recommendation_label: '이어 보기',
      },
      {
        content: { content_id: 2 },
        recommendation_reason: 'INTEREST_CATEGORY',
        recommendation_label: '관심 분야',
      },
    ],
    resume_unavailable: false,
    record_generation: 3,
  }
  const calls = []
  globalThis.fetch = async (url, options) => {
    calls.push(url)
    assert.equal(options.method, 'GET')
    assert.equal(options.headers.get('X-Actor-Id'), '42')
    assert.equal(options.headers.get('X-Record-Generation'), null)
    assert.equal(options.signal, controller.signal)
    assert.equal(options.body, undefined)
    assert.ok(['/api/users/42/feed', '/api/users/42/feed-state'].includes(url))
    return Response.json(url.endsWith('feed-state') ? position : ranked)
  }
  assert.deepEqual(await feed.getFeed(identity, controller.signal), { feed: ranked, position })
  assert.equal(calls.length, 2)
})

test('빈 추천과 마지막 영상 이용 불가를 임의 콘텐츠로 대체하지 않는다', async () => {
  const ranked = { items: [], resume_unavailable: true, record_generation: 3 }
  const unavailable = { ...position, resume_available: false }
  globalThis.fetch = async (url) => Response.json(url.endsWith('feed-state') ? unavailable : ranked)
  assert.deepEqual(await feed.getFeed(identity), { feed: ranked, position: unavailable })
})

test('피드 또는 재개 위치 응답의 세대가 바뀌면 설정 갱신을 알리고 현재 흐름을 거절한다', async () => {
  for (const mismatchPath of ['/api/users/42/feed', '/api/users/42/feed-state']) {
    let notifications = 0
    const listener = () => notifications++
    window.addEventListener('sasu:record-generation-mismatch', listener)
    globalThis.fetch = async (url) =>
      Response.json({
        ...(url.endsWith('feed-state') ? position : { items: [], resume_unavailable: false }),
        record_generation: url === mismatchPath ? 4 : 3,
      })
    await assert.rejects(feed.getFeed(identity), { code: 'RECORD_GENERATION_MISMATCH' })
    assert.equal(notifications, 1)
    window.removeEventListener('sasu:record-generation-mismatch', listener)
  }
})

test('마지막 위치 저장은 현재 세대 헤더와 콘텐츠 ID만 PATCH로 전달한다', async () => {
  let requests = 0
  globalThis.fetch = async (url, options) => {
    requests++
    assert.equal(url, '/api/users/42/feed-state')
    assert.equal(options.method, 'PATCH')
    assert.equal(options.headers.get('X-Actor-Id'), '42')
    assert.equal(options.headers.get('X-Record-Generation'), '3')
    assert.deepEqual(JSON.parse(options.body), { last_content_id: 8 })
    return Response.json(position)
  }
  assert.deepEqual(await feed.saveFeedPosition(identity, 8), position)
  assert.equal(requests, 1)
})

test('복기 후보 요청은 노출·재출제 집합을 POST하고 후보 없음은 null로 보존한다', async () => {
  const controller = new AbortController()
  globalThis.fetch = async (url, options) => {
    assert.equal(url, '/api/users/42/reviews/feed/candidate')
    assert.equal(options.method, 'POST')
    assert.equal(options.headers.get('X-Actor-Id'), '42')
    assert.equal(options.headers.get('X-Record-Generation'), null)
    assert.equal(options.signal, controller.signal)
    assert.deepEqual(JSON.parse(options.body), {
      shown_question_version_ids: [7, 11],
      retry_question_version_ids: [7],
    })
    return Response.json({ candidate: null, record_generation: 3 })
  }
  assert.deepEqual(await feed.getFeedCandidate(identity, [7, 11], [7], controller.signal), {
    candidate: null,
    record_generation: 3,
  })
})

test('복기 후보의 세대 변경을 거절하고 필터 상한을 넘으면 서버를 호출하지 않는다', async () => {
  let calls = 0
  globalThis.fetch = async () => {
    calls++
    return Response.json({ candidate: question, record_generation: 4 })
  }
  await assert.rejects(feed.getFeedCandidate(identity, [], []), {
    code: 'RECORD_GENERATION_MISMATCH',
  })
  assert.equal(calls, 1)
  await assert.rejects(
    feed.getFeedCandidate(
      identity,
      Array.from({ length: 1001 }, (_, i) => i + 1),
      [],
    ),
    { code: 'REVIEW_SESSION_LIMIT' },
  )
  assert.equal(calls, 1)
})

test('피드 복기 풀이·실제 노출·정답 제출은 같은 풀이 UUID와 FEED_REVIEW 경로를 사용한다', async () => {
  const attemptId = 'ddcae18c-41ca-4202-a3cc-72f2d6b16b23'
  const eventId = 'c927f95e-01c6-43bc-b96f-1b690019ce05'
  const calls = []
  globalThis.fetch = async (url, options) => {
    const body = JSON.parse(options.body)
    calls.push({ url, method: options.method, body })
    assert.equal(options.headers.get('X-Record-Generation'), '3')
    return Response.json(
      url.endsWith('/response')
        ? { response_id: 20, attempt_id: attemptId, result: 'WRONG' }
        : url.endsWith('/events')
          ? { accepted: true }
          : { attempt_id: attemptId, question, response_path: 'FEED_REVIEW', submitted: false },
    )
  }
  await learning.createLearningAttempt(identity, attemptId, question, 'FEED_REVIEW')
  await learning.recordLearningEvent(identity, eventId, {
    event_type: 'FEED_REVIEW_SHOWN',
    attempt_id: attemptId,
  })
  await learning.submitLearningAttempt(identity, attemptId, 10)
  assert.deepEqual(calls, [
    {
      url: '/api/users/42/question-attempts',
      method: 'POST',
      body: {
        attempt_id: attemptId,
        question_id: 6,
        expected_question_version_id: 7,
        response_path: 'FEED_REVIEW',
      },
    },
    {
      url: '/api/users/42/events',
      method: 'POST',
      body: { client_event_id: eventId, event_type: 'FEED_REVIEW_SHOWN', attempt_id: attemptId },
    },
    {
      url: `/api/users/42/question-attempts/${attemptId}/response`,
      method: 'PUT',
      body: { action: 'ANSWER', selected_option_id: 10 },
    },
  ])
})

test('피드 조회 실패는 빈 정상 피드로 바꾸지 않는다', async () => {
  globalThis.fetch = async () =>
    Response.json({ detail: { code: 'INTERNAL_ERROR', message: '조회 실패' } }, { status: 500 })
  await assert.rejects(feed.getFeed(identity), { code: 'INTERNAL_ERROR', status: 500 })
})
