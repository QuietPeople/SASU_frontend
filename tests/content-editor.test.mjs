import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  contentSignature,
  initialFields,
  missingPublishFields,
  videoSelectionError,
  isValidReviewDate,
  localReviewDate,
  addContentTag,
  tagInputError,
  contentFieldError,
} from '../src/admin/contentEditor.ts'

const complete = {
  title: '업무 기초',
  category: '1',
  core: '핵심 내용',
  source: '참고 자료',
  reviewed: '2026-10-25',
  caution: false,
  cautionText: '',
}

test('새 콘텐츠의 공개 필수 7종을 구분하고 퀴즈는 요구하지 않는다', () => {
  assert.deepEqual(missingPublishFields(initialFields(), [], false), [
    'title',
    'category',
    'tags',
    'core',
    'source',
    'reviewed',
    'video',
  ])
  assert.deepEqual(missingPublishFields(complete, [{ name: '기초' }], true), [])
  assert.deepEqual(
    missingPublishFields({ ...complete, title: '   ', reviewed: '' }, [{ name: '기초' }], true),
    ['title', 'reviewed'],
  )
  assert.deepEqual(missingPublishFields(complete, [{ name: '기초' }], false), ['video'])
})

test('태그 확정 시 기존 ID를 재사용하고 중복 추가하지 않는다', () => {
  const selected = [{ tag_id: 2, name: '기초' }]
  const options = [{ tag_id: 8, name: '엑셀' }]
  assert.deepEqual(addContentTag(selected, ' 엑셀 ', options), [...selected, options[0]])
  assert.deepEqual(addContentTag(selected, '기초'), selected)
  assert.deepEqual(addContentTag(selected, '새 태그'), [...selected, { name: '새 태그' }])
  assert.deepEqual(addContentTag(selected, ' '), selected)
})

test('저장 상태는 실제 입력 변경을 감지하고 태그 ID 부여만으로 변경 표시하지 않는다', () => {
  const before = contentSignature(complete, [{ name: '기초' }, { name: '엑셀' }])
  assert.equal(
    contentSignature(complete, [
      { tag_id: 8, name: '엑셀' },
      { tag_id: 2, name: '기초' },
    ]),
    before,
  )
  assert.equal(
    contentSignature({ ...complete, title: ' 업무 기초 ' }, [{ name: '기초' }, { name: '엑셀' }]),
    before,
  )
  assert.notEqual(
    contentSignature({ ...complete, title: '새 제목' }, [{ name: '기초' }, { name: '엑셀' }]),
    before,
  )
  assert.notEqual(contentSignature(complete, [{ name: '기초' }]), before)
})

test('태그를 확정하기 전에는 공개 준비가 충족되지 않는다', () => {
  const tags = []
  assert.deepEqual(missingPublishFields(complete, tags, true), ['tags'])
  const confirmed = addContentTag(tags, '엑셀')
  assert.deepEqual(tags, [])
  assert.deepEqual(missingPublishFields(complete, confirmed, true), [])
  assert.deepEqual(missingPublishFields(complete, [], true), ['tags'])
})

const videoPolicy = {
  accept: 'video/mp4,video/quicktime,video/webm,video/x-matroska,.mp4,.mov,.webm,.mkv',
  max_bytes: 200 * 1024 * 1024,
  min_duration_sec: 1,
  max_duration_sec: 180,
  formats: [],
}

test('영상 선택은 지원 확장자와 MIME을 확인하며 대문자·MIME 없는 파일을 처리한다', () => {
  for (const [name, type] of [
    ['test.MP4', 'video/mp4'],
    ['test.mov', 'video/quicktime'],
    ['test.webm', 'video/webm'],
    ['test.mkv', ''],
    ['test.mkv', 'application/octet-stream'],
  ]) {
    assert.equal(videoSelectionError([{ name, type, size: 100 }], videoPolicy), null)
  }
  for (const [name, type] of [
    ['test.txt', 'text/plain'],
    ['test.exe', 'video/mp4'],
    ['test.mp4', 'text/plain'],
    ['test.avi', 'video/x-msvideo'],
  ]) {
    assert.match(videoSelectionError([{ name, type, size: 100 }], videoPolicy), /지원하지 않는/)
  }
})

test('드롭 파일은 한 개만 허용하며 용량·빈 파일·정책 로딩을 검증한다', () => {
  const file = { name: 'test.mp4', type: 'video/mp4', size: videoPolicy.max_bytes }
  assert.equal(videoSelectionError([file], videoPolicy), null)
  assert.match(videoSelectionError([{ ...file, size: file.size + 1 }], videoPolicy), /최대 200 MB/)
  assert.match(videoSelectionError([{ ...file, size: 0 }], videoPolicy), /비어 있는/)
  assert.match(videoSelectionError([file, file], videoPolicy), /한 개씩/)
  assert.match(videoSelectionError([], videoPolicy), /한 개씩/)
  assert.match(videoSelectionError([file]), /불러온 뒤/)
})

test('검토일의 잘못된 날짜와 윤년을 검증한다', () => {
  assert.equal(isValidReviewDate('2024-02-29'), true)
  for (const date of ['2026-02-29', '2026-04-31', '2026-13-01', '2026-10', '0000-01-01'])
    assert.equal(isValidReviewDate(date), false)
  assert.deepEqual(
    missingPublishFields({ ...complete, reviewed: '2026-02-30' }, [{ name: '기초' }], true),
    ['reviewed'],
  )
})

test('다이얼의 초기 날짜 계산은 로컬 날짜의 월·연도 경계를 처리한다', () => {
  assert.equal(localReviewDate(0, new Date(2026, 9, 25, 0, 30)), '2026-10-25')
  assert.equal(localReviewDate(-1, new Date(2026, 0, 1, 0, 30)), '2025-12-31')
  assert.equal(localReviewDate(-1, new Date(2024, 2, 1, 12)), '2024-02-29')
})

test('태그는 앞뒤 공백을 제외한 2~30자만 확정할 수 있고 버튼·Enter 검증을 공유한다', () => {
  assert.match(tagInputError('ㄱ'), /2자 이상/)
  assert.match(tagInputError(' 가 '), /2자 이상/)
  assert.match(tagInputError('   '), /2자 이상/)
  assert.equal(tagInputError(' 가나 '), null)
  assert.equal(tagInputError('가'.repeat(30)), null)
  assert.match(tagInputError('가'.repeat(31)), /최대 길이.*30자/)
  assert.deepEqual(addContentTag([], 'ㄱ'), [])
  assert.deepEqual(addContentTag([], '가'.repeat(31)), [])
  assert.deepEqual(addContentTag([], '  가나  '), [{ name: '가나' }])
  assert.equal(tagInputError('😀'.repeat(30)), null)
  assert.match(tagInputError('😀'.repeat(31)), /최대 길이/)
})

test('제목의 200자 경계와 공백·날짜 형식을 검증하고 출처는 자료명도 허용한다', () => {
  assert.equal(contentFieldError('title', '가'.repeat(200)), null)
  assert.match(contentFieldError('title', '가'.repeat(201)), /200자 이하/)
  assert.equal(contentFieldError('title', '😀'.repeat(200)), null)
  for (const key of ['title', 'core', 'source', 'cautionText'])
    assert.match(contentFieldError(key, '   '), /공백만/)
  assert.equal(contentFieldError('source', '사내 업무 가이드'), null)
  assert.equal(contentFieldError('source', 'https://example.com/guide'), null)
  assert.match(contentFieldError('reviewed', '2026-02-30'), /올바른 검토일/)
  assert.match(contentFieldError('category', '0'), /다시 선택/)
  assert.match(contentFieldError('category', '직접 입력'), /다시 선택/)
  assert.deepEqual(
    missingPublishFields({ ...complete, title: '가'.repeat(201) }, [{ name: '기초' }], true),
    ['title'],
  )
  assert.deepEqual(missingPublishFields(complete, [{ name: 'ㄱ' }], true), ['tags'])
})
