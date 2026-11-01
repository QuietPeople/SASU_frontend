import assert from 'node:assert/strict'
import { test } from 'node:test'
import { categoryDirty, categoryNameError, categoryUsage } from '../src/admin/categoryEditor.ts'

const categories = [
  { category_id: 1, name: '엑셀' },
  { category_id: 2, name: '문서 작성' },
]

test('분야명은 앞뒤 공백 제외 1~30자이며 변경 없는 이름은 dirty가 아니다', () => {
  assert.equal(categoryDirty({ id: 1, name: ' 엑셀 ', original: '엑셀' }), false)
  assert.equal(categoryDirty({ id: null, name: '  ', original: '' }), false)
  assert.equal(categoryDirty({ id: 1, name: '', original: '엑셀' }), true)
  assert.ok(categoryNameError({ id: null, name: ' ', original: '' }, categories))
  assert.equal(categoryNameError({ id: null, name: '가'.repeat(30), original: '' }, categories), '')
  assert.ok(categoryNameError({ id: null, name: '가'.repeat(31), original: '' }, categories))
  assert.equal(categoryNameError({ id: null, name: '😀'.repeat(30), original: '' }, categories), '')
})

test('동일 이름 추가는 재사용을 허용하고 다른 분야의 이름으로 수정은 차단한다', () => {
  assert.equal(categoryNameError({ id: null, name: '엑셀', original: '' }, categories), '')
  assert.equal(categoryNameError({ id: 1, name: '엑셀', original: '엑셀' }, categories), '')
  assert.ok(categoryNameError({ id: 1, name: ' 문서 작성 ', original: '엑셀' }, categories))
})

test('분야 없는 초안은 제외하고 분야별 전체·공개·임시저장 수를 집계한다', () => {
  const counts = categoryUsage([
    { category: { category_id: 1 }, status: 'PUBLISHED' },
    { category: { category_id: 1 }, status: 'DRAFT' },
    { category: { category_id: 2 }, status: 'DRAFT' },
    { category: null, status: 'DRAFT' },
  ])
  assert.deepEqual(counts.get(1), { total: 2, published: 1, draft: 1 })
  assert.deepEqual(counts.get(2), { total: 1, published: 0, draft: 1 })
  assert.equal(counts.size, 2)
})
