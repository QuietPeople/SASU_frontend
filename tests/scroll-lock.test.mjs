import assert from 'node:assert/strict'
import { test } from 'node:test'
import { lockBodyScroll } from '../src/admin/scrollLock.ts'

function body(overflow = '', priority = '') {
  const properties = new Map(overflow ? [['overflow', { value: overflow, priority }]] : [])
  return {
    style: {
      getPropertyValue: (name) => properties.get(name)?.value ?? '',
      getPropertyPriority: (name) => properties.get(name)?.priority ?? '',
      setProperty: (name, value, priority = '') => properties.set(name, { value, priority }),
      removeProperty: (name) => properties.delete(name),
    },
  }
}

for (const outerFirst of [true, false]) {
  test(`중첩 삭제창을 ${outerFirst ? '바깥 창' : '안쪽 창'}부터 닫아도 마지막에 스크롤을 복원한다`, () => {
    const page = body()
    const outer = lockBodyScroll(page)
    const inner = lockBodyScroll(page)
    ;(outerFirst ? outer : inner)()
    assert.equal(page.style.getPropertyValue('overflow'), 'hidden')
    ;(outerFirst ? inner : outer)()
    assert.equal(page.style.getPropertyValue('overflow'), '')
  })
}

test('원래 overflow 값과 important 우선순위를 보존한다', () => {
  const page = body('auto', 'important')
  const unlock = lockBodyScroll(page)
  assert.equal(page.style.getPropertyValue('overflow'), 'hidden')
  unlock()
  assert.equal(page.style.getPropertyValue('overflow'), 'auto')
  assert.equal(page.style.getPropertyPriority('overflow'), 'important')
})

test('같은 창의 정리가 반복돼도 다른 창의 잠금이 풀리지 않는다', () => {
  const page = body()
  const outer = lockBodyScroll(page)
  const inner = lockBodyScroll(page)
  outer()
  outer()
  assert.equal(page.style.getPropertyValue('overflow'), 'hidden')
  inner()
  assert.equal(page.style.getPropertyValue('overflow'), '')
})

test('StrictMode처럼 잠금과 정리를 반복해도 다음 창을 정상적으로 잠근다', () => {
  const page = body('scroll')
  lockBodyScroll(page)()
  const unlock = lockBodyScroll(page)
  assert.equal(page.style.getPropertyValue('overflow'), 'hidden')
  unlock()
  assert.equal(page.style.getPropertyValue('overflow'), 'scroll')
})

test('서로 다른 문서의 스크롤 잠금은 독립적이다', () => {
  const first = body()
  const second = body('auto')
  const a = lockBodyScroll(first)
  const b = lockBodyScroll(second)
  a()
  assert.equal(first.style.getPropertyValue('overflow'), '')
  assert.equal(second.style.getPropertyValue('overflow'), 'hidden')
  b()
  assert.equal(second.style.getPropertyValue('overflow'), 'auto')
})
