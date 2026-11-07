type ScrollBody = Pick<HTMLElement, 'style'>
interface ScrollLock {
  count: number
  overflow: string
  priority: string
}
const locks = new WeakMap<ScrollBody, ScrollLock>()

// 중첩 창이 어떤 순서로 닫혀도 마지막 창에서만 원래 스크롤 상태를 복원한다.
export function lockBodyScroll(body: ScrollBody = document.body): () => void {
  const current = locks.get(body)
  const lock = current ?? {
    count: 0,
    overflow: body.style.getPropertyValue('overflow'),
    priority: body.style.getPropertyPriority('overflow'),
  }
  if (!current) {
    locks.set(body, lock)
    body.style.setProperty('overflow', 'hidden')
  }
  lock.count += 1
  let released = false
  return () => {
    if (released) return
    released = true
    lock.count -= 1
    if (lock.count > 0) return
    if (lock.overflow) body.style.setProperty('overflow', lock.overflow, lock.priority)
    else body.style.removeProperty('overflow')
    locks.delete(body)
  }
}
