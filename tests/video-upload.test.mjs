import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { uploadVideo } from '../src/admin/uploadVideo.ts'
import { ApiError } from '../src/api/client.ts'

const originalXHR = globalThis.XMLHttpRequest
class FakeXHR {
  static instances = []
  upload = {}
  headers = {}
  status = 0
  responseText = ''
  constructor() {
    FakeXHR.instances.push(this)
  }
  open(method, url) {
    this.method = method
    this.url = url
  }
  setRequestHeader(name, value) {
    this.headers[name] = value
  }
  send(body) {
    this.body = body
  }
  progress(loaded, total, lengthComputable = true) {
    this.upload.onprogress({ loaded, total, lengthComputable })
  }
  respond(status, response) {
    this.status = status
    this.responseText = typeof response === 'string' ? response : JSON.stringify(response)
    this.onload()
  }
}
beforeEach(() => {
  FakeXHR.instances = []
  globalThis.XMLHttpRequest = FakeXHR
})
afterEach(() => {
  globalThis.XMLHttpRequest = originalXHR
})
const file = new File(['test video'], 'sample.mp4', { type: 'video/mp4' })
const result = {
  content_id: 3,
  media_revision: 'new',
  video_url: '/video',
  video_duration: 1,
  status: 'DRAFT',
}
function start(extra = {}) {
  const events = []
  const promise = uploadVideo({
    contentId: 3,
    actorId: 1,
    file,
    onProgress: (p) => events.push(p),
    ...extra,
  })
  return { promise, events, request: FakeXHR.instances.at(-1) }
}

test('영상 PUT 요청에 파일·사용자·기존 revision을 유지하고 multipart 헤더는 브라우저에 맡긴다', async () => {
  const { promise, request } = start({ expectedMediaRevision: 'old' })
  assert.equal(request.method, 'PUT')
  assert.equal(request.url, '/api/contents/3/video')
  assert.deepEqual(request.headers, { Accept: 'application/json', 'X-Actor-Id': '1' })
  assert.equal(request.body.get('file').name, 'sample.mp4')
  assert.equal(request.body.get('expected_media_revision'), 'old')
  request.respond(200, result)
  assert.deepEqual(await promise, result)
})

test('실제 전송 이벤트를 표시하고 전송 완료 후에도 서버 성공 응답 전까지 완료하지 않는다', async () => {
  const { promise, events, request } = start()
  let resolved = false
  promise.then(() => {
    resolved = true
  })
  assert.equal(events[0].percent, null)
  request.progress(45, 100)
  assert.deepEqual(events.at(-1), { phase: 'uploading', loaded: 45, total: 100, percent: 45 })
  request.progress(100, 100)
  assert.equal(events.at(-1).percent, 99)
  request.upload.onload()
  assert.deepEqual(events.at(-1), { phase: 'processing', loaded: 100, total: 100, percent: 100 })
  await Promise.resolve()
  assert.equal(resolved, false)
  request.respond(200, result)
  assert.deepEqual(await promise, result)
  assert.equal(resolved, true)
})

test('총량을 알 수 없으면 퍼센트를 만들지 않으며 범위 밖 이벤트와 늦은 이벤트를 처리한다', async () => {
  const { promise, events, request } = start()
  request.progress(30, 0, false)
  assert.deepEqual(events.at(-1), { phase: 'uploading', loaded: 30, total: null, percent: null })
  request.progress(150, 100)
  assert.equal(events.at(-1).loaded, 100)
  assert.equal(events.at(-1).percent, 99)
  request.upload.onload()
  request.progress(40, 100)
  assert.equal(events.at(-1).phase, 'processing')
  request.respond(200, result)
  await promise
  const count = events.length
  request.progress(60, 100)
  request.upload.onload()
  assert.equal(events.length, count)
})

test('100% 전송 후 서버 검증 실패도 성공으로 처리하지 않고 기존 오류 정보를 유지한다', async () => {
  const { promise, request } = start()
  request.upload.onload()
  request.respond(422, {
    detail: { code: 'INVALID_VIDEO', message: '영상 형식을 확인해 주세요.', fields: ['file'] },
  })
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof ApiError)
    assert.equal(error.status, 422)
    assert.equal(error.code, 'INVALID_VIDEO')
    assert.deepEqual(error.fields, ['file'])
    return true
  })
  assert.equal(FakeXHR.instances.length, 1)
})

test('네트워크 단절·시간 초과·취소를 구분하고 재시도 시 새 진행 상태로 시작한다', async () => {
  for (const [event, code] of [
    ['onerror', 'NETWORK_ERROR'],
    ['ontimeout', 'UPLOAD_TIMEOUT'],
    ['onabort', 'AbortError'],
  ]) {
    const { promise, request, events } = start()
    assert.equal(events[0].loaded, 0)
    request.progress(50, 100)
    request[event]()
    await assert.rejects(promise, event === 'onabort' ? { name: code } : { code })
  }
})

test('프록시 HTML 오류와 빈 성공 응답을 영상 저장 성공으로 오인하지 않는다', async () => {
  for (const [status, response] of [
    [502, '<html>Bad Gateway</html>'],
    [200, ''],
    [200, {}],
  ]) {
    const { promise, request } = start()
    request.respond(status, response)
    await assert.rejects(promise, { code: 'INVALID_RESPONSE', status })
  }
})
