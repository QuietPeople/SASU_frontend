import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  initialSeries,
  seriesDirty,
  seriesNameError,
  moveSeriesStep,
  addSeriesStep,
  saveSeries,
  stepWarnings,
} from '../src/admin/seriesEditor.ts'

const initial = {
  summary: {
    updated_at: '2026-11-05T00:00:00.123456Z',
    curriculum_id: 7,
    title: '기초',
    description: '설명',
  },
  steps: [{ content_id: 1 }, { content_id: 2 }],
}

test('시리즈명은 공백과 100자 경계를 확인하며 이모지도 글자 수로 센다', () => {
  assert.match(seriesNameError('   '), /입력/)
  assert.equal(seriesNameError('가'.repeat(100)), null)
  assert.match(seriesNameError('가'.repeat(101)), /100자/)
  assert.equal(seriesNameError('😀'.repeat(100)), null)
})

test('추가 중복과 순서 범위를 보호하며 드래그 이동에서도 나머지 순서를 유지한다', () => {
  assert.deepEqual(addSeriesStep([1, 2], 2), [1, 2])
  assert.deepEqual(addSeriesStep([1, 2], 3), [1, 2, 3])
  assert.deepEqual(moveSeriesStep([1, 2, 3, 4], 1, 3), [2, 3, 1, 4])
  assert.deepEqual(moveSeriesStep([1, 2, 3, 4], 4, 1), [4, 1, 2, 3])
  assert.deepEqual(moveSeriesStep([1, 2], 9, 1), [1, 2])
})

test('변경 없음과 공백만의 변경은 요청하지 않고 순서 변경만 감지한다', async () => {
  const session = initialSeries(initial)
  assert.equal(seriesDirty(session), false)
  assert.equal(seriesDirty({ ...session, fields: { ...session.fields, name: ' 기초 ' } }), false)
  const calls = []
  await saveSeries(
    session,
    1,
    async (...args) => calls.push(args),
    () => {},
  )
  assert.equal(calls.length, 0)
  assert.equal(seriesDirty({ ...session, fields: { ...session.fields, order: [2, 1] } }), true)
})

test('신규 생성 뒤 단계 저장 실패는 생성된 ID를 보존하고 재시도에서 POST하지 않는다', async () => {
  let session = initialSeries()
  session = { ...session, fields: { name: '새 과정', description: '', order: [1, 2] } }
  const failure = new Error('단계 저장 실패')
  const first = []
  await assert.rejects(
    saveSeries(
      session,
      8,
      async (path, options) => {
        first.push([path, options.method])
        if (options.method === 'POST')
          return { summary: { curriculum_id: 42, updated_at: initial.summary.updated_at } }
        throw failure
      },
      (next) => {
        session = next
      },
    ),
    failure,
  )
  assert.deepEqual(first, [
    ['/curriculums', 'POST'],
    ['/curriculums/42/steps', 'PUT'],
  ])
  assert.equal(session.savedId, 42)
  assert.equal(seriesDirty(session), true)
  const retried = []
  session = await saveSeries(
    session,
    8,
    async (path, options) => {
      retried.push([path, options])
      return { updated_at: initial.summary.updated_at }
    },
    () => {},
  )
  assert.equal(retried.length, 1)
  assert.equal(retried[0][0], '/curriculums/42/steps')
  assert.deepEqual(retried[0][1].body, {
    content_ids: [1, 2],
    expected_updated_at: initial.summary.updated_at,
  })
  assert.equal(retried[0][1].actorId, 8)
  assert.equal(seriesDirty(session), false)
})

test('기본정보 PATCH 성공 뒤 PUT 실패하면 단계만 재시도한다', async () => {
  let session = initialSeries(initial)
  session = { ...session, fields: { ...session.fields, name: '수정한 과정', order: [2, 1] } }
  await assert.rejects(
    saveSeries(
      session,
      1,
      async (_, options) => {
        if (options.method === 'PUT') throw new Error('실패')
        return { updated_at: initial.summary.updated_at }
      },
      (next) => {
        session = next
      },
    ),
  )
  const methods = []
  await saveSeries(
    session,
    1,
    async (_, options) => {
      methods.push(options.method)
      return { updated_at: initial.summary.updated_at }
    },
    () => {},
  )
  assert.deepEqual(methods, ['PUT'])
})

test('비어 있는 편성도 저장하며 원본 콘텐츠 삭제 요청을 하지 않는다', async () => {
  const session = initialSeries(initial)
  const calls = []
  const saved = await saveSeries(
    { ...session, fields: { ...session.fields, order: [] } },
    1,
    async (path, options) => {
      calls.push([path, options])
      return { updated_at: initial.summary.updated_at }
    },
    () => {},
  )
  assert.deepEqual(
    calls.map(([path, options]) => [path, options.method, options.body]),
    [
      [
        '/curriculums/7/steps',
        'PUT',
        { content_ids: [], expected_updated_at: initial.summary.updated_at },
      ],
    ],
  )
  assert.equal(seriesDirty(saved), false)
})

test('중복 편성은 요청 전에 거부하고 기본정보 실패 시 단계 요청을 보내지 않는다', async () => {
  const session = initialSeries()
  const duplicate = { ...session, fields: { name: '기초', description: '', order: [1, 1] } }
  let calls = 0
  await assert.rejects(
    saveSeries(
      duplicate,
      1,
      async () => {
        calls++
      },
      () => {},
    ),
    /한 번만/,
  )
  assert.equal(calls, 0)
  await assert.rejects(
    saveSeries(
      { ...duplicate, fields: { ...duplicate.fields, order: [1] } },
      1,
      async () => {
        calls++
        throw new Error('생성 실패')
      },
      () => {},
    ),
    /생성 실패/,
  )
  assert.equal(calls, 1)
})

test('퀴즈 미등록과 비공개·영상 확인 불가를 구분해 경고한다', () => {
  const content = { status: 'PUBLISHED', video_url: '/video', has_quiz: true }
  assert.deepEqual(stepWarnings(content, true), [])
  assert.deepEqual(stepWarnings({ ...content, has_quiz: false }), ['퀴즈 없음 · 완료 불가'])
  assert.deepEqual(stepWarnings({ ...content, status: 'DRAFT' }, false), [
    '임시저장 · 학습자에게 비공개',
  ])
  assert.deepEqual(stepWarnings(content, false), ['영상 확인 필요 · 시청 불가'])
  assert.deepEqual(stepWarnings(undefined), ['콘텐츠 확인 필요'])
})

test('기본정보 저장의 새 버전을 단계 저장에 전달하고 단계 응답 버전으로 다음 편집을 이어간다', async () => {
  const session = initialSeries(initial)
  const versions = ['2026-11-05T00:01:00.123456Z', '2026-11-05T00:02:00.123456Z']
  const calls = []
  const result = await saveSeries(
    { ...session, fields: { ...session.fields, name: '새 제목', order: [2, 1] } },
    1,
    async (_, options) => {
      calls.push(options)
      return { updated_at: versions[calls.length - 1] }
    },
    () => {},
  )
  assert.equal(calls[0].body.expected_updated_at, initial.summary.updated_at)
  assert.equal(calls[1].body.expected_updated_at, versions[0])
  assert.equal(result.updatedAt, versions[1])
})

test('기본정보 편집 충돌은 단계 저장 없이 중단하고 원래 입력을 유지한다', async () => {
  const session = initialSeries(initial)
  session.fields = { ...session.fields, name: '내 입력', order: [2, 1] }
  const original = structuredClone(session)
  let calls = 0
  await assert.rejects(
    saveSeries(
      session,
      1,
      async () => {
        calls++
        throw new Error('충돌')
      },
      () => assert.fail('충돌한 내용을 저장 처리하면 안 됨'),
    ),
    /충돌/,
  )
  assert.equal(calls, 1)
  assert.deepEqual(session, original)
})

test('새 시리즈는 생성과 단계 저장 뒤 받은 ID로 선택한 썸네일을 저장한다', async () => {
  const thumbnailFile = new File(['image'], 'series.png', { type: 'image/png' })
  const session = {
    ...initialSeries(),
    fields: { name: '새 시리즈', description: '', order: [1, 2] },
    thumbnailFile,
  }
  const calls = []
  const progress = []
  const saved = await saveSeries(
    session,
    8,
    async (path, options) => {
      calls.push({ path, ...options })
      if (options.method === 'POST')
        return { summary: { curriculum_id: 42, updated_at: initial.summary.updated_at } }
      if (path.endsWith('/steps')) return { updated_at: '2026-11-06T00:00:00.123456Z' }
    },
    (next) => progress.push(next),
  )
  assert.deepEqual(
    calls.map(({ path }) => path),
    ['/curriculums', '/curriculums/42/steps', '/curriculums/42/thumbnail'],
  )
  assert.equal(calls[2].method, 'PUT')
  assert.equal(calls[2].actorId, 8)
  assert.equal(calls[2].body.get('file'), thumbnailFile)
  assert.equal(progress[1].thumbnailFile, thumbnailFile)
  assert.equal(saved.thumbnailFile, null)
  assert.equal(seriesDirty(saved), false)
})

test('썸네일 실패 후 생성 ID·단계·파일을 유지하고 이미지만 다시 전송한다', async () => {
  const file = new File(['image'], 'series.png', { type: 'image/png' })
  let session = {
    ...initialSeries(),
    fields: { name: '새 시리즈', description: '', order: [1] },
    thumbnailFile: file,
  }
  await assert.rejects(
    saveSeries(
      session,
      1,
      async (path, options) => {
        if (options.method === 'POST')
          return { summary: { curriculum_id: 42, updated_at: initial.summary.updated_at } }
        if (path.endsWith('/steps')) return { updated_at: '2026-11-06T00:00:00.123456Z' }
        throw new Error('이미지 저장 실패')
      },
      (next) => {
        session = next
      },
    ),
    /이미지 저장 실패/,
  )
  assert.equal(session.savedId, 42)
  assert.equal(session.savedOrder, '[1]')
  assert.equal(session.pendingSteps, false)
  assert.equal(session.thumbnailFile, file)
  assert.equal(seriesDirty(session), true)
  const calls = []
  const saved = await saveSeries(
    session,
    1,
    async (path, options) => {
      calls.push({ path, ...options })
    },
    () => {},
  )
  assert.equal(calls.length, 1)
  assert.equal(calls[0].path, '/curriculums/42/thumbnail')
  assert.equal(calls[0].body.get('file'), file)
  assert.equal(seriesDirty(saved), false)
})

test('단계 저장 실패 시 이미지를 전송하지 않고 선택 파일을 보존한다', async () => {
  const file = new File(['image'], 'series.png', { type: 'image/png' })
  let session = {
    ...initialSeries(initial),
    fields: { ...initialSeries(initial).fields, order: [2, 1] },
    thumbnailFile: file,
  }
  const calls = []
  await assert.rejects(
    saveSeries(
      session,
      1,
      async (path) => {
        calls.push(path)
        throw new Error('단계 실패')
      },
      (next) => {
        session = next
      },
    ),
    /단계 실패/,
  )
  assert.deepEqual(calls, ['/curriculums/7/steps'])
  assert.equal(session.thumbnailFile, file)
  assert.equal(seriesDirty(session), true)
})

test('기존 시리즈에서 이미지 선택만으로 미저장이 되며 선택 취소는 서버 이미지를 삭제하지 않는다', async () => {
  const original = initialSeries(initial)
  const selected = {
    ...original,
    thumbnailFile: new File(['image'], 'series.webp', { type: 'image/webp' }),
  }
  assert.equal(seriesDirty(selected), true)
  const calls = []
  const saved = await saveSeries(
    selected,
    1,
    async (path, options) => {
      calls.push({ path, ...options })
    },
    () => {},
  )
  assert.deepEqual(
    calls.map(({ path, method }) => [path, method]),
    [['/curriculums/7/thumbnail', 'PUT']],
  )
  assert.equal(seriesDirty(saved), false)
  const cancelled = { ...selected, thumbnailFile: null }
  assert.equal(seriesDirty(cancelled), false)
  await saveSeries(
    cancelled,
    1,
    async () => assert.fail('선택 취소만으로 서버 요청하면 안 됨'),
    () => {},
  )
})

test('잘못된 썸네일은 시리즈 생성 전에 거부한다', async () => {
  const session = {
    ...initialSeries(),
    fields: { name: '새 시리즈', description: '', order: [] },
    thumbnailFile: new File(['image'], 'series.gif', { type: 'image/gif' }),
  }
  await assert.rejects(
    saveSeries(
      session,
      1,
      async () => assert.fail('잘못된 이미지로 시리즈를 생성하면 안 됨'),
      () => {},
    ),
    /JPEG, PNG, WebP/,
  )
})
