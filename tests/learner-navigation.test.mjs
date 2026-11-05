import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { afterEach, test } from 'node:test'
import { QueryClient } from '@tanstack/react-query'

const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier))
      return next(new URL(`${specifier}.ts`, context.parentURL).href, context)
    return next(specifier, context)
  },
})
const state = await import('../src/features/learner-navigation/state.ts')
const lists = await import('../src/features/learner-navigation/lists.ts')
hooks.deregister()
const originalFetch = globalThis.fetch
const originalStorage = globalThis.sessionStorage
const clients = []
const identity = { actorId: 42, learnerId: 42, generation: 3 }
const client = () => {
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  clients.push(cache)
  return cache
}
const card = (id) => ({
  question_id: id,
  question_version_id: id,
  content_id: id,
  content_title: `영상 ${id}`,
  category: { category_id: 8, name: '분야' },
  front: `질문 ${id}`,
})
const page = (number, items, has_next = false) => ({
  items,
  page: number,
  size: 20,
  total: 40,
  has_next,
})
afterEach(() => {
  globalThis.fetch = originalFetch
  if (originalStorage === undefined) delete globalThis.sessionStorage
  else globalThis.sessionStorage = originalStorage
  for (const cache of clients.splice(0)) cache.clear()
})

test('보관함은 탭마다 페이지를 분리하고 돌아올 때 해당 페이지를 복원한다', () => {
  let query = new URLSearchParams('tab=saved&page=3&concept=8')
  query = state.libraryParams(query, 'tab', 'wrong')
  assert.equal(query.get('page'), '1')
  assert.equal(query.get('saved_page'), '3')
  query = state.libraryParams(query, 'page', '2')
  query = state.libraryParams(query, 'tab', 'saved')
  assert.equal(query.get('page'), '3')
  assert.equal(query.get('wrong_page'), '2')
  assert.equal(query.get('concept'), '8')
})

test('분야를 바꾸거나 초기화하면 모든 탭의 이전 페이지를 제거한다', () => {
  for (const category of ['9', '']) {
    const query = state.libraryParams(
      new URLSearchParams('tab=cards&page=4&saved_page=2&wrong_page=3&cards_page=4&concept=8'),
      'concept',
      category,
    )
    for (const key of ['page', 'saved_page', 'wrong_page', 'cards_page'])
      assert.equal(query.has(key), false)
    assert.equal(query.get('concept'), category || null)
  }
})

test('복습은 현재 문항 분야로 바꾸지 않고 선택했던 목록 범위를 사용한다', () => {
  assert.equal(
    state.reviewCategory(new URLSearchParams(), '/learner/library?tab=wrong&concept=8'),
    8,
  )
  assert.equal(state.reviewCategory(new URLSearchParams(), '/learner/library?tab=wrong'), undefined)
  assert.equal(
    state.reviewCategory(new URLSearchParams('category=9'), '/learner/library?concept=8'),
    9,
  )
})

test('복귀 주소는 실제 보관함 경로만 허용하고 비슷한 외부 경로를 배제한다', () => {
  assert.equal(
    state.safeLibraryReturn('/learner/library?tab=cards&page=2', 'cards'),
    '/learner/library?tab=cards&page=2',
  )
  for (const value of ['https://example.com', '//example.com', '/learner/library-other'])
    assert.equal(state.safeLibraryReturn(value, 'wrong'), '/learner/library?tab=wrong')
})

test('저장소 제한과 잘못된 JSON이 화면 조작을 중단하지 않는다', () => {
  globalThis.sessionStorage = {
    getItem: () => '{broken',
    setItem() {
      throw Error('quota')
    },
    removeItem() {
      throw Error('blocked')
    },
  }
  assert.equal(state.readView('scope'), undefined)
  assert.doesNotThrow(() => state.writeView('scope', { scroll: 400 }))
  assert.doesNotThrow(() => state.clearView('scope'))
})

test('임시 입력과 펼침 상태는 학습자와 기록 세대별 키로 분리된다', () => {
  const entries = new Map()
  globalThis.sessionStorage = {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
    removeItem: (key) => entries.delete(key),
  }
  state.writeView('42:42:3:settings-draft', { interval: '7' })
  assert.deepEqual(state.readView('42:42:3:settings-draft'), { interval: '7' })
  assert.equal(state.readView('42:42:4:settings-draft'), undefined)
  assert.equal(state.readView('43:43:3:settings-draft'), undefined)
})

test('내부 기록 세대 용어 대신 학습자가 취할 행동을 안내한다', () => {
  const error = Object.assign(new Error('기록 세대가 다릅니다'), {
    code: 'RECORD_GENERATION_MISMATCH',
  })
  assert.match(state.learnerErrorMessage(error), /목록을 다시/)
  assert.doesNotMatch(state.learnerErrorMessage(error), /기록 세대/)
})

test('서버 장애와 잘못된 응답의 내부 메시지는 기본 안내에 노출하지 않는다', () => {
  for (const properties of [
    { code: 'INTERNAL_ERROR', status: 500 },
    { code: 'HTTP_503', status: 503 },
    { code: 'INVALID_RESPONSE', status: 200 },
  ]) {
    const error = Object.assign(new Error('Database connection pool exhausted'), properties)
    assert.match(state.learnerErrorMessage(error), /잠시 후 다시 시도/)
    assert.doesNotMatch(state.learnerErrorMessage(error), /Database/)
  }
})

test('연결 실패 안내와 서버의 일반 입력 안내를 구분한다', () => {
  const network = Object.assign(new Error('Failed to fetch'), { code: 'NETWORK_ERROR' })
  assert.match(state.learnerErrorMessage(network), /서버에 연결하지/)
  const validation = Object.assign(new Error('지정한 카테고리가 없습니다.'), {
    code: 'CATEGORY_NOT_FOUND',
    status: 404,
  })
  assert.equal(state.learnerErrorMessage(validation), validation.message)
})

test('보관함에서 받은 뒤쪽 카드 페이지는 첫 페이지를 재조회하지 않는다', async () => {
  const cache = client()
  cache.setQueryData(lists.cardPageKey(identity, undefined, 2), page(2, [card(21), card(22)]))
  globalThis.fetch = async () => assert.fail('캐시된 페이지를 다시 요청함')
  assert.equal((await lists.locateCard(cache, identity, undefined, 2, 21)).page, 2)
  assert.equal((await lists.locateCard(cache, identity, undefined, 2, 22)).page, 2)
})

test('깊은 카드 주소를 찾은 뒤 다음 카드에서는 탐색한 페이지를 재사용한다', async () => {
  const cache = client()
  const requests = []
  globalThis.fetch = async (url, options) => {
    requests.push(url)
    const query = new URL(url, 'http://local').searchParams
    assert.equal(query.get('category_id'), '8')
    assert.equal(options.headers.get('X-Actor-Id'), '42')
    const number = Number(query.get('page'))
    return Response.json(
      page(number, number === 1 ? [card(1)] : [card(21), card(22)], number === 1),
    )
  }
  assert.equal((await lists.locateCard(cache, identity, 8, 1, 21)).page, 2)
  assert.equal((await lists.locateCard(cache, identity, 8, 1, 22)).page, 2)
  assert.equal(requests.length, 2)
})

test('카드 선택 요청의 취소가 공유 페이지 캐시의 조회를 중단하지 않는다', async () => {
  const cache = client()
  const controller = new AbortController()
  let release
  let entered
  const started = new Promise((resolve) => {
    entered = resolve
  })
  let calls = 0
  globalThis.fetch = async (_, options) => {
    calls += 1
    assert.notEqual(options.signal, controller.signal)
    entered()
    return new Promise((resolve) => {
      release = () => resolve(Response.json(page(1, [card(1)])))
    })
  }
  const request = lists.locateCard(cache, identity, undefined, 1, 1, controller.signal)
  await started
  controller.abort()
  release()
  await assert.rejects(request, { name: 'AbortError' })
  assert.equal(
    (await lists.locateCard(cache, identity, undefined, 1, 1)).items[0].question_version_id,
    1,
  )
  assert.equal(calls, 1)
})

test('카드 페이지 캐시는 이전 기록 세대의 데이터를 재사용하지 않는다', async () => {
  const cache = client()
  cache.setQueryData(lists.cardPageKey(identity, undefined, 1), page(1, [card(1)]))
  let calls = 0
  globalThis.fetch = async () => {
    calls += 1
    return Response.json(page(1, [card(2)]))
  }
  const result = await lists.locateCard(cache, { ...identity, generation: 4 }, undefined, 1, 2)
  assert.equal(result.items[0].question_version_id, 2)
  assert.equal(calls, 1)
})

test('복습 대상과 다음 문제는 같은 분야의 전체 페이지에서 조회한다', async () => {
  const requests = []
  globalThis.fetch = async (url, options) => {
    requests.push(url)
    const query = new URL(url, 'http://local').searchParams
    assert.equal(query.get('category_id'), '8')
    assert.equal(query.get('status'), 'PENDING')
    assert.equal(options.method, 'GET')
    const number = Number(query.get('page'))
    return Response.json(
      page(
        number,
        [{ question: { question_version_id: number }, content: { content_id: number } }],
        number === 1,
      ),
    )
  }
  const result = await lists.reviewTargets(identity, 1, 1, 8)
  assert.equal(result.target.content.content_id, 1)
  assert.equal(result.next.content.content_id, 2)
  assert.equal(requests.length, 2)
})

test('해결된 문항이 목록에서 빠진 뒤에는 첫 미해결 문항으로 이어간다', async () => {
  let calls = 0
  globalThis.fetch = async (url) => {
    calls += 1
    assert.equal(new URL(url, 'http://local').searchParams.has('category_id'), false)
    return Response.json(
      page(1, [{ question: { question_version_id: 2 }, content: { content_id: 2 } }]),
    )
  }
  const result = await lists.reviewTargets(identity, 1, 1, undefined)
  assert.equal(result.target, undefined)
  assert.equal(result.next.content.content_id, 2)
  assert.equal(calls, 1)
})

const wrongItem = (id, version = id) => ({
  question: { question_version_id: version },
  content: { content_id: id },
})

test('건너뛰기로 미해결 문항이 유지되어도 모든 문항을 순서대로 방문한다', async () => {
  globalThis.fetch = async () =>
    Response.json(
      page(
        1,
        [1, 2, 3].map((id) => wrongItem(id)),
      ),
    )
  const visited = [1]
  for (let step = 0; step < 4; step += 1) {
    const current = visited.at(-1)
    const result = await lists.reviewTargets(identity, current, current, 8)
    assert.equal(result.target.content.content_id, current)
    visited.push(result.next.content.content_id)
  }
  assert.deepEqual(visited, [1, 2, 3, 1, 2])
})

test('앞 페이지에 다른 문항이 있어도 현재 문항 뒤의 다음 페이지로 진행한다', async () => {
  const requested = []
  globalThis.fetch = async (url) => {
    const query = new URL(url, 'http://local').searchParams
    const number = Number(query.get('page'))
    requested.push(number)
    assert.equal(query.get('category_id'), '8')
    return Response.json(page(number, [wrongItem(number)], number < 3))
  }
  const result = await lists.reviewTargets(identity, 2, 2, 8)
  assert.equal(result.target.content.content_id, 2)
  assert.equal(result.next.content.content_id, 3)
  assert.deepEqual(requested, [1, 2, 3])
})

test('마지막 문항 다음에는 앞 페이지의 미해결 문항으로 돌아간다', async () => {
  globalThis.fetch = async (url) => {
    const number = Number(new URL(url, 'http://local').searchParams.get('page'))
    return Response.json(page(number, [wrongItem(number)], number < 3))
  }
  const result = await lists.reviewTargets(identity, 3, 3, 8)
  assert.equal(result.target.content.content_id, 3)
  assert.equal(result.next.content.content_id, 1)
})

test('현재 문항만 남거나 목록이 비어 있으면 다음 복습을 제시하지 않는다', async () => {
  for (const items of [[wrongItem(1)], []]) {
    globalThis.fetch = async () => Response.json(page(1, items))
    const result = await lists.reviewTargets(identity, 1, 1, undefined)
    assert.equal(result.next, undefined)
  }
})

test('다른 버전의 같은 콘텐츠를 다음 복습으로 선택하지 않는다', async () => {
  globalThis.fetch = async () => Response.json(page(1, [wrongItem(1, 2), wrongItem(3)]))
  const result = await lists.reviewTargets(identity, 1, 1, undefined)
  assert.equal(result.target, undefined)
  assert.equal(result.next.content.content_id, 3)
})
