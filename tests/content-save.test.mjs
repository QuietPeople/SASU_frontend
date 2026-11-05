import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { afterEach, test } from 'node:test'
import { QueryClient } from '@tanstack/react-query'

const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier))
      return next(new URL(`${specifier}.ts`, context.parentURL).href, context)
    return next(specifier, context)
  },
})
const { persistContent } = await import('../src/admin/contentSave.ts')
const { UploadNeedsReviewError } = await import('../src/admin/uploadRecovery.ts')
hooks.deregister()

const originalFetch = globalThis.fetch
const clients = []
afterEach(() => {
  globalThis.fetch = originalFetch
  for (const cache of clients.splice(0)) cache.clear()
})

const input = {
  publish: false,
  actorId: 1,
  generation: 2,
  form: {
    title: '업무 기초',
    category: '3',
    core: '핵심 내용',
    source: '참고 자료',
    reviewed: '2026-10-25',
    caution: false,
    cautionText: '',
  },
  tags: [{ tag_id: 4, name: '업무' }],
  file: null,
}
const content = (revision = null, status = 'DRAFT') => ({
  detail: {
    content: { content_id: 7, title: '업무 기초', media_revision: revision, status },
  },
  missing_for_publish: revision ? [] : ['video'],
})
const cacheKey = ['admin', 1, 2, '/contents/7?view=editor']
const video = new File(['video'], 'sample.mp4', { type: 'video/mp4' })
const failure = () =>
  Response.json({ detail: { code: 'INTERNAL_ERROR', message: '테스트 오류' } }, { status: 500 })

function setup() {
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  clients.push(cache)
  const log = { saved: [], tags: [], baselines: [], stages: [], warnings: [], cleared: 0 }
  const effects = {
    cache,
    upload: async () => assert.fail('영상 업로드를 호출하면 안 됨'),
    onStage: (value) => log.stages.push(value),
    onTags: (value) => log.tags.push(value),
    onSaved: (value) => log.saved.push(value),
    onBaseline: (value) => log.baselines.push(value),
    onVideoSaved: () => log.cleared++,
    onWarning: (value) => log.warnings.push(value),
  }
  return { effects, log, cache }
}

test('새 콘텐츠는 태그·메타데이터·영상·공개 순서로 저장하고 생성된 ID를 사용한다', async () => {
  const { effects, log, cache } = setup()
  const calls = []
  const expected = [
    ['/api/tags', 'POST', { tag_id: 5, name: '신규' }],
    ['/api/contents', 'POST', content()],
    ['/api/contents/7?view=editor', 'GET', content('new')],
    ['/api/contents/7/publish', 'POST', content('new', 'PUBLISHED')],
  ]
  globalThis.fetch = async (url, options) => {
    const [path, method, body] = expected.shift()
    assert.equal(url, path)
    assert.equal(options.method, method)
    if (url === '/api/contents') assert.deepEqual(JSON.parse(options.body).tag_ids, [5])
    calls.push(url)
    return Response.json(body)
  }
  effects.upload = async (options) => {
    assert.equal(options.contentId, 7)
    assert.equal(options.file, video)
    calls.push('upload')
    return { content_id: 7, media_revision: 'new' }
  }
  const result = await persistContent(
    { ...input, publish: true, file: video, tags: [{ name: '신규' }] },
    effects,
  )
  assert.deepEqual(calls, [
    '/api/tags',
    '/api/contents',
    'upload',
    '/api/contents/7?view=editor',
    '/api/contents/7/publish',
  ])
  assert.deepEqual(log.stages, ['tags', 'metadata', 'video', 'publish'])
  assert.equal(log.cleared, 1)
  assert.equal(result.detail.content.status, 'PUBLISHED')
  assert.deepEqual(cache.getQueryData(cacheKey), result)
})

test('영상 없는 기존 콘텐츠 저장은 PATCH만 호출하고 현재 영상 정보를 유지한다', async () => {
  const { effects, log } = setup()
  globalThis.fetch = async (url, options) => {
    assert.equal(url, '/api/contents/7')
    assert.equal(options.method, 'PATCH')
    return Response.json(content('old'))
  }
  const result = await persistContent({ ...input, saved: content('old') }, effects)
  assert.equal(result.detail.content.media_revision, 'old')
  assert.deepEqual(log.stages, ['tags', 'metadata'])
  assert.equal(log.cleared, 0)
})

test('태그 생성 뒤 메타데이터 저장 실패 시 태그 목록만 갱신하고 후속 단계를 중단한다', async () => {
  const { effects, log, cache } = setup()
  const tagKey = ['admin', 1, 2, '/tags']
  cache.setQueryData(tagKey, { items: [] })
  globalThis.fetch = async (url) => {
    if (url === '/api/tags') return Response.json({ tag_id: 5, name: '신규' })
    assert.equal(url, '/api/contents')
    return failure()
  }
  await assert.rejects(
    persistContent({ ...input, publish: true, file: video, tags: [{ name: '신규' }] }, effects),
    /테스트 오류/,
  )
  assert.equal(log.saved.length, 0)
  assert.equal(log.baselines.length, 0)
  assert.equal(log.cleared, 0)
  assert.equal(cache.getQueryState(tagKey).isInvalidated, true)
})

test('영상 업로드 실패 시 저장된 메타데이터와 파일 선택을 유지하고 공개하지 않는다', async () => {
  const { effects, log, cache } = setup()
  globalThis.fetch = async (url) => {
    assert.equal(url, '/api/contents/7')
    return Response.json(content('old'))
  }
  effects.upload = async (options) => {
    assert.equal(options.expectedMediaRevision, 'old')
    throw new Error('업로드 실패')
  }
  await assert.rejects(
    persistContent({ ...input, publish: true, file: video, saved: content('old') }, effects),
    /콘텐츠 정보는 저장됐지만 영상 업로드에 실패/,
  )
  assert.equal(log.baselines.length, 1)
  assert.equal(log.cleared, 0)
  assert.deepEqual(cache.getQueryData(cacheKey), content('old'))
})

test('업로드 저장 결과 확인이 필요한 오류는 일반 오류로 바꾸지 않는다', async () => {
  const { effects, log } = setup()
  globalThis.fetch = async () => Response.json(content())
  const interrupted = new UploadNeedsReviewError(new DOMException('중단', 'AbortError'))
  effects.upload = async () => {
    throw interrupted
  }
  await assert.rejects(
    persistContent({ ...input, file: video }, effects),
    (error) => error === interrupted,
  )
  assert.equal(log.cleared, 0)
})

test('공개 실패 시 성공한 영상 저장 결과를 유지한다', async () => {
  const { effects, log, cache } = setup()
  globalThis.fetch = async (url) => {
    if (url.endsWith('/publish')) return failure()
    return Response.json(url.endsWith('?view=editor') ? content('new') : content())
  }
  effects.upload = async () => ({ content_id: 7, media_revision: 'new' })
  await assert.rejects(
    persistContent({ ...input, publish: true, file: video }, effects),
    /콘텐츠는 저장됐지만 공개에 실패/,
  )
  assert.equal(log.cleared, 1)
  assert.equal(cache.getQueryData(cacheKey).detail.content.media_revision, 'new')
  assert.equal(cache.getQueryData(cacheKey).detail.content.status, 'DRAFT')
})

test('영상 저장 후 최신 조회만 실패하면 업로드 성공을 유지하고 경고한다', async () => {
  const { effects, log } = setup()
  globalThis.fetch = async (url) =>
    url.endsWith('?view=editor') ? failure() : Response.json(content())
  effects.upload = async () => ({ content_id: 7, media_revision: 'new' })
  const result = await persistContent({ ...input, file: video }, effects)
  assert.equal(result.detail.content.media_revision, 'new')
  assert.deepEqual(result.missing_for_publish, [])
  assert.equal(log.cleared, 1)
  assert.deepEqual(log.warnings, ['영상은 저장됐어요. 최신 정보를 다시 불러와 주세요.'])
})
