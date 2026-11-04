import assert from 'node:assert/strict'
import { test } from 'node:test'
import { bindPlayerGestures } from '../src/features/content-viewer/playerGestures.ts'

function setup(t) {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1000 })
  const surface = new EventTarget()
  surface.ownerDocument = { defaultView: new EventTarget() }
  const actions = []
  const cleanup = bindPlayerGestures(surface, {
    togglePlayback: () => actions.push('playback'),
    like: () => actions.push('like'),
  })
  t.after(cleanup)
  const pointer = (type, props = {}, interactive = false) => {
    const event = new Event(type)
    Object.assign(event, {
      pointerId: 1,
      pointerType: 'touch',
      button: 0,
      clientX: 100,
      clientY: 100,
      ...props,
    })
    if (interactive) event.composedPath = () => [{ closest: () => ({}) }, surface]
    surface.dispatchEvent(event)
  }
  const tap = (props = {}) => {
    pointer('pointerdown', props)
    t.mock.timers.tick(40)
    pointer('pointerup', props)
  }
  return { pointer, tap, actions, cleanup, window: surface.ownerDocument.defaultView }
}

test('터치 후 pointerleave가 발생해도 한 번의 탭은 180ms 뒤 재생만 토글한다', (t) => {
  const { tap, pointer, actions } = setup(t)
  tap()
  pointer('pointerleave')
  assert.deepEqual(actions, [])
  t.mock.timers.tick(179)
  assert.deepEqual(actions, [])
  t.mock.timers.tick(1)
  assert.deepEqual(actions, ['playback'])
})

test('터치·마우스 더블탭은 재생 상태를 바꾸지 않고 좋아요 등록 동작만 호출한다', (t) => {
  const { tap, actions } = setup(t)
  for (const pointerType of ['touch', 'mouse']) {
    tap({ pointerType })
    t.mock.timers.tick(80)
    tap({ pointerType })
    t.mock.timers.tick(300)
  }
  assert.deepEqual(actions, ['like', 'like'])
})

test('떨어진 시점의 탭은 각각 재생을 토글한다', (t) => {
  const { tap, actions } = setup(t)
  tap()
  t.mock.timers.tick(300)
  tap()
  t.mock.timers.tick(300)
  assert.deepEqual(actions, ['playback', 'playback'])
})

test('두 번째 탭을 180ms 안에 시작하면 손을 늦게 떼어도 좋아요만 등록한다', (t) => {
  const { tap, pointer, actions } = setup(t)
  tap()
  t.mock.timers.tick(170)
  pointer('pointerdown')
  t.mock.timers.tick(70)
  assert.deepEqual(actions, [])
  pointer('pointerup')
  t.mock.timers.tick(200)
  assert.deepEqual(actions, ['like'])
})

test('180ms 이후 다시 누르면 좋아요 대신 재생·일시정지를 각각 실행한다', (t) => {
  const { tap, actions } = setup(t)
  tap()
  t.mock.timers.tick(181)
  assert.deepEqual(actions, ['playback'])
  tap()
  t.mock.timers.tick(180)
  assert.deepEqual(actions, ['playback', 'playback'])
})

test('두 번째 탭이 스와이프로 바뀌면 보류 중인 재생·좋아요 모두 취소한다', (t) => {
  const { tap, pointer, actions } = setup(t)
  tap()
  t.mock.timers.tick(170)
  pointer('pointerdown')
  pointer('pointermove', { clientY: 10 })
  pointer('pointerup', { clientY: 10 })
  t.mock.timers.tick(200)
  assert.deepEqual(actions, [])
})

test('빠른 스와이프와 드래그 후 원위치 복귀는 재생·좋아요를 실행하지 않는다', (t) => {
  const { pointer, actions } = setup(t)
  pointer('pointerdown')
  t.mock.timers.tick(40)
  pointer('pointermove', { clientY: 10 })
  pointer('pointerup', { clientY: 10 })
  pointer('pointerdown')
  pointer('pointermove', { clientX: 150 })
  pointer('pointermove', { clientX: 100 })
  pointer('pointerup')
  t.mock.timers.tick(300)
  assert.deepEqual(actions, [])
})

test('pointermove를 받지 못해도 시작·끝 좌표가 다르면 탭으로 처리하지 않는다', (t) => {
  const { pointer, actions } = setup(t)
  pointer('pointerdown')
  pointer('pointerup', { clientY: 200 })
  t.mock.timers.tick(300)
  assert.deepEqual(actions, [])
})

test('진행바·버튼 조작은 기존에 대기하던 화면 탭도 취소한다', (t) => {
  const { tap, pointer, actions } = setup(t)
  tap()
  pointer('pointerdown', {}, true)
  pointer('pointerup', {}, true)
  t.mock.timers.tick(300)
  assert.deepEqual(actions, [])
})

test('두 손가락 조작·길게 누르기·취소된 포인터는 무시한다', (t) => {
  const { pointer, actions } = setup(t)
  pointer('pointerdown')
  pointer('pointerdown', { pointerId: 2 })
  pointer('pointerup', { pointerId: 2 })
  pointer('pointerup')
  pointer('pointerdown')
  t.mock.timers.tick(500)
  pointer('pointerup')
  pointer('pointerdown')
  pointer('pointercancel')
  pointer('pointerup')
  t.mock.timers.tick(300)
  assert.deepEqual(actions, [])
})

test('영상 교체로 정리된 플레이어는 지연된 탭이나 이후 이벤트를 실행하지 않는다', (t) => {
  const { tap, actions, cleanup } = setup(t)
  tap()
  cleanup()
  t.mock.timers.tick(300)
  tap()
  t.mock.timers.tick(300)
  assert.deepEqual(actions, [])
})

test('창을 벗어나거나 누른 채 영상 밖으로 나가면 대기하던 동작을 취소한다', (t) => {
  const { tap, pointer, actions, window } = setup(t)
  tap()
  window.dispatchEvent(new Event('blur'))
  t.mock.timers.tick(300)
  pointer('pointerdown')
  pointer('pointerleave')
  pointer('pointerup')
  t.mock.timers.tick(300)
  assert.deepEqual(actions, [])
})
