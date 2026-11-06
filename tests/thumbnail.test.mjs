import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ApiError } from '../src/api/client.ts'
import {
  saveThumbnail,
  deleteThumbnail,
  thumbnailFileError,
  MAX_THUMBNAIL_BYTES,
} from '../src/admin/thumbnail.ts'

test('썸네일은 JPEG/PNG/WebP 및 10MB 경계를 검사하고 MIME 미제공 파일은 확장자로 사전 확인한다', () => {
  for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
    assert.equal(thumbnailFileError({ name: 'photo', type, size: MAX_THUMBNAIL_BYTES }), null)
  }
  assert.equal(thumbnailFileError({ name: 'photo.JPG', type: '', size: 12 }), null)
  assert.ok(thumbnailFileError({ name: 'photo.jpg', type: 'image/gif', size: 12 }))
  assert.ok(thumbnailFileError({ name: 'photo.svg', type: '', size: 12 }))
  assert.ok(thumbnailFileError({ name: 'photo.png', type: 'image/png', size: 0 }))
  assert.ok(
    thumbnailFileError({ name: 'photo.png', type: 'image/png', size: MAX_THUMBNAIL_BYTES + 1 }),
  )
})

test('콘텐츠·시리즈 이미지는 file multipart와 관리자 헤더로 PUT하며 빈 204 응답을 허용한다', async (t) => {
  const requests = []
  t.mock.method(globalThis, 'fetch', async (path, options) => {
    requests.push({ path, options })
    return new Response(null, { status: 204 })
  })
  const file = new File(['image-bytes'], 'photo.webp', { type: 'image/webp' })
  for (const resource of ['contents', 'curriculums']) {
    assert.equal(await saveThumbnail(resource, 7, 1, file), undefined)
  }
  assert.deepEqual(
    requests.map(({ path }) => path),
    ['/api/contents/7/thumbnail', '/api/curriculums/7/thumbnail'],
  )
  for (const { options } of requests) {
    assert.equal(options.method, 'PUT')
    assert.equal(options.headers.get('X-Actor-Id'), '1')
    assert.equal(options.headers.has('Content-Type'), false)
    assert.equal(options.body.get('file').name, 'photo.webp')
    assert.equal(await options.body.get('file').text(), 'image-bytes')
  }
})

test('잘못된 선택은 요청하지 않고 서버의 실제 이미지 검증 실패는 호출부에 전달한다', async (t) => {
  const fetch = t.mock.method(
    globalThis,
    'fetch',
    async () =>
      new Response(JSON.stringify({ detail: { code: 'INVALID_IMAGE', message: '이미지 손상' } }), {
        status: 422,
      }),
  )
  await assert.rejects(
    saveThumbnail('contents', 7, 1, new File(['x'], 'photo.gif', { type: 'image/gif' })),
  )
  assert.equal(fetch.mock.callCount(), 0)
  await assert.rejects(
    saveThumbnail('contents', 7, 1, new File(['x'], 'photo.png', { type: 'image/png' })),
    (error) => error instanceof ApiError && error.code === 'INVALID_IMAGE',
  )
})

test('시리즈의 직접 이미지가 없으면 삭제 완료 상태로 취급하며 첫 콘텐츠를 삭제하지 않는다', async (t) => {
  const requests = []
  t.mock.method(globalThis, 'fetch', async (path, options) => {
    requests.push({ path, options })
    return new Response(
      JSON.stringify({ detail: { code: 'THUMBNAIL_NOT_FOUND', message: '직접 이미지 없음' } }),
      { status: 404 },
    )
  })
  assert.equal(await deleteThumbnail('curriculums', 3, 1), false)
  assert.equal(requests.length, 1)
  assert.equal(requests[0].path, '/api/curriculums/3/thumbnail')
  assert.equal(requests[0].options.method, 'DELETE')
  assert.equal(requests[0].options.headers.get('X-Actor-Id'), '1')
})

test('삭제 성공과 리소스 없음·권한 오류는 구분한다', async (t) => {
  const results = [
    new Response(null, { status: 204 }),
    new Response(
      JSON.stringify({ detail: { code: 'CURRICULUM_NOT_FOUND', message: '시리즈 없음' } }),
      { status: 404 },
    ),
    new Response(JSON.stringify({ detail: { code: 'FORBIDDEN', message: '권한 없음' } }), {
      status: 403,
    }),
  ]
  t.mock.method(globalThis, 'fetch', async () => results.shift())
  assert.equal(await deleteThumbnail('contents', 7, 1), true)
  await assert.rejects(deleteThumbnail('curriculums', 3, 1), { code: 'CURRICULUM_NOT_FOUND' })
  await assert.rejects(deleteThumbnail('contents', 7, 2), { code: 'FORBIDDEN' })
})
