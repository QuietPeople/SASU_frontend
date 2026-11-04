import assert from 'node:assert/strict'
import { test } from 'node:test'
import { feedSlides } from '../src/features/feed/feedSlides.ts'
const card = { id: 'card-1', previousContentId: 2, nextContentId: 3 }

test('영상 순서를 유지하고 복기는 해당 영상 사이, 마지막 복기는 종료 화면 앞에 배치한다', () => {
  const last = { id: 'card-2', previousContentId: 3, nextContentId: null }
  const slides = feedSlides([1, 2, 3], [card, last], card)
  assert.deepEqual(
    slides.map((item) => item.key),
    ['video:1', 'video:2', 'review:card-1', 'video:3', 'review:card-2', 'end'],
  )
  assert.equal(slides[2].card, card)
})

test('후보 삽입 시 기존 영상의 키와 현재 위치는 유지한다', () => {
  const before = feedSlides([1, 2, 3], [], null)
  const after = feedSlides([1, 2, 3], [card], null)
  assert.deepEqual(
    after.filter((item) => item.kind === 'video'),
    before.filter((item) => item.kind === 'video'),
  )
  assert.equal(
    before.findIndex((item) => item.key === 'video:2'),
    after.findIndex((item) => item.key === 'video:2'),
  )
})

test('새 추천 순서와 맞지 않는 이전 카드는 제외하되 이미 열린 카드는 보존한다', () => {
  assert.deepEqual(
    feedSlides([4, 5], [card], null).map((item) => item.key),
    ['video:4', 'video:5', 'end'],
  )
  assert.deepEqual(
    feedSlides([4, 5], [card], card).map((item) => item.key),
    ['video:4', 'video:5', 'review:card-1', 'end'],
  )
  assert.deepEqual(feedSlides([], [], null), [{ key: 'end', kind: 'end' }])
})
