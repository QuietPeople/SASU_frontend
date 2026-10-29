import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { api } from '../src/api/client.ts'
import {
  resolveContentTags,
  contentMetadataBody,
  missingPublishFields,
} from '../src/admin/contentEditor.ts'

const realFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = realFetch
})
const form = {
  title: '수정한 제목',
  category: '1',
  core: '핵심',
  source: '출처',
  reviewed: '2026-10-29',
  caution: false,
  cautionText: '',
}

for (const method of ['POST', 'PATCH']) {
  test(`기존 1자·긴 태그의 콘텐츠 ${method}·공개 요청은 태그 POST 없이 ID로 연결한다`, async () => {
    const tags = [1, 31, 80].map((length) => ({ tag_id: length, name: '가'.repeat(length) }))
    const calls = []
    globalThis.fetch = async (url, options) => {
      calls.push({ url, method: options.method, body: JSON.parse(options.body ?? '{}') })
      assert.equal(options.headers.get('X-Actor-Id'), '7')
      assert.notEqual(url, '/api/tags')
      return Response.json({ detail: { content: { content_id: 19 } } })
    }
    const resolved = await resolveContentTags(tags, (name) =>
      api('/tags', { method: 'POST', actorId: 7, body: { name } }),
    )
    assert.deepEqual(missingPublishFields(form, resolved, true), [])
    await api(method === 'POST' ? '/contents' : '/contents/19', {
      method,
      actorId: 7,
      body: contentMetadataBody(form, resolved),
    })
    await api('/contents/19/publish', { method: 'POST', actorId: 7 })
    assert.equal(calls.length, 2)
    assert.deepEqual(calls[0].body.tag_ids, [1, 31, 80])
    assert.equal(calls[0].body.title, '수정한 제목')
    assert.equal(calls[1].url, '/api/contents/19/publish')
  })
}

test('기존·신규 혼합 저장은 신규 태그만 POST하고 반환 ID를 콘텐츠 본문에 포함한다', async () => {
  const calls = []
  globalThis.fetch = async (url, options) => {
    const body = JSON.parse(options.body)
    calls.push({ url, body })
    if (url === '/api/tags') return Response.json({ tag_id: 18, name: body.name })
    assert.equal(url, '/api/contents/19')
    return Response.json({})
  }
  const tags = await resolveContentTags(
    [{ tag_id: 1, name: '한' }, { tag_id: 80, name: '가'.repeat(80) }, { name: ' 새 태그 ' }],
    (name) => api('/tags', { method: 'POST', actorId: 7, body: { name } }),
  )
  await api('/contents/19', { method: 'PATCH', actorId: 7, body: contentMetadataBody(form, tags) })
  assert.equal(calls.length, 2)
  assert.deepEqual(calls[0], { url: '/api/tags', body: { name: '새 태그' } })
  assert.deepEqual(calls[1].body.tag_ids, [1, 80, 18])
})
