import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { MutationObserver, onlineManager, QueryClient } from '@tanstack/react-query'
import {
  contentLifecycleMutationOptions,
  requestContentLifecycle,
} from '../src/admin/contentLifecycle.ts'
import { contentStatusLabel, contentStatusTone } from '../src/admin/contentStatus.ts'
import { adminStatus } from '../src/admin/navigation.ts'
import { invalidateContentLifecycle } from '../src/api/queryInvalidation.ts'

const originalFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = originalFetch
})
const content = {
  updated_at: '2026-11-06T00:00:00.123456Z',
  detail: { content: { content_id: 7 } },
}
for (const [action, method, suffix] of [
  ['private', 'POST', '/unpublish'],
  ['publish', 'POST', '/publish'],
  ['delete', 'DELETE', ''],
]) {
  test(`${action}: 관리자 ID·편집 시각·삭제 확인을 서버에 전달한다`, async () => {
    globalThis.fetch = async (url, options) => {
      assert.equal(url, '/api/contents/7' + suffix)
      assert.equal(options.method, method)
      assert.equal(options.headers.get('X-Actor-Id'), '1')
      assert.deepEqual(JSON.parse(options.body), {
        expected_updated_at: content.updated_at,
        ...(action === 'delete' ? { confirm: true } : {}),
      })
      return Response.json(
        action === 'delete' ? { content_id: 7, file_cleanup_pending: false } : content,
      )
    }
    const result = await requestContentLifecycle({ action, content, actorId: 1 })
    assert.equal(result.action, action)
  })
}
test('비공개는 임시저장과 구분하며 필터에서 유지한다', () => {
  assert.equal(contentStatusLabel('PRIVATE'), '비공개')
  assert.equal(contentStatusLabel('DRAFT'), '임시저장')
  assert.equal(contentStatusTone('PRIVATE'), 'amber')
  assert.equal(adminStatus('PRIVATE'), 'PRIVATE')
})
test('편집 충돌은 성공으로 처리하지 않고 서버 오류를 유지한다', async () => {
  globalThis.fetch = async () =>
    Response.json({ detail: { code: 'EDIT_CONFLICT', message: '다시 확인' } }, { status: 409 })
  await assert.rejects(requestContentLifecycle({ action: 'delete', content, actorId: 1 }), {
    code: 'EDIT_CONFLICT',
  })
})
test('삭제한 상세는 제거하고 피드·학습 현황·시리즈·응답·설정을 갱신한다', async () => {
  const cache = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } })
  try {
    const detail = ['admin', 1, 0, '/contents/7?view=editor']
    const keys = [
      ['admin', 1, 0, '/contents?status=PRIVATE'],
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
    await invalidateContentLifecycle(cache, { contentId: 7, deleted: true })
    assert.equal(cache.getQueryData(detail), undefined)
    for (const key of keys)
      assert.equal(cache.getQueryState(key).isInvalidated, true, JSON.stringify(key))
    assert.equal(cache.getQueryState(unrelated).isInvalidated, false)
  } finally {
    cache.clear()
  }
})

for (const action of ['private', 'publish', 'delete']) {
  test(`${action}: 오프라인에서 즉시 실패하고 온라인 복구 후 자동 실행하지 않는다`, async () => {
    const wasOnline = onlineManager.isOnline()
    const cache = new QueryClient()
    cache.mount()
    let calls = 0
    globalThis.fetch = async () => {
      calls += 1
      throw new TypeError('Failed to fetch')
    }
    const observer = new MutationObserver(cache, {
      ...contentLifecycleMutationOptions,
      mutationFn: () => requestContentLifecycle({ action, content, actorId: 1 }),
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
}
