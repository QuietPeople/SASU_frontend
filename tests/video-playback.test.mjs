import test from 'node:test'
import assert from 'node:assert/strict'
import { bindVideoPlayback } from '../src/features/content-viewer/videoPlayback.ts'

const settle = () => new Promise((resolve) => setImmediate(resolve))

function setup(t, play) {
  const document = new EventTarget()
  document.visibilityState = 'visible'
  document.defaultView = new EventTarget()
  let allowed = true
  let blocked = 0
  const intents = []
  const video = {
    ownerDocument: document,
    paused: true,
    ended: false,
    muted: false,
    playCalls: 0,
    async play() {
      this.playCalls += 1
      await play?.(this)
      this.paused = false
      this.ended = false
    },
    pause() {
      this.paused = true
    },
  }
  const controls = bindVideoPlayback(video, {
    canPlay: () => allowed,
    onBlocked: () => {
      blocked += 1
    },
    onIntentChange: (intent) => intents.push(intent),
  })
  t.after(controls.dispose)
  return {
    video,
    controls,
    document,
    intents,
    blocked: () => blocked,
    allow: (value) => {
      allowed = value
    },
    visibility: (value) => {
      document.visibilityState = value
      document.dispatchEvent(new Event('visibilitychange'))
    },
  }
}

test('처음 진입과 다음 영상은 자동 재생하며 이전 영상의 일시정지는 넘겨받지 않는다', async (t) => {
  const first = setup(t)
  await first.controls.resume()
  assert.equal(first.video.paused, false)
  first.controls.toggle()
  assert.equal(first.video.paused, true)
  first.controls.dispose()
  const next = setup(t)
  await next.controls.resume()
  assert.equal(next.video.paused, false)
})

test('재생 중 브라우저 탭을 떠나면 멈추고 돌아오면 다시 재생한다', async (t) => {
  const ctx = setup(t)
  await ctx.controls.resume()
  ctx.visibility('hidden')
  assert.equal(ctx.video.paused, true)
  ctx.visibility('visible')
  await settle()
  assert.equal(ctx.video.paused, false)
  assert.equal(ctx.video.playCalls, 2)
})

test('직접 멈춘 현재 영상은 브라우저 탭을 다녀와도 일시정지를 유지한다', async (t) => {
  const ctx = setup(t)
  await ctx.controls.resume()
  ctx.controls.toggle()
  ctx.visibility('hidden')
  ctx.visibility('visible')
  await settle()
  assert.equal(ctx.video.paused, true)
  assert.equal(ctx.video.playCalls, 1)
  ctx.controls.toggle()
  await settle()
  assert.equal(ctx.video.paused, false)
})

test('숨겨진 탭에서 처음 열린 영상은 보일 때 재생하고 페이지 복원에도 이어진다', async (t) => {
  const ctx = setup(t)
  ctx.visibility('hidden')
  await ctx.controls.resume()
  assert.equal(ctx.video.playCalls, 0)
  ctx.visibility('visible')
  await settle()
  ctx.document.defaultView.dispatchEvent(new Event('pagehide'))
  assert.equal(ctx.video.paused, true)
  ctx.document.defaultView.dispatchEvent(new Event('pageshow'))
  await settle()
  assert.equal(ctx.video.paused, false)
})

test('영상 이동 중에는 복귀해도 재생하지 않고 이동 실패 시 이전 재생 의도로 복구한다', async (t) => {
  const ctx = setup(t)
  await ctx.controls.resume()
  ctx.allow(false)
  ctx.controls.suspend()
  ctx.visibility('hidden')
  ctx.visibility('visible')
  await settle()
  assert.equal(ctx.video.paused, true)
  ctx.allow(true)
  await ctx.controls.resume()
  assert.equal(ctx.video.paused, false)
  ctx.controls.toggle()
  ctx.controls.suspend()
  await ctx.controls.resume()
  assert.equal(ctx.video.paused, true)
})

test('소리 있는 자동 재생이 차단되면 음소거로 한 번만 다시 시도한다', async (t) => {
  const ctx = setup(t, (video) => {
    if (!video.muted) throw new DOMException('Autoplay blocked', 'NotAllowedError')
  })
  await ctx.controls.resume()
  assert.equal(ctx.video.playCalls, 2)
  assert.equal(ctx.video.muted, true)
  assert.equal(ctx.video.paused, false)
  assert.equal(ctx.blocked(), 0)
})

test('음소거 재생까지 차단되면 안내하고 무한 재시도하지 않는다', async (t) => {
  const ctx = setup(t, () => {
    throw new DOMException('Autoplay blocked', 'NotAllowedError')
  })
  await ctx.controls.resume()
  assert.equal(ctx.video.playCalls, 2)
  assert.equal(ctx.video.paused, true)
  assert.equal(ctx.blocked(), 1)
})

test('이미 떠난 영상의 지연된 실패나 탭 복귀 이벤트는 재생을 다시 시도하지 않는다', async (t) => {
  let reject
  const ctx = setup(
    t,
    () =>
      new Promise((_, fail) => {
        reject = fail
      }),
  )
  const pending = ctx.controls.resume()
  ctx.controls.dispose()
  reject(new DOMException('Autoplay blocked', 'NotAllowedError'))
  await pending
  ctx.visibility('hidden')
  ctx.visibility('visible')
  await settle()
  assert.equal(ctx.video.playCalls, 1)
  assert.equal(ctx.blocked(), 0)
})

test('사전 로딩 후 자동 재생을 기다리는 paused 상태를 사용자 일시정지로 알리지 않는다', async (t) => {
  let start
  const ctx = setup(
    t,
    () =>
      new Promise((resolve) => {
        start = resolve
      }),
  )
  const pending = ctx.controls.resume()
  assert.equal(ctx.video.paused, true)
  assert.deepEqual(ctx.intents, [])
  start()
  await pending
  assert.equal(ctx.video.paused, false)
  assert.deepEqual(ctx.intents, [])
  ctx.controls.toggle()
  assert.equal(ctx.video.paused, true)
  assert.deepEqual(ctx.intents, ['pause'])
  ctx.controls.toggle()
  assert.deepEqual(ctx.intents, ['pause', 'play'])
  start()
  await settle()
})

test('탭 이동·영상 전환·자동 반복의 정지는 일시정지 버튼 표시를 요청하지 않는다', async (t) => {
  const ctx = setup(t)
  await ctx.controls.resume()
  ctx.visibility('hidden')
  assert.equal(ctx.video.paused, true)
  assert.deepEqual(ctx.intents, [])
  ctx.visibility('visible')
  await settle()
  ctx.controls.suspend()
  assert.deepEqual(ctx.intents, [])
  await ctx.controls.resume()
  ctx.video.ended = true
  ctx.video.paused = true
  await ctx.controls.resume()
  assert.equal(ctx.video.paused, false)
  assert.deepEqual(ctx.intents, [])
})

test('자동 재생이 차단되면 사용자 일시정지와 구분하여 재생 안내를 요청한다', async (t) => {
  const ctx = setup(t, () => {
    throw new DOMException('Autoplay blocked', 'NotAllowedError')
  })
  await ctx.controls.resume()
  assert.equal(ctx.blocked(), 1)
  assert.deepEqual(ctx.intents, [])
})
