import assert from 'node:assert/strict'
import { test } from 'node:test'
import { videoPreloadWindow } from '../src/features/content-viewer/preloadPolicy.ts'
import {
  retainVideoBuffer,
  bindActiveVideoEvents,
} from '../src/features/content-viewer/videoBuffer.ts'

const sorted = (indices) => [...indices].sort((a, b) => a - b)

test('현재 영상과 이전 1개·다음 2개만 유지하며 이동 시 먼 영상을 제외한다', () => {
  const items = [true, true, true, true, true, true, true]
  assert.deepEqual(sorted(videoPreloadWindow(items, 2)), [1, 2, 3, 4])
  assert.deepEqual(sorted(videoPreloadWindow(items, 3)), [2, 3, 4, 5])
  assert.deepEqual(sorted(videoPreloadWindow(items, 0)), [0, 1, 2])
  assert.deepEqual(sorted(videoPreloadWindow(items, 6)), [5, 6])
})

test('복기카드를 영상 개수에서 제외하고 카드·종료 위치에서도 주변 영상만 준비한다', () => {
  const items = [true, true, false, true, true, true, false]
  assert.deepEqual(sorted(videoPreloadWindow(items, 1)), [0, 1, 3, 4])
  assert.deepEqual(sorted(videoPreloadWindow(items, 2)), [1, 3, 4])
  assert.deepEqual(sorted(videoPreloadWindow(items, 6)), [5])
  assert.deepEqual(sorted(videoPreloadWindow([false], 0)), [])
})

function media(source = '/video?revision=1') {
  const video = new EventTarget()
  Object.assign(video, {
    src: source,
    currentTime: 0,
    paused: true,
    error: null,
    loadCalls: 0,
    pauseCalls: 0,
    getAttribute(name) {
      return name === 'src' ? this.src : null
    },
    removeAttribute(name) {
      if (name === 'src') this.src = ''
    },
    load() {
      this.loadCalls++
      this.currentTime = 0
    },
    pause() {
      this.pauseCalls++
      this.paused = true
    },
  })
  return video
}

test('미리 준비한 요소를 활성화·비활성화해도 소스를 다시 로드하지 않는다', () => {
  const video = media()
  const release = retainVideoBuffer(video, video.src)
  const events = []
  video.dispatchEvent(new Event('loadedmetadata'))
  video.dispatchEvent(new Event('timeupdate'))
  assert.deepEqual(events, [])
  const detach = bindActiveVideoEvents(video, (type) => events.push(type))
  video.dispatchEvent(new Event('playing'))
  video.dispatchEvent(new Event('timeupdate'))
  assert.deepEqual(events, ['playing', 'timeupdate'])
  detach()
  video.dispatchEvent(new Event('pause'))
  video.dispatchEvent(new Event('ended'))
  assert.equal(events.length, 2)
  assert.equal(video.loadCalls, 0)
  release()
  assert.equal(video.src, '')
  assert.equal(video.loadCalls, 1)
  assert.equal(video.paused, true)
})

test('범위에서 해제된 영상과 새 revision은 다시 준비하고 이전 소스를 재사용하지 않는다', () => {
  const video = media()
  const release = retainVideoBuffer(video, '/video?revision=1')
  release()
  const releaseAgain = retainVideoBuffer(video, '/video?revision=1')
  assert.equal(video.src, '/video?revision=1')
  assert.equal(video.loadCalls, 2)
  releaseAgain()
  const releaseNew = retainVideoBuffer(video, '/video?revision=2')
  assert.equal(video.src, '/video?revision=2')
  releaseNew()
})

test('사전 로딩 실패는 활성화 시에만 알리고, 떠난 방문의 이벤트는 전달하지 않는다', () => {
  const video = media()
  const events = []
  video.error = { code: 2 }
  video.dispatchEvent(new Event('error'))
  assert.deepEqual(events, [])
  const detach = bindActiveVideoEvents(video, (type) => events.push(type))
  assert.deepEqual(events, ['error'])
  video.error = null
  video.dispatchEvent(new Event('playing'))
  video.dispatchEvent(new Event('ended'))
  assert.deepEqual(events, ['error', 'playing', 'ended'])
  detach()
  video.dispatchEvent(new Event('error'))
  assert.equal(events.length, 3)
})
