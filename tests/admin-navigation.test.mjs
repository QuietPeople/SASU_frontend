import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  adminFilters,
  adminPage,
  adminStatus,
  adminId,
  readAdminView,
  writeAdminView,
} from '../src/admin/navigation.ts'

test('관리자 검색 조건 변경은 페이지를 초기화하고 분야·상태를 보존한다', () => {
  const next = adminFilters(new URLSearchParams('q=기존&page=4&category_id=12&status=PUBLISHED'), {
    q: '엑셀',
  })
  assert.equal(next.get('q'), '엑셀')
  assert.equal(next.get('page'), null)
  assert.equal(next.get('category_id'), '12')
  assert.equal(next.get('status'), 'PUBLISHED')
})
test('페이지 이동과 편집 대상 변경은 기존 검색 조건을 유지한다', () => {
  const next = adminFilters(new URLSearchParams('q=엑셀&page=2&category_id=12'), { edit: '8' })
  assert.equal(next.get('page'), '2')
  assert.equal(next.get('q'), '엑셀')
  assert.equal(next.get('category_id'), '12')
  assert.equal(next.get('edit'), '8')
  assert.equal(adminFilters(next, { page: '3' }).get('page'), '3')
  assert.equal(adminFilters(next, { edit: '' }).has('edit'), false)
})
test('잘못된 페이지·대상·상태는 API에 잘못된 값을 전달하지 않는다', () => {
  for (const value of ['0', '-1', '1.5', 'NaN', '99999999999999999999'])
    assert.equal(adminPage(value), 1)
  assert.equal(adminPage('2'), 2)
  for (const value of [null, '0', '-1', '1e2', '2.5', '9007199254740992'])
    assert.equal(adminId(value), undefined)
  assert.equal(adminId('12'), 12)
  assert.equal(adminStatus('PUBLISHED'), 'PUBLISHED')
  assert.equal(adminStatus('unknown'), 'ALL')
})
test('목록 상태는 행위자·기록 세대·화면별로 분리하고 저장소 제한에도 탐색을 계속한다', () => {
  const previous = globalThis.sessionStorage
  try {
    const entries = new Map()
    globalThis.sessionStorage = {
      getItem: (key) => entries.get(key) ?? null,
      setItem: (key, value) => entries.set(key, value),
    }
    writeAdminView('2:0:contents', 'q=엑셀&page=2')
    assert.equal(readAdminView('2:0:contents'), 'q=엑셀&page=2')
    for (const key of ['2:1:contents', '4:0:contents', '2:0:materials'])
      assert.equal(readAdminView(key), '')
    globalThis.sessionStorage = {
      getItem() {
        throw Error('denied')
      },
      setItem() {
        throw Error('quota')
      },
    }
    assert.equal(readAdminView('2:0:contents'), '')
    assert.doesNotThrow(() => writeAdminView('2:0:contents', ''))
  } finally {
    if (previous === undefined) delete globalThis.sessionStorage
    else globalThis.sessionStorage = previous
  }
})
