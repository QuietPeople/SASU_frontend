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
  updated_at: '2026-11-05T00:00:00.123456Z',
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
  const log = {
    saved: [],
    tags: [],
    baselines: [],
    stages: [],
    warnings: [],
    cleared: 0,
    thumbnailCleared: 0,
  }
  const effects = {
    cache,
    upload: async () => assert.fail('영상 업로드를 호출하면 안 됨'),
    onStage: (value) => log.stages.push(value),
    onTags: (value) => log.tags.push(value),
    onSaved: (value) => log.saved.push(value),
    onBaseline: (value) => log.baselines.push(value),
    onVideoSaved: () => log.cleared++,
    onThumbnailSaved: () => log.thumbnailCleared++,
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
    if (url === '/api/contents') {
      assert.deepEqual(JSON.parse(options.body).tag_ids, [5])
      assert.equal('expected_updated_at' in JSON.parse(options.body), false)
    }
    calls.push(url)
    return Response.json(body)
  }
  effects.upload = async (options) => {
    assert.equal(options.contentId, 7)
    assert.equal(options.file, video)
    assert.equal(options.generateThumbnail, true)
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
    assert.equal(JSON.parse(options.body).expected_updated_at, content().updated_at)
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

test('편집 충돌 시 입력 기준 버전을 유지하고 영상·공개 요청을 진행하지 않는다', async () => {
  const { effects, log } = setup()
  const original = content('old')
  let count = 0
  globalThis.fetch = async (_, options) => {
    count++
    assert.equal(JSON.parse(options.body).expected_updated_at, original.updated_at)
    return Response.json(
      { detail: { code: 'EDIT_CONFLICT', message: '수정 시각 불일치' } },
      { status: 409 },
    )
  }
  await assert.rejects(
    persistContent({ ...input, saved: original, publish: true, file: video }, effects),
    (error) => error.cause.code === 'EDIT_CONFLICT',
  )
  assert.equal(count, 1)
  assert.equal(log.saved.length, 0)
  assert.equal(log.cleared, 0)
  assert.equal(original.updated_at, content().updated_at)
})

const thumbnail = new File(['image'], 'cover.png', { type: 'image/png' })
const withThumbnail = (value, url = '/api/contents/7/thumbnail') => ({
  ...value,
  detail: { ...value.detail, content: { ...value.detail.content, thumbnail_url: url } },
})

test('직접 이미지가 없으면 자동 생성을 요청하고 조회한 썸네일을 편집 상태와 캐시에 반영한다', async () => {
  const { effects, log, cache } = setup()
  globalThis.fetch = async (url) => {
    if (url.endsWith('?view=editor')) return Response.json(withThumbnail(content('new')))
    assert.equal(url, '/api/contents')
    return Response.json(content())
  }
  effects.upload = async (options) => {
    assert.equal(options.generateThumbnail, true)
    return { content_id: 7, media_revision: 'new' }
  }
  const result = await persistContent({ ...input, file: video, thumbnailFile: null }, effects)
  assert.equal(result.detail.content.thumbnail_url, '/api/contents/7/thumbnail')
  assert.equal(log.saved.at(-1).detail.content.thumbnail_url, result.detail.content.thumbnail_url)
  assert.deepEqual(cache.getQueryData(cacheKey), result)
  assert.equal(log.thumbnailCleared, 0)
})

test('영상 교체와 썸네일 삭제를 함께 저장하면 자동 생성을 끄고 삭제 의도를 유지한다', async () => {
  const { effects } = setup()
  let deleted = false
  globalThis.fetch = async (url, options) => {
    if (url.endsWith('/thumbnail')) {
      assert.equal(options.method, 'DELETE')
      deleted = true
      return new Response(null, { status: 204 })
    }
    return Response.json(withThumbnail(content('new'), deleted ? null : '/old.png'))
  }
  effects.upload = async (options) => {
    assert.equal(options.generateThumbnail, false)
    return { content_id: 7, media_revision: 'new' }
  }
  const result = await persistContent(
    { ...input, saved: withThumbnail(content('old')), file: video, removeThumbnail: true },
    effects,
  )
  assert.equal(deleted, true)
  assert.equal(result.detail.content.thumbnail_url, null)
})

test('미리 선택한 썸네일은 콘텐츠 생성·영상 저장 뒤 발급된 ID로 업로드하고 마지막에 공개한다', async () => {
  const { effects, log, cache } = setup()
  const calls = []
  let thumbnailSaved = false
  globalThis.fetch = async (url, options) => {
    calls.push(`${options.method} ${url}`)
    if (url.endsWith('/thumbnail')) {
      assert.equal(options.method, 'PUT')
      assert.equal(options.body.get('file'), thumbnail)
      thumbnailSaved = true
      return new Response(null, { status: 204 })
    }
    if (url.endsWith('/publish')) {
      assert.equal(thumbnailSaved, true)
      return Response.json(withThumbnail(content('new', 'PUBLISHED')))
    }
    if (url.endsWith('?view=editor'))
      return Response.json(thumbnailSaved ? withThumbnail(content('new')) : content('new'))
    assert.equal(url, '/api/contents')
    assert.equal(options.method, 'POST')
    return Response.json(content())
  }
  effects.upload = async (options) => {
    assert.equal(options.contentId, 7)
    assert.equal(options.file, video)
    calls.push('video upload')
    assert.equal(options.generateThumbnail, false)
    return { content_id: 7, media_revision: 'new' }
  }
  const result = await persistContent(
    { ...input, publish: true, file: video, thumbnailFile: thumbnail },
    effects,
  )
  assert.deepEqual(calls, [
    'POST /api/contents',
    'video upload',
    'GET /api/contents/7?view=editor',
    'PUT /api/contents/7/thumbnail',
    'GET /api/contents/7?view=editor',
    'POST /api/contents/7/publish',
  ])
  assert.deepEqual(log.stages, ['tags', 'metadata', 'video', 'thumbnail', 'publish'])
  assert.equal(log.cleared, 1)
  assert.equal(log.thumbnailCleared, 1)
  assert.equal(result.detail.content.thumbnail_url, '/api/contents/7/thumbnail')
  assert.deepEqual(cache.getQueryData(cacheKey), result)
})

test('썸네일 실패 후 파일 선택은 유지하고 재시도할 때 이미 저장한 영상은 다시 올리지 않는다', async () => {
  const { effects, log } = setup()
  let failThumbnail = true
  let uploads = 0
  let published = 0
  let thumbnailUploads = 0
  globalThis.fetch = async (url, options) => {
    if (url.endsWith('/thumbnail')) {
      thumbnailUploads++
      assert.equal(options.body.get('file'), thumbnail)
      return failThumbnail ? failure() : new Response(null, { status: 204 })
    }
    if (url.endsWith('/publish')) published++
    return Response.json(failThumbnail ? content('new') : withThumbnail(content('new')))
  }
  effects.upload = async () => {
    uploads++
    return { content_id: 7, media_revision: 'new' }
  }
  await assert.rejects(
    persistContent({ ...input, publish: true, file: video, thumbnailFile: thumbnail }, effects),
    /썸네일 변경에 실패.*선택한 변경사항은 유지/,
  )
  assert.equal(log.cleared, 1)
  assert.equal(log.thumbnailCleared, 0)
  assert.equal(published, 0)
  failThumbnail = false
  await persistContent({ ...input, thumbnailFile: thumbnail, saved: log.saved.at(-1) }, effects)
  assert.equal(uploads, 1)
  assert.equal(thumbnailUploads, 2)
  assert.equal(log.thumbnailCleared, 1)
})

test('영상 저장 결과가 불확실한 동안 썸네일 업로드와 공개를 실행하지 않는다', async () => {
  const { effects, log } = setup()
  globalThis.fetch = async (url) => {
    assert.equal(url, '/api/contents')
    return Response.json(content())
  }
  const interrupted = new UploadNeedsReviewError(new DOMException('중단', 'AbortError'))
  effects.upload = async () => {
    throw interrupted
  }
  await assert.rejects(
    persistContent({ ...input, publish: true, file: video, thumbnailFile: thumbnail }, effects),
    (error) => error === interrupted,
  )
  assert.equal(log.cleared, 0)
  assert.equal(log.thumbnailCleared, 0)
})

test('썸네일 삭제도 콘텐츠 저장 단계에서 실행하고 삭제 결과를 캐시에 반영한다', async () => {
  const { effects, log, cache } = setup()
  const calls = []
  globalThis.fetch = async (url, options) => {
    calls.push(`${options.method} ${url}`)
    if (url.endsWith('/thumbnail')) return new Response(null, { status: 204 })
    return Response.json(
      withThumbnail(content('old'), url.endsWith('?view=editor') ? null : '/old.png'),
    )
  }
  const result = await persistContent(
    { ...input, saved: withThumbnail(content('old')), removeThumbnail: true },
    effects,
  )
  assert.deepEqual(calls, [
    'PATCH /api/contents/7',
    'DELETE /api/contents/7/thumbnail',
    'GET /api/contents/7?view=editor',
  ])
  assert.equal(log.thumbnailCleared, 1)
  assert.equal(result.detail.content.thumbnail_url, null)
  assert.equal(cache.getQueryData(cacheKey).detail.content.thumbnail_url, null)
})

test('썸네일 저장 후 조회만 실패하면 성공한 변경을 다시 전송하지 않고 조회 안내를 제공한다', async () => {
  const { effects, log } = setup()
  globalThis.fetch = async (url) => {
    if (url.endsWith('/thumbnail')) return new Response(null, { status: 204 })
    if (url.endsWith('?view=editor')) return failure()
    return Response.json(content())
  }
  await persistContent({ ...input, thumbnailFile: thumbnail }, effects)
  assert.equal(log.thumbnailCleared, 1)
  assert.deepEqual(log.warnings, ['썸네일 변경은 저장됐어요. 최신 정보를 다시 불러와 주세요.'])
})

test('메타데이터 저장 실패 시 선택한 썸네일을 유지하며 업로드 단계에 도달하지 않는다', async () => {
  const { effects, log } = setup()
  globalThis.fetch = async (url) => {
    assert.equal(url, '/api/contents')
    return failure()
  }
  await assert.rejects(
    persistContent({ ...input, thumbnailFile: thumbnail }, effects),
    /테스트 오류/,
  )
  assert.equal(log.thumbnailCleared, 0)
  assert.deepEqual(log.stages, ['tags', 'metadata'])
})
