import assert from 'node:assert/strict'
import { test } from 'node:test'
import { bindScrollNavigation } from '../src/features/content-viewer/swipeNavigation.ts'

function setup(t, override = {}) {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1000 })
  const window = new EventTarget()
  window.matchMedia = () => ({ matches: override.reducedMotion ?? false })
  const document = new EventTarget()
  document.defaultView = window
  document.body = {}
  document.querySelector = () => null
  const target = new EventTarget()
  Object.assign(target, {
    ownerDocument: document,
    scrollTop: 600,
    clientHeight: 600,
    style: {},
    dataset: {},
    children: [],
  })
  target.contains = (node) => node === target
  const captures = new Set()
  target.setPointerCapture = (id) => captures.add(id)
  target.hasPointerCapture = (id) => captures.has(id)
  target.releasePointerCapture = (id) => captures.delete(id)
  const scrolls = []
  target.scrollTo = (options) => {
    target.scrollTop = options.top
    scrolls.push(options)
  }
  let index = 1
  const calls = []
  const interactions = []
  const pending = []
  const controller = bindScrollNavigation(target, {
    activeIndex: () => index,
    count: () => 5,
    navigate: async (direction) => {
      calls.push(direction)
      if (override.navigate) return override.navigate(direction)
      index += direction === 'next' ? 1 : -1
      controller.sync()
      return true
    },
    onInteraction: (value) => interactions.push(value),
    onPending: (value) => pending.push(value),
  })
  t.after(controller.dispose)
  const tick = async (ms = 200) => {
    t.mock.timers.tick(ms)
    for (let n = 0; n < 8; n++) await Promise.resolve()
  }
  const send = (type, props = {}, interactive = false) => {
    const event = new Event(type, { cancelable: true })
    Object.assign(event, {
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
      clientX: 100,
      clientY: 400,
      key: 'ArrowDown',
      repeat: false,
      detail: 1,
      ...props,
    })
    Object.defineProperty(event, 'target', { value: target })
    event.composedPath = () => (interactive ? [{ closest: () => ({}) }, target] : [target])
    const receiver = ['pointermove', 'pointerup', 'pointercancel', 'keydown'].includes(type)
      ? window
      : target
    receiver.dispatchEvent(event)
    return event
  }
  const scroll = (top, end = true) => {
    target.scrollTop = top
    send('scroll')
    if (end) send('scrollend')
  }
  return {
    target,
    window,
    document,
    scrolls,
    captures,
    calls,
    interactions,
    pending,
    controller,
    tick,
    send,
    scroll,
    setIndex: (next) => {
      index = next
      controller.sync()
    },
  }
}

test('휠·터치를 가로채지 않고 실제 스크롤이 정렬된 뒤 현재 항목을 변경한다', async (t) => {
  const { send, scroll, calls, tick, target, interactions, captures } = setup(t)
  assert.equal(send('wheel', { deltaY: 600 }).defaultPrevented, false)
  send('pointerdown', { pointerType: 'touch' })
  assert.equal(send('pointermove', { pointerType: 'touch', clientY: 0 }).defaultPrevented, false)
  assert.equal(captures.size, 0)
  scroll(850, false)
  await tick()
  assert.deepEqual(calls, [])
  assert.equal(interactions.at(-1), true)
  scroll(1200)
  await tick()
  assert.deepEqual(calls, ['next'])
  assert.equal(target.scrollTop, 1200)
  assert.equal(interactions.at(-1), false)
})

test('같은 스크롤 요소에서 포인터 이동이나 휠 대기 없이 연속 이동한다', async (t) => {
  const { scroll, calls, tick, send, target } = setup(t)
  scroll(1200)
  await tick(0)
  scroll(1800)
  await tick(0)
  scroll(1200)
  await tick(0)
  assert.deepEqual(calls, ['next', 'next', 'previous'])
  assert.equal(target.scrollTop, 1200)
  assert.equal(send('wheel', { deltaY: 20 }).defaultPrevented, false)
})

test('부분 스크롤과 제자리 복귀는 이동·학습 활성화를 발생시키지 않는다', async (t) => {
  const { scroll, calls, tick, interactions } = setup(t)
  scroll(720, false)
  await tick()
  assert.deepEqual(calls, [])
  scroll(600)
  await tick()
  assert.deepEqual(calls, [])
  assert.equal(interactions.at(-1), false)
})

test('scrollend가 없는 환경에서도 정렬된 위치만 타이머로 확정한다', async (t) => {
  const { scroll, calls, tick } = setup(t)
  scroll(1200, false)
  await tick(160)
  assert.deepEqual(calls, ['next'])
})

test('저장·복기 후보 요청 중 중복 이동을 막고, 실패하면 기존 영상으로 복구한다', async (t) => {
  let finish
  const promise = new Promise((resolve) => {
    finish = resolve
  })
  const { scroll, calls, tick, target, pending, interactions } = setup(t, {
    navigate: () => promise,
  })
  scroll(1200)
  scroll(1800)
  await tick()
  assert.deepEqual(calls, ['next'])
  assert.equal(pending.at(-1), true)
  finish(false)
  await tick()
  assert.equal(target.scrollTop, 600)
  assert.equal(pending.at(-1), false)
  assert.equal(interactions.at(-1), false)
  scroll(1200)
  await tick()
  assert.equal(calls.length, 2)
})

test('성공 응답 후 새 항목 렌더가 늦어도 이전 위치로 튀거나 중복 요청하지 않는다', async (t) => {
  const { scroll, calls, tick, target, pending, setIndex } = setup(t, {
    navigate: async () => true,
  })
  scroll(1200)
  await tick()
  assert.equal(target.scrollTop, 1200)
  assert.equal(pending.at(-1), true)
  scroll(1200)
  assert.equal(calls.length, 1)
  setIndex(2)
  assert.equal(pending.at(-1), false)
})

test('빠르게 여러 칸 이동한 입력도 복기카드를 건너뛰지 않고 인접 항목만 확정한다', async (t) => {
  const { scroll, calls, tick, target } = setup(t)
  scroll(2400)
  await tick()
  assert.deepEqual(calls, ['next'])
  assert.equal(target.scrollTop, 1200)
})

test('방향키는 네이티브 스크롤로 이동하며 입력 필드·반복 키는 가로채지 않는다', async (t) => {
  const { send, scrolls, scroll, calls, tick } = setup(t)
  assert.equal(send('keydown', {}, true).defaultPrevented, false)
  send('keydown', { repeat: true })
  send('keydown', { ctrlKey: true })
  assert.deepEqual(scrolls, [])
  send('keydown')
  assert.deepEqual(scrolls.at(-1), { top: 1200, behavior: 'smooth' })
  assert.deepEqual(calls, [])
  scroll(1200)
  await tick()
  assert.deepEqual(calls, ['next'])
})

test('마우스 드래그는 scrollTop을 이동하고 뒤따르는 클릭·카드 뒤집기를 차단한다', async (t) => {
  const { send, target, scrolls, scroll, tick, calls, captures } = setup(t)
  send('pointerdown')
  send('pointermove', { clientY: 220 })
  assert.equal(target.scrollTop, 780)
  assert.equal(target.style.scrollSnapType, 'none')
  assert.equal(captures.has(1), true)
  send('pointerup', { clientY: 220 })
  assert.equal(target.style.scrollSnapType, '')
  assert.equal(captures.size, 0)
  assert.deepEqual(scrolls.at(-1), { top: 1200, behavior: 'smooth' })
  assert.equal(send('click').defaultPrevented, true)
  scroll(1200)
  await tick(400)
  assert.deepEqual(calls, ['next'])
  assert.equal(send('click').defaultPrevented, false)
})

test('짧은 마우스 끌기·취소·재생바 조작에서는 항목을 변경하지 않는다', async (t) => {
  const { send, target, calls, tick } = setup(t)
  send('pointerdown', {}, true)
  send('pointermove', { clientY: 0 })
  assert.equal(target.scrollTop, 600)
  send('pointerup')
  send('pointerdown')
  send('pointermove', { clientY: 350 })
  send('pointerup', { clientY: 350 })
  await tick()
  assert.equal(target.scrollTop, 600)
  send('pointerdown')
  send('pointermove', { clientY: 100 })
  send('pointercancel')
  await tick()
  assert.equal(target.scrollTop, 600)
  assert.deepEqual(calls, [])
})

test('크기 변경 후에도 현재 항목 위치를 맞추고 목록 양끝을 넘지 않는다', async (t) => {
  const { target, window, setIndex, send, scrolls, calls } = setup(t)
  target.clientHeight = 700
  window.dispatchEvent(new Event('resize'))
  assert.equal(target.scrollTop, 700)
  setIndex(0)
  send('keydown', { key: 'ArrowUp' })
  assert.equal(scrolls.at(-1).top, 0)
  setIndex(4)
  send('keydown')
  assert.equal(scrolls.at(-1).top, 2800)
  assert.deepEqual(calls, [])
})

test('화면을 떠난 후 늦게 끝난 요청이나 이벤트는 기존 화면을 조작하지 않는다', async (t) => {
  let finish
  const promise = new Promise((resolve) => {
    finish = resolve
  })
  const { controller, scroll, tick, calls, scrolls, send } = setup(t, { navigate: () => promise })
  scroll(1200)
  controller.dispose()
  finish(false)
  await tick()
  send('keydown')
  scroll(1800)
  assert.deepEqual(calls, ['next'])
  assert.deepEqual(scrolls, [])
})

test('동작 줄이기에서는 방향키의 정렬 애니메이션을 생략한다', (t) => {
  const { send, scrolls } = setup(t, { reducedMotion: true })
  send('keydown')
  assert.equal(scrolls.at(-1).behavior, 'instant')
})

test('소수점 높이가 누적되어도 실제 슬롯 위치를 사용해 정렬을 판정한다', async (t) => {
  const { target, scroll, tick, setIndex, calls } = setup(t)
  target.children = Array.from({ length: 5 }, (_, index) => ({
    offsetTop: Math.round(index * 600.7),
  }))
  setIndex(3)
  scroll(2403)
  await tick()
  assert.deepEqual(calls, ['next'])
  assert.equal(target.scrollTop, 2403)
})
