import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { MutationObserver, onlineManager, QueryClient } from '@tanstack/react-query'
import {
  contentDeleteMutationOptions,
  deleteContent,
  contentDeletedMessage,
} from '../src/admin/contentDelete.ts'
import { invalidateContentDeletion } from '../src/api/queryInvalidation.ts'

const originalFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = originalFetch
})
const content = {
  updated_at: '2026-11-06T00:00:00.123456Z',
  detail: { content: { content_id: 7 } },
}

test('목록에서 삭제할 때 최신 편집 시각을 조회하여 관리자 ID·명시적 확인과 전달한다', async () => {
  const methods = []
  globalThis.fetch = async (url, options) => {
    methods.push(options.method)
    assert.equal(options.headers.get('X-Actor-Id'), '1')
    if (options.method === 'GET') {
      assert.equal(url, '/api/contents/7?view=editor')
      return Response.json(content)
    }
    assert.equal(url, '/api/contents/7')
    assert.equal(options.method, 'DELETE')
    assert.deepEqual(JSON.parse(options.body), {
      expected_updated_at: content.updated_at,
      confirm: true,
    })
    return Response.json({ content_id: 7, file_cleanup_pending: false })
  }
  assert.deepEqual(await deleteContent({ contentId: 7, actorId: 1 }), {
    content_id: 7,
    file_cleanup_pending: false,
  })
  assert.deepEqual(methods, ['GET', 'DELETE'])
})

test('삭제 실패는 서버 오류를 유지하고 성공으로 처리하거나 자동 재시도하지 않는다', async () => {
  let deletes = 0
  globalThis.fetch = async (_url, options) => {
    if (options.method === 'GET') return Response.json(content)
    deletes += 1
    return Response.json(
      { detail: { code: 'CONTENT_IN_USE', message: '잠시 후 다시 시도해 주세요.' } },
      { status: 409 },
    )
  }
  await assert.rejects(deleteContent({ contentId: 7, actorId: 1 }), { code: 'CONTENT_IN_USE' })
  assert.equal(deletes, 1)
})

test('최신 정보 조회에 실패하면 삭제 요청을 보내지 않는다', async () => {
  const methods = []
  globalThis.fetch = async (_url, options) => {
    methods.push(options.method)
    return Response.json(
      { detail: { code: 'CONTENT_NOT_FOUND', message: '존재하지 않는 콘텐츠입니다.' } },
      { status: 404 },
    )
  }
  await assert.rejects(deleteContent({ contentId: 7, actorId: 1 }), { code: 'CONTENT_NOT_FOUND' })
  assert.deepEqual(methods, ['GET'])
})

test('파일 정리 실패 응답은 삭제 성공과 남은 파일 안내를 구분한다', () => {
  assert.match(contentDeletedMessage(true), /일부 첨부 파일 정리/)
  assert.match(contentDeletedMessage(false), /영구 삭제했어요/)
})
test('삭제한 상세는 제거하고 피드·학습 현황·시리즈·응답·설정을 갱신한다', async () => {
  const cache = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } })
  try {
    const detail = ['admin', 1, 0, '/contents/7?view=editor']
    const keys = [
      ['admin', 1, 0, '/contents?status=ALL'],
      ['admin', 1, 0, '/categories/counts'],
      ['admin', 1, 0, '/curriculums/3?view=editor'],
      ['admin', 1, 0, '/responses'],
      ['learner', 'feed', 2, 2, 0, 'visit'],
      ['learner', 'dashboard', 2, 2, 0],
      ['learner', 'saved', 2, 2, 0],
      ['session', 'settings', 2],
    ]
    cache.setQueryData(detail, content)
    for (const key of keys) cache.setQueryData(key, {})
    const unrelated = ['admin', 1, 0, '/contents/8?view=editor']
    cache.setQueryData(unrelated, {})
    await invalidateContentDeletion(cache, { contentId: 7 })
    assert.equal(cache.getQueryData(detail), undefined)
    for (const key of keys)
      assert.equal(cache.getQueryState(key).isInvalidated, true, JSON.stringify(key))
    assert.equal(cache.getQueryState(unrelated).isInvalidated, false)
  } finally {
    cache.clear()
  }
})

test('오프라인 삭제는 즉시 실패하고 온라인 복구 후 자동 실행하지 않는다', async () => {
  const wasOnline = onlineManager.isOnline()
  const cache = new QueryClient()
  cache.mount()
  let calls = 0
  globalThis.fetch = async () => {
    calls += 1
    throw new TypeError('Failed to fetch')
  }
  const observer = new MutationObserver(cache, {
    ...contentDeleteMutationOptions,
    mutationFn: () => deleteContent({ contentId: 7, actorId: 1 }),
  })
  const unsubscribe = observer.subscribe(() => {})
  try {
    onlineManager.setOnline(false)
    await assert.rejects(observer.mutate(), { code: 'NETWORK_ERROR' })
    assert.equal(observer.getCurrentResult().isPending, false)
    assert.equal(observer.getCurrentResult().isPaused, false)
    assert.equal(calls, 1)
    onlineManager.setOnline(true)
    await new Promise((resolve) => setImmediate(resolve))
    assert.equal(calls, 1)
  } finally {
    unsubscribe()
    cache.unmount()
    cache.clear()
    onlineManager.setOnline(wasOnline)
  }
})
