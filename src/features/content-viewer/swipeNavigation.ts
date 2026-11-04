import type { VideoDirection } from './viewerSession'

const controls =
  'button, a, input, textarea, select, [contenteditable="true"], [role="slider"], [role="tab"], [data-interactive], .sasu-lp'

// 휠·터치는 브라우저의 실제 스크롤/스냅에 맡기고, 정렬된 항목의 활성화만 처리한다.
export function bindScrollNavigation(
  target: HTMLElement,
  options: {
    activeIndex: () => number
    count: () => number
    navigate: (direction: VideoDirection) => Promise<boolean>
    onInteraction: (active: boolean) => void
    onPending: (pending: boolean) => void
  },
) {
  const document = target.ownerDocument
  const window = document.defaultView!
  let disposed = false
  let pending = false
  let interacting = false
  let revision = 0
  let suppressClickUntil = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let mouse: { id: number; x: number; y: number; top: number; dragging: boolean } | null = null
  const height = () => Math.max(1, target.clientHeight)
  const clampIndex = (index: number) => Math.max(0, Math.min(options.count() - 1, index))
  const position = (index: number) =>
    (target.children[index] as HTMLElement | undefined)?.offsetTop ?? index * height()
  const closestIndex = () => {
    let closest = 0
    for (let index = 1; index < options.count(); index++) {
      if (
        Math.abs(target.scrollTop - position(index)) <
        Math.abs(target.scrollTop - position(closest))
      )
        closest = index
    }
    return closest
  }
  const interactive = (event: Event) =>
    event
      .composedPath()
      .some((node) =>
        node !== target && 'closest' in node && typeof node.closest === 'function'
          ? Boolean(node.closest(controls))
          : false,
      )
  const interaction = (value: boolean) => {
    if (interacting === value) return
    interacting = value
    options.onInteraction(value)
  }
  const align = (index: number, smooth = false) => {
    target.scrollTo({
      top: position(clampIndex(index)),
      behavior:
        smooth && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'smooth'
          : 'instant',
    })
  }
  const restore = () => {
    align(options.activeIndex())
    interaction(false)
  }
  const settle = async () => {
    clearTimeout(timer)
    if (disposed || pending || mouse?.dragging) return
    const current = options.activeIndex()
    const index = closestIndex()
    // 타이머로 종료를 확인하는 환경에서도 스냅 애니메이션 중간에는 활성화하지 않는다.
    if (Math.abs(target.scrollTop - position(index)) > 2) return
    if (index === current) {
      interaction(false)
      return
    }
    pending = true
    options.onPending(true)
    interaction(true)
    const request = ++revision
    let moved = false
    try {
      // 빠른 입력에서도 복기 삽입과 시청 보고를 건너뛰지 않고 한 항목씩 확정한다.
      moved = await options.navigate(index > current ? 'next' : 'previous')
    } catch {
      moved = false
    } finally {
      // 성공한 이동은 React가 새 활성 항목을 반영한 뒤 sync에서 마무리한다.
      if (!disposed && request === revision && !moved) {
        pending = false
        options.onPending(false)
        restore()
      }
    }
  }
  const scroll = () => {
    if (Math.abs(target.scrollTop - position(options.activeIndex())) > 2) {
      interaction(true)
      suppressClickUntil = Date.now() + 350
    }
    clearTimeout(timer)
    timer = setTimeout(() => void settle(), 160)
  }
  const keydown = (event: KeyboardEvent) => {
    if (
      !['ArrowUp', 'ArrowDown'].includes(event.key) ||
      event.defaultPrevented ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      interactive(event) ||
      document.querySelector('dialog[open]') ||
      (event.target !== document.body && !target.contains(event.target as Node))
    )
      return
    event.preventDefault()
    if (event.repeat || pending || interacting) return
    align(options.activeIndex() + (event.key === 'ArrowDown' ? 1 : -1), true)
  }
  // 마우스 클릭 드래그만 보완한다. 터치 포인터는 캡처하지 않는다.
  const down = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse' || event.button !== 0 || pending || interactive(event)) return
    mouse = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      top: target.scrollTop,
      dragging: false,
    }
  }
  const move = (event: PointerEvent) => {
    if (!mouse || mouse.id !== event.pointerId) return
    const dy = event.clientY - mouse.y
    const dx = event.clientX - mouse.x
    if (!mouse.dragging) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) <= 12) return
      if (Math.abs(dx) > Math.abs(dy)) {
        mouse = null
        return
      }
      mouse.dragging = true
      target.setPointerCapture?.(event.pointerId)
      target.style.scrollSnapType = 'none'
      target.dataset.dragging = 'true'
      interaction(true)
    }
    event.preventDefault()
    suppressClickUntil = Date.now() + 350
    target.scrollTop = mouse.top - dy
  }
  const release = (cancel = false) => {
    if (!mouse) return
    const previous = mouse
    mouse = null
    if (target.hasPointerCapture?.(previous.id)) target.releasePointerCapture(previous.id)
    target.style.scrollSnapType = ''
    delete target.dataset.dragging
    if (!previous.dragging) return
    const distance = target.scrollTop - previous.top
    const destination = cancel
      ? options.activeIndex()
      : options.activeIndex() +
        (Math.abs(distance) >= Math.min(120, height() * 0.2) ? Math.sign(distance) : 0)
    align(destination, true)
    // 목록 끝에서 스크롤 위치가 그대로인 경우에도 조작 상태를 해제한다.
    clearTimeout(timer)
    timer = setTimeout(() => void settle(), 160)
  }
  const up = (event: PointerEvent) => {
    if (mouse?.id === event.pointerId) release()
  }
  const cancel = () => release(true)
  const click = (event: MouseEvent) => {
    if (event.detail !== 0 && (interacting || pending || Date.now() < suppressClickUntil)) {
      event.preventDefault()
      event.stopImmediatePropagation()
    }
  }
  const controller = new AbortController()
  const capture = { signal: controller.signal, capture: true }
  target.addEventListener('scroll', scroll, { signal: controller.signal, passive: true })
  target.addEventListener('scrollend', () => void settle(), { signal: controller.signal })
  target.addEventListener('pointerdown', down, capture)
  window.addEventListener('pointermove', move, { ...capture, passive: false })
  window.addEventListener('pointerup', up, capture)
  window.addEventListener('pointercancel', cancel, capture)
  target.addEventListener('lostpointercapture', cancel, capture)
  target.addEventListener('click', click, capture)
  target.addEventListener(
    'dragstart',
    (event) => {
      if (!interactive(event)) event.preventDefault()
    },
    capture,
  )
  window.addEventListener('keydown', keydown, capture)
  window.addEventListener('blur', cancel, capture)

  const sync = () => {
    revision++
    pending = false
    options.onPending(false)
    clearTimeout(timer)
    release(true)
    restore()
  }
  const resize = () => {
    if (!pending) sync()
  }
  window.addEventListener('resize', resize, { signal: controller.signal })
  return {
    sync,
    resize,
    dispose: () => {
      disposed = true
      revision++
      controller.abort()
      clearTimeout(timer)
      if (mouse && target.hasPointerCapture?.(mouse.id)) target.releasePointerCapture(mouse.id)
      target.style.scrollSnapType = ''
    },
  }
}
