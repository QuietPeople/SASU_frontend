import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ApiError } from '../src/api/client.ts'
import {
  uploadNeedsReview,
  compareUploadedVideo,
  readUploadRecovery,
  rememberUpload,
  uploadRecoveryKey,
} from '../src/admin/uploadRecovery.ts'

test('중단·통신 단절·응답 손실·교체 충돌은 실패 확정 대신 저장 결과를 확인한다', () => {
  for (const error of [
    new DOMException('', 'AbortError'),
    new ApiError(0, 'NETWORK_ERROR', ''),
    new ApiError(0, 'UPLOAD_TIMEOUT', ''),
    new ApiError(200, 'INVALID_RESPONSE', ''),
    new ApiError(500, 'INTERNAL_ERROR', ''),
    new ApiError(409, 'VIDEO_CHANGED', ''),
    new ApiError(409, 'VIDEO_ALREADY_EXISTS', ''),
  ])
    assert.equal(uploadNeedsReview(error), true)
  assert.equal(uploadNeedsReview(new ApiError(422, 'INVALID_VIDEO', '')), false)
  assert.equal(uploadNeedsReview(new ApiError(413, 'FILE_TOO_LARGE', '')), false)
})

test('최신 revision은 변화만 판정하며 중단 요청의 성공 여부로 단정하지 않는다', () => {
  const recovery = { contentId: 3, previousRevision: 'old', reason: 'interrupted' }
  const detail = (id, revision) => ({
    detail: { content: { content_id: id, media_revision: revision } },
  })
  assert.equal(compareUploadedVideo(recovery, detail(3, 'old')), 'unchanged')
  assert.equal(compareUploadedVideo(recovery, detail(3, 'other-upload')), 'changed')
  assert.equal(
    compareUploadedVideo({ ...recovery, previousRevision: null }, detail(3, null)),
    'unchanged',
  )
  assert.throws(() => compareUploadedVideo(recovery, detail(4, 'new')))
})

test('재접속 확인 정보는 사용자·세대·콘텐츠별로 격리하고 확인 뒤 지운다', () => {
  const original = globalThis.sessionStorage
  const items = new Map()
  globalThis.sessionStorage = {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => items.set(key, value),
    removeItem: (key) => items.delete(key),
  }
  try {
    const key = uploadRecoveryKey(1, 0, 3)
    const value = { contentId: 3, previousRevision: 'old', reason: 'unknown' }
    rememberUpload(key, value)
    assert.deepEqual(readUploadRecovery(key), value)
    assert.equal(readUploadRecovery(uploadRecoveryKey(2, 0, 3)), null)
    assert.equal(readUploadRecovery(uploadRecoveryKey(1, 1, 3)), null)
    assert.equal(readUploadRecovery(uploadRecoveryKey(1, 0, 4)), null)
    rememberUpload(key, null)
    assert.equal(readUploadRecovery(key), null)
  } finally {
    globalThis.sessionStorage = original
  }
})
