import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  adminFilters,
  adminPage,
  adminStatus,
  adminId,
  adminMissing,
  adminContentListPath,
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

test('미등록 항목 변경은 검색·분야·공개 상태를 유지하고 페이지를 초기화한다', () => {
  const original = new URLSearchParams('q=엑셀&category_id=11&status=DRAFT&page=4')
  const next = adminFilters(original, { missing: 'learning_material' })
  assert.equal(next.get('missing'), 'learning_material')
  assert.equal(next.get('q'), '엑셀')
  assert.equal(next.get('category_id'), '11')
  assert.equal(next.get('status'), 'DRAFT')
  assert.equal(next.has('page'), false)
  const moved = adminFilters(next, { page: '2' })
  assert.equal(moved.get('missing'), 'learning_material')
  const cleared = adminFilters(moved, { missing: '' })
  assert.equal(cleared.has('missing'), false)
  assert.equal(cleared.has('page'), false)
  assert.equal(cleared.get('q'), '엑셀')
})

test('콘텐츠 목록·학습자료 목록·상태별 개수에 같은 미등록 조건을 전달한다', () => {
  for (const missing of ['video', 'learning_material', 'either']) {
    const params = new URLSearchParams({
      q: ' 엑셀 ',
      category_id: '11',
      status: 'DRAFT',
      page: '3',
      missing,
    })
    for (const options of [
      {},
      { size: 1, status: 'ALL' },
      { size: 1, status: 'PUBLISHED' },
      { size: 1, status: 'DRAFT' },
    ]) {
      const url = new URL(adminContentListPath(params, options), 'http://local')
      assert.equal(url.pathname, '/contents')
      assert.equal(url.searchParams.get('missing'), missing)
      assert.equal(url.searchParams.get('q'), '엑셀')
      assert.equal(url.searchParams.get('category_id'), '11')
      assert.equal(url.searchParams.get('status'), options.status ?? 'DRAFT')
      assert.equal(url.searchParams.get('page'), options.status ? '1' : '3')
      assert.equal(url.searchParams.get('size'), String(options.size ?? 10))
    }
  }
})

test('전체 또는 잘못된 미등록 조건은 서버에 보내지 않는다', () => {
  for (const value of [null, '', 'all', 'quiz', 'video,learning_material']) {
    assert.equal(adminMissing(value), undefined)
    const url = new URL(
      adminContentListPath(new URLSearchParams({ missing: value ?? '' })),
      'http://local',
    )
    assert.equal(url.searchParams.has('missing'), false)
  }
})
