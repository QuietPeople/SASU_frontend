import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  accumulateWatchSample,
  createWatchTracking,
} from '../src/features/content-viewer/watchTracking.ts'

function point(state, currentTime, wallTime, extra = {}) {
  accumulateWatchSample(state, {
    currentTime,
    wallTime,
    duration: 30,
    playbackRate: 1,
    seeking: false,
    ...extra,
  })
}

test('연속 재생은 실제 재생 시간과 고유 구간을 함께 보고한다', () => {
  const state = createWatchTracking()
  state.playing = true
  point(state, 0, 0)
  point(state, 1, 1000)
  point(state, 2, 2000)
  assert.equal(state.played, 2)
  assert.deepEqual(state.ranges, [[0, 2]])
})

test('탐색으로 건너뛴 2~20초는 시청 구간에 넣지 않는다', () => {
  const state = createWatchTracking()
  state.playing = true
  point(state, 0, 0)
  point(state, 2, 2000)
  state.position = null
  point(state, 20, 2200, { seeking: true })
  point(state, 21, 3200)
  assert.equal(state.played, 3)
  assert.deepEqual(state.ranges, [
    [0, 2],
    [20, 21],
  ])
})

test('같은 구간 재시청은 실제 시간만 누적하고 고유 구간은 중복하지 않는다', () => {
  const state = createWatchTracking()
  state.playing = true
  point(state, 0, 0)
  point(state, 2, 2000)
  state.position = null
  point(state, 0, 2200)
  point(state, 2, 4200)
  assert.equal(state.played, 4)
  assert.deepEqual(state.ranges, [[0, 2]])
})

test('일시정지·버퍼링 중 경과 시간과 비정상 재생 위치 점프는 누적하지 않는다', () => {
  const state = createWatchTracking()
  state.playing = true
  point(state, 0, 0)
  point(state, 1, 1000)
  state.playing = false
  point(state, 1, 10000)
  state.playing = true
  point(state, 2, 11000)
  point(state, 25, 11010)
  assert.equal(state.played, 2)
  assert.deepEqual(state.ranges, [[0, 2]])
})

test('재생 속도에 따른 실제 시간과 영상 끝 경계를 구분한다', () => {
  const state = createWatchTracking()
  state.playing = true
  point(state, 28, 0, { playbackRate: 2 })
  point(state, 32, 1000, { playbackRate: 2 })
  assert.equal(state.played, 1)
  assert.deepEqual(state.ranges, [[28, 30]])
})
