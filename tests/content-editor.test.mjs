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
  tagSearchPath,
  contentFieldError,
  resolveContentTag,
  resolveContentTags,
  contentMetadataBody,
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

test('기존 1자·31~80자 태그는 이름 검색 결과를 ID로 확정하고 공개 조건을 충족한다', () => {
  for (const length of [1, 31, 80]) {
    const tag = { tag_id: 100 + length, name: '가'.repeat(length) }
    const draft = resolveContentTag(`  ${tag.name}  `, [tag])
    assert.deepEqual(draft, tag)
    assert.equal(tagInputError(draft), null)
    assert.deepEqual(addContentTag([], draft), [tag])
    assert.deepEqual(addContentTag([], tag.name, [tag]), [tag])
    assert.deepEqual(missingPublishFields(complete, [tag], true), [])
  }
})

test('선택한 기존 태그 ID는 검색 결과가 바뀌어도 유지하고 이름을 다시 입력하면 신규 조건으로 판단한다', () => {
  const selected = { tag_id: 300, name: '한' }
  assert.deepEqual(resolveContentTag(selected, []), selected)
  assert.deepEqual(addContentTag([], selected, []), [selected])
  assert.equal(tagInputError(resolveContentTag(selected, [])), null)
  assert.match(tagInputError(resolveContentTag('새', [])), /2자 이상/)
  assert.match(tagInputError(resolveContentTag('새'.repeat(31), [])), /30자 이하/)
  assert.deepEqual(addContentTag([], resolveContentTag('새', [])), [])
})

test('같은 ID 또는 이름의 태그를 다시 확정해도 중복하지 않고 미확정 입력은 추가하지 않는다', () => {
  const existing = { tag_id: 301, name: '한' }
  const tags = [existing]
  assert.equal(addContentTag(tags, existing), tags)
  assert.equal(addContentTag(tags, { tag_id: 301, name: '변경된 이름' }), tags)
  assert.equal(addContentTag(tags, ' 한 '), tags)
  const pending = resolveContentTag('긴'.repeat(31), [{ tag_id: 302, name: '긴'.repeat(31) }])
  assert.equal(tagInputError(pending), null)
  assert.deepEqual(tags, [existing])
  assert.deepEqual(contentMetadataBody(complete, tags).tag_ids, [301])
})

test('신규 태그 객체에도 2~30자 경계를 적용하고 기존 태그와 섞여 있어도 오류를 구분한다', () => {
  const existing = { tag_id: 303, name: '한' }
  for (const name of ['가', '가'.repeat(31), '가'.repeat(80)]) {
    assert.ok(tagInputError({ name }))
    assert.deepEqual(missingPublishFields(complete, [existing, { name }], true), ['tags'])
  }
  for (const name of ['가나', '가'.repeat(30)]) {
    assert.equal(tagInputError({ name: `  ${name}  ` }), null)
    assert.deepEqual(addContentTag([], `  ${name}  `), [{ name }])
    assert.deepEqual(missingPublishFields(complete, [existing, { name }], true), [])
  }
})

test('기존 태그는 생성 콜백 없이 연결하고 다른 필드 수정 요청에도 원래 ID를 유지한다', async () => {
  const tags = [1, 31, 80].map((length) => ({ tag_id: length, name: '가'.repeat(length) }))
  const resolved = await resolveContentTags(tags, async () => assert.fail('기존 태그 생성 금지'))
  assert.deepEqual(resolved, tags)
  const body = contentMetadataBody({ ...complete, title: '수정한 제목' }, resolved)
  assert.equal(body.title, '수정한 제목')
  assert.deepEqual(body.tag_ids, [1, 31, 80])
  assert.deepEqual(missingPublishFields(complete, resolved, true), [])
})

test('확정된 신규 이름만 공백 제거 후 생성하고 기존·신규가 같은 ID로 돌아오면 하나로 연결한다', async () => {
  const calls = []
  const resolved = await resolveContentTags(
    [{ tag_id: 304, name: '한' }, { name: ' 새 이름 ' }, { name: '다른 이름' }],
    async (name) => {
      calls.push(name)
      return { tag_id: name === '새 이름' ? 305 : 304, name }
    },
  )
  assert.deepEqual(calls, ['새 이름', '다른 이름'])
  assert.deepEqual(contentMetadataBody(complete, resolved).tag_ids, [304, 305])
})

test('저장 전 신규 태그 검증 실패 시 정상 신규 태그도 먼저 생성하지 않는다', async () => {
  let calls = 0
  for (const name of ['한', '가'.repeat(31)]) {
    await assert.rejects(
      resolveContentTags(
        [{ name: '정상 태그' }, { tag_id: 306, name: '가'.repeat(80) }, { name }],
        async () => {
          calls++
          return { tag_id: 307, name: '정상 태그' }
        },
      ),
      /태그/,
    )
  }
  assert.equal(calls, 0)
})

test('기존 태그 검색은 신규 생성 길이와 별개로 1자·31~80자를 그대로 전송한다', () => {
  assert.equal(tagSearchPath('  '), null)
  for (const length of [1, 2, 30, 31, 80]) {
    const name = '가'.repeat(length)
    const url = new URL(tagSearchPath(`  ${name}  `), 'http://test.invalid')
    assert.equal(url.pathname, '/tags')
    assert.equal(url.searchParams.get('q'), name)
    assert.equal(url.searchParams.get('size'), '20')
  }
})
