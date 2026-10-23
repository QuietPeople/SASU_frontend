import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { afterEach, test } from 'node:test'

const learningUrl = new URL('../src/api/learning.ts', import.meta.url)
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL === learningUrl.href && specifier === './client') {
      return nextResolve(new URL('../src/api/client.ts', import.meta.url).href, context)
    }
    return nextResolve(specifier, context)
  },
})
let learning
try {
  learning = await import(learningUrl.href)
} finally {
  hooks.deregister()
}

const realFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = realFetch
})

const identity = { actorId: 97, learnerId: 42, generation: 0 }
const attemptId = 'a5b99b6e-54b2-433b-a35e-e0755dfeeb39'
const eventId = '40592785-3b68-44d8-bad1-ac6b53e06d70'
const question = {
  question_id: 17,
  question_version_id: 804,
  content_id: 63,
  question_type: 'MCQ_3',
  question_text: '업무를 시작할 때 먼저 확인할 것은?',
  options: [
    { option_id: 901, option_order: 1, option_text: '목표' },
    { option_id: 902, option_order: 2, option_text: '색상' },
    { option_id: 903, option_order: 3, option_text: '제목 길이' },
  ],
}

function assertIdentity(init, writing = true) {
  assert.equal(init.headers.get('X-Actor-Id'), '97')
  assert.equal(init.headers.get('X-Record-Generation'), writing ? '0' : null)
}

test('풀이 시작은 실제 학습자 경로에 UUID와 현재 문항 버전을 고정한다', async () => {
  const controller = new AbortController()
  const response = {
    attempt_id: attemptId,
    user_id: 42,
    question,
    response_path: 'WRONG_NOTE',
    submitted: false,
    response: null,
    record_generation: 0,
  }
  globalThis.fetch = async (url, init) => {
    assert.equal(url, '/api/users/42/question-attempts')
    assert.equal(init.method, 'POST')
    assertIdentity(init)
    assert.equal(init.signal, controller.signal)
    assert.deepEqual(JSON.parse(init.body), {
      attempt_id: attemptId,
      question_id: 17,
      expected_question_version_id: 804,
      response_path: 'WRONG_NOTE',
    })
    return Response.json(response)
  }
  assert.deepEqual(
    await learning.createLearningAttempt(
      identity,
      attemptId,
      question,
      'WRONG_NOTE',
      controller.signal,
    ),
    response,
  )
})

test('해결된 오답도 기존 attempt UUID의 GET으로 문항과 제출 결과를 복원한다', async () => {
  const controller = new AbortController()
  const submittedResponse = {
    response_id: 700,
    attempt_id: attemptId,
    question,
    response_path: 'WRONG_NOTE',
    result: 'CORRECT',
    selected_option_id: 901,
    correct_option_id: 901,
    correct_answer: '목표',
    explanation: '목표를 먼저 확인해요.',
    submitted_at: '2026-10-23T03:00:00Z',
    wrong_state: { question_version_id: 804, status: 'RESOLVED' },
  }
  const response = {
    attempt_id: attemptId,
    user_id: 42,
    question,
    response_path: 'WRONG_NOTE',
    submitted: true,
    response: submittedResponse,
    record_generation: 0,
  }
  const requests = []
  globalThis.fetch = async (url, init) => {
    requests.push(url)
    assert.equal(url, `/api/users/42/question-attempts/${attemptId}`)
    assert.equal(init.method, 'GET')
    assert.equal(init.body, undefined)
    assert.equal(init.signal, controller.signal)
    assertIdentity(init, false)
    return Response.json(response)
  }
  assert.deepEqual(
    await learning.recoverLearningAttempt(identity, attemptId, controller.signal),
    response,
  )
  assert.equal(
    requests.length,
    1,
    '복원 요청은 현재 미해결 목록을 요구하거나 새 풀이를 생성하지 않는다',
  )
})

test('존재하지 않는 풀이 복구 오류를 호출자에게 넘기고 자동 생성하지 않는다', async () => {
  let requests = 0
  globalThis.fetch = async (url, init) => {
    requests += 1
    assert.equal(url, `/api/users/42/question-attempts/${attemptId}`)
    assert.equal(init.method, 'GET')
    return Response.json(
      { detail: { code: 'ATTEMPT_NOT_FOUND', message: '현재 세대 풀이가 없습니다.' } },
      { status: 404 },
    )
  }
  await assert.rejects(learning.recoverLearningAttempt(identity, attemptId), {
    status: 404,
    code: 'ATTEMPT_NOT_FOUND',
  })
  assert.equal(requests, 1)
})

test('정답 제출에는 보기 순번 대신 실제 option_id를 전달한다', async () => {
  const response = { response_id: 700, result: 'WRONG', selected_option_id: 902 }
  globalThis.fetch = async (url, init) => {
    assert.equal(url, `/api/users/42/question-attempts/${attemptId}/response`)
    assert.equal(init.method, 'PUT')
    assertIdentity(init)
    assert.deepEqual(JSON.parse(init.body), { action: 'ANSWER', selected_option_id: 902 })
    return Response.json(response)
  }
  assert.deepEqual(await learning.submitLearningAttempt(identity, attemptId, 902), response)
})

test('건너뛰기는 selected_option_id 없이 SKIP만 제출한다', async () => {
  globalThis.fetch = async (url, init) => {
    assert.equal(url, `/api/users/42/question-attempts/${attemptId}/response`)
    assert.equal(init.method, 'PUT')
    assertIdentity(init)
    assert.deepEqual(JSON.parse(init.body), { action: 'SKIP' })
    return Response.json({ result: 'SKIP', selected_option_id: null })
  }
  const result = await learning.submitLearningAttempt(identity, attemptId, null)
  assert.equal(result.result, 'SKIP')
})

test('이벤트 실패 후 명시적 재전송에도 동일 client_event_id를 보존한다', async () => {
  const requests = []
  globalThis.fetch = async (url, init) => {
    assert.equal(url, '/api/users/42/events')
    assert.equal(init.method, 'POST')
    assertIdentity(init)
    requests.push(JSON.parse(init.body))
    if (requests.length === 1) throw new TypeError('connection lost')
    return Response.json({ accepted: true })
  }
  const event = { event_type: 'VIDEO_QUIZ_SHOWN', attempt_id: attemptId }
  await assert.rejects(learning.recordLearningEvent(identity, eventId, event), {
    code: 'NETWORK_ERROR',
  })
  assert.equal(requests.length, 1, '오류 직후 자동으로 중복 이벤트를 보내지 않는다')
  await learning.recordLearningEvent(identity, eventId, event)
  assert.deepEqual(requests, [
    { client_event_id: eventId, event_type: 'VIDEO_QUIZ_SHOWN', attempt_id: attemptId },
    { client_event_id: eventId, event_type: 'VIDEO_QUIZ_SHOWN', attempt_id: attemptId },
  ])
})

test('카드 열람 이벤트는 콘텐츠와 문항 버전 ID를 별도로 보존한다', async () => {
  globalThis.fetch = async (url, init) => {
    assert.equal(url, '/api/users/42/events')
    assertIdentity(init)
    assert.deepEqual(JSON.parse(init.body), {
      client_event_id: eventId,
      event_type: 'FLASHCARD_FLIPPED',
      content_id: 63,
      question_version_id: 804,
    })
    return Response.json({ accepted: true })
  }
  await learning.recordLearningEvent(identity, eventId, {
    event_type: 'FLASHCARD_FLIPPED',
    content_id: 63,
    question_version_id: 804,
  })
})

test('시청 보고는 방문 UUID·영상 revision·시청 구간·진입 경로와 keepalive를 보존한다', async () => {
  const report = {
    visit_id: '07e92b32-c87f-4cbc-bff2-2ea6d056a8d4',
    media_revision: 'd92c579b-aeaa-42cf-8afb-fd50a0ec2be4',
    actual_played_seconds: 4.25,
    watched_segments: [
      [0, 2.25],
      [20, 22],
    ],
    context: 'CURRICULUM',
  }
  const result = {
    view_counted: true,
    watch_completed: false,
    visit_watch_percent: 14.17,
    feed_completion_eligible: false,
    view_count: 12,
    record_generation: 0,
  }
  const keepaliveFlags = []
  globalThis.fetch = async (url, init) => {
    assert.equal(url, '/api/users/42/contents/63/watch-reports')
    assert.equal(init.method, 'POST')
    assertIdentity(init)
    assert.deepEqual(JSON.parse(init.body), report)
    keepaliveFlags.push(init.keepalive)
    return Response.json(result)
  }
  assert.deepEqual(await learning.sendWatchReport(identity, 63, report), result)
  assert.deepEqual(await learning.sendWatchReport(identity, 63, report, true), result)
  assert.deepEqual(keepaliveFlags, [false, true])
})

test('카드 정답은 콘텐츠 ID가 아닌 문항 버전 ID 경로로 조회한다', async () => {
  const controller = new AbortController()
  const response = {
    card: {
      question_id: 17,
      question_version_id: 804,
      content_id: 63,
      content_title: '업무 시작',
      category: { category_id: 9, name: '업무' },
      front: question.question_text,
    },
    back: '목표',
    explanation: '목표를 먼저 확인해요.',
  }
  globalThis.fetch = async (url, init) => {
    assert.equal(url, '/api/users/42/reviews/flashcards/804')
    assert.equal(init.method, 'GET')
    assert.equal(init.body, undefined)
    assert.equal(init.signal, controller.signal)
    assertIdentity(init, false)
    return Response.json(response)
  }
  assert.deepEqual(await learning.getFlashcardAnswer(identity, 804, controller.signal), response)
})

test('카드 목록은 실제 학습자와 요청 페이지로 조회한다', async () => {
  const page = { items: [], page: 3, size: 20, total: 43, has_next: false }
  globalThis.fetch = async (url, init) => {
    const parsed = new URL(url, 'http://test.invalid')
    assert.equal(parsed.pathname, '/api/users/42/reviews/flashcards')
    assert.deepEqual(
      [...parsed.searchParams],
      [
        ['page', '3'],
        ['size', '20'],
      ],
    )
    assertIdentity(init, false)
    return Response.json(page)
  }
  assert.deepEqual(await learning.getFlashcards(identity, 3), page)
})

test('학습 조회 키는 사용자와 기록 세대를 분리한다', () => {
  assert.deepEqual(learning.learningKey(identity, 'content', 63), [
    'learner',
    'content',
    97,
    42,
    0,
    63,
  ])
  assert.notDeepEqual(
    learning.learningKey(identity, 'content', 63),
    learning.learningKey({ ...identity, generation: 1 }, 'content', 63),
  )
  assert.notDeepEqual(
    learning.learningKey(identity, 'content', 63),
    learning.learningKey({ ...identity, learnerId: 43 }, 'content', 63),
  )
})
