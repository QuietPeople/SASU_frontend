const interactiveSelector =
  'button, a, input, textarea, select, [contenteditable="true"], [role="slider"], [role="button"], [data-interactive]'
const doubleTapWindowMs = 180

interface Tap {
  x: number
  y: number
  at: number
  pointerType: string
}

// 숏폼의 스와이프·진행바 조작을 탭으로 처리하지 않고, 더블탭에서는 재생 토글을 생략한다.
export function bindPlayerGestures(
  target: HTMLElement,
  actions: { togglePlayback: () => void; like: () => void },
) {
  let pointer: (Tap & { id: number; moved: boolean }) | null = null
  let lastTap: Tap | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  const downPointers = new Set<number>()

  const cancelTap = () => {
    if (timer !== null) clearTimeout(timer)
    timer = null
    lastTap = null
  }
  const cancel = () => {
    pointer = null
    cancelTap()
  }
  const interactive = (event: PointerEvent) =>
    event
      .composedPath()
      .some(
        (node) =>
          node !== target &&
          'closest' in node &&
          typeof node.closest === 'function' &&
          node.closest(interactiveSelector),
      )
  const down = (event: PointerEvent) => {
    downPointers.add(event.pointerId)
    if (downPointers.size > 1 || event.button !== 0 || interactive(event)) {
      cancel()
      return
    }
    pointer = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      at: Date.now(),
      pointerType: event.pointerType,
      moved: false,
    }
    if (
      lastTap &&
      pointer.at - lastTap.at < doubleTapWindowMs &&
      pointer.pointerType === lastTap.pointerType &&
      Math.hypot(pointer.x - lastTap.x, pointer.y - lastTap.y) < 40
    ) {
      // 두 번째 탭을 누르기 시작했다면 손을 뗄 때까지 단일 탭 실행을 보류한다.
      if (timer !== null) clearTimeout(timer)
      timer = null
    }
  }
  const move = (event: PointerEvent) => {
    if (!pointer || pointer.id !== event.pointerId) return
    if (Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 12) {
      pointer.moved = true
      cancelTap()
    }
  }
  const up = (event: PointerEvent) => {
    downPointers.delete(event.pointerId)
    const start = pointer
    pointer = null
    const now = Date.now()
    if (
      !start ||
      start.id !== event.pointerId ||
      start.moved ||
      downPointers.size ||
      now - start.at > 350 ||
      Math.hypot(event.clientX - start.x, event.clientY - start.y) > 12 ||
      interactive(event)
    ) {
      cancelTap()
      return
    }
    const previous = lastTap
    cancelTap()
    if (
      previous &&
      start.at - previous.at < doubleTapWindowMs &&
      previous.pointerType === event.pointerType &&
      Math.hypot(event.clientX - previous.x, event.clientY - previous.y) < 40
    ) {
      actions.like()
      return
    }
    lastTap = { x: event.clientX, y: event.clientY, at: now, pointerType: event.pointerType }
    timer = setTimeout(() => {
      cancelTap()
      if (!pointer && downPointers.size === 0) actions.togglePlayback()
    }, doubleTapWindowMs)
  }
  const reset = () => {
    downPointers.clear()
    cancel()
  }
  const leave = () => {
    // 터치는 손을 떼면 pointerleave도 발생한다. 완료된 탭의 대기 시간은 유지한다.
    if (pointer) reset()
  }
  const controller = new AbortController()
  const options = { signal: controller.signal, capture: true }
  target.addEventListener('pointerdown', down, options)
  target.addEventListener('pointermove', move, options)
  target.addEventListener('pointerup', up, options)
  target.addEventListener('pointercancel', reset, options)
  target.addEventListener('pointerleave', leave, options)
  // 버튼에서 영상으로 포커스를 옮길 때의 blur는 무시하고 창을 벗어날 때만 취소한다.
  target.ownerDocument.defaultView?.addEventListener('blur', reset, { signal: controller.signal })
  return () => {
    reset()
    controller.abort()
  }
}
