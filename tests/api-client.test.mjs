import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { api, ApiError, queryString } from '../src/api/client.ts'

const realFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = realFetch
})

test('JSON 기록 요청에 사용자와 0세대 헤더를 전달한다', async () => {
  globalThis.fetch = async (url, init) => {
    assert.equal(url, '/api/users/2/contents/3/like')
    assert.equal(init.method, 'PUT')
    assert.equal(init.headers.get('X-Actor-Id'), '2')
    assert.equal(init.headers.get('X-Record-Generation'), '0')
    assert.equal(init.headers.get('Content-Type'), 'application/json')
    assert.deepEqual(JSON.parse(init.body), { visit_id: 'visit' })
    return Response.json({ liked: true })
  }
  assert.deepEqual(
    await api('/users/2/contents/3/like', {
      method: 'PUT',
      actorId: 2,
      generation: 0,
      body: { visit_id: 'visit' },
    }),
    { liked: true },
  )
})

test('파일 업로드는 FormData와 브라우저의 multipart 경계를 유지한다', async () => {
  const form = new FormData()
  form.append('file', new File(['video'], 'sample.mp4', { type: 'video/mp4' }))
  globalThis.fetch = async (url, init) => {
    assert.equal(url, '/api/contents/3/video')
    assert.equal(init.body, form)
    assert.equal(init.headers.has('Content-Type'), false)
    assert.equal(init.headers.has('X-Record-Generation'), false)
    return Response.json({ content_id: 3 })
  }
  await api('/contents/3/video', { method: 'PUT', actorId: 1, body: form })
})

test('헤더가 필요 없는 사용자 조회와 /api 접두어를 보존한다', async () => {
  globalThis.fetch = async (url, init) => {
    assert.equal(url, '/api/users')
    assert.equal(init.method, 'GET')
    assert.equal(init.body, undefined)
    assert.equal(init.headers.has('X-Actor-Id'), false)
    return Response.json({ items: [] })
  }
  assert.deepEqual(await api('/api/users'), { items: [] })
})

test('서버 오류 코드와 입력 오류를 보존하고 자동 재전송하지 않는다', async () => {
  let calls = 0
  globalThis.fetch = async () => {
    calls++
    return Response.json(
      {
        detail: {
          code: 'VIDEO_CHANGED',
          message: '영상이 교체되었습니다.',
          fields: ['media_revision'],
        },
      },
      { status: 409 },
    )
  }
  await assert.rejects(api('/contents/3'), (error) => {
    assert.ok(error instanceof ApiError)
    assert.equal(error.status, 409)
    assert.equal(error.code, 'VIDEO_CHANGED')
    assert.deepEqual(error.fields, ['media_revision'])
    return true
  })
  assert.equal(calls, 1)
})

test('취소된 조회는 네트워크 오류로 바꾸지 않는다', async () => {
  const controller = new AbortController()
  controller.abort()
  globalThis.fetch = async (_, init) => {
    assert.equal(init.signal, controller.signal)
    throw new DOMException('aborted', 'AbortError')
  }
  await assert.rejects(api('/contents', { signal: controller.signal }), { name: 'AbortError' })
})

test('응답 없는 성공과 비정상 서버 응답을 구분한다', async () => {
  globalThis.fetch = async () => new Response(null, { status: 204 })
  assert.equal(await api('/resource', { method: 'DELETE' }), undefined)
  globalThis.fetch = async () => new Response('<html>proxy error</html>', { status: 502 })
  await assert.rejects(api('/resource'), { code: 'INVALID_RESPONSE', status: 502 })
})

test('조회 조건은 빈 값만 생략하고 0·false 및 한국어를 보존한다', () => {
  const params = new URLSearchParams(
    queryString({
      q: '업무 정리',
      page: 1,
      empty: '',
      missing: undefined,
      absent: null,
      value: 0,
      flag: false,
      tags: [1, 2],
    }),
  )
  assert.equal(params.get('q'), '업무 정리')
  assert.equal(params.get('value'), '0')
  assert.equal(params.get('flag'), 'false')
  assert.deepEqual(params.getAll('tags'), ['1', '2'])
  assert.equal(params.has('empty'), false)
  assert.equal(queryString({}), '')
})
