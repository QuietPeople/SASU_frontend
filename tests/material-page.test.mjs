import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { after, test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router'
import ts from 'typescript'

const sourceRoot = new URL('../src/', import.meta.url).href
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL?.startsWith(sourceRoot) && specifier.startsWith('.')) {
      const url = new URL(specifier, context.parentURL)
      for (const extension of ['.tsx', '.ts']) {
        if (existsSync(new URL(url.href + extension)))
          return nextResolve(url.href + extension, context)
      }
    }
    return nextResolve(specifier, context)
  },
  load(url, context, nextLoad) {
    if (url.endsWith('.css')) return { format: 'module', shortCircuit: true, source: 'export {}' }
    if (url.startsWith(sourceRoot) && /\.tsx?$/.test(url)) {
      return {
        format: 'module',
        shortCircuit: true,
        source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
          compilerOptions: {
            jsx: ts.JsxEmit.ReactJSX,
            module: ts.ModuleKind.ESNext,
            target: ts.ScriptTarget.ES2022,
          },
        }).outputText,
      }
    }
    return nextLoad(url, context)
  },
})
const { MaterialPage } = await import('../src/pages/admin/MaterialPage.tsx')
const { QuestionPreview } = await import('../src/admin/QuestionPreview.tsx')
const { ResponseDetail } = await import('../src/admin/ResponseDetail.tsx')
const { SessionContext } = await import('../src/state/session.ts')
const { adminContentListPath } = await import('../src/admin/navigation.ts')
after(() => hooks.deregister())

const session = { actorId: 1, learnerId: 2, generation: 0, isPending: false, error: null }
const category = { category_id: 7, name: '문서·OA' }
const content = {
  content_id: 42,
  title: '엑셀 함수 기초',
  thumbnail_url: null,
  category,
  tags: [{ tag_id: 3, name: '엑셀' }],
  status: 'PUBLISHED',
  has_quiz: true,
  video_url: '/video/42',
  media_revision: '1',
  video_duration: 30,
}
const question = {
  question_id: 90,
  question_version_id: 901,
  content_id: 42,
  question_type: 'OX',
  question_text: 'SUM은 합계를 구하는 함수인가요?',
  version_no: 2,
  explanation: 'SUM 함수는 지정한 범위의 합계를 계산해요.',
  is_current: true,
  created_at: '2026-11-06T00:00:00Z',
  options: [
    { option_id: 1, option_order: 1, option_text: 'O', is_correct: true },
    { option_id: 2, option_order: 2, option_text: 'X', is_correct: false },
  ],
}
const embedded = {
  contentId: 42,
  onClose() {},
  onOpenMaterials() {},
  onDirtyChange() {},
  onBusyChange() {},
}

function renderPage(
  path,
  {
    items = [content],
    total = items.length,
    editor = false,
    existing = question,
    target = content,
  } = {},
) {
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity, staleTime: Infinity } },
  })
  const params = new URL(path, 'http://local').searchParams
  const page = Number(params.get('page') ?? 1)
  const put = (path, value) => cache.setQueryData(['admin', 1, 0, path], value)
  if (editor) {
    put('/contents/42/question?view=editor', existing)
    if (existing) put('/questions/90/versions/901', existing)
  } else {
    put('/categories', { items: [category] })
    put(adminContentListPath(params, { size: 5 }), {
      items,
      total,
      page,
      size: 5,
      has_next: page * 5 < total,
    })
    if (target && /\/materials\/\d+/.test(path))
      put(`/contents/${target.content_id}?view=editor`, { detail: { content: target } })
  }
  try {
    const html = renderToStaticMarkup(
      createElement(
        QueryClientProvider,
        { client: cache },
        createElement(
          SessionContext,
          { value: session },
          createElement(
            MemoryRouter,
            { initialEntries: [path] },
            createElement(
              Routes,
              null,
              createElement(Route, {
                path: '/admin/materials/:id?',
                element: createElement(MaterialPage, editor ? { embedded } : {}),
              }),
            ),
          ),
        ),
      ),
    )
    return {
      html,
      keys: cache
        .getQueryCache()
        .getAll()
        .map((entry) => entry.queryKey),
    }
  } finally {
    cache.clear()
  }
}

test('학습자료 목록은 대상 선택 안내·현재 편집 문구나 인라인 편집 폼을 표시하지 않는다', () => {
  const { html, keys } = renderPage('/admin/materials')
  assert.match(html, /퀴즈·플래시카드/)
  assert.match(html, /엑셀 함수 기초 퀴즈 편집/)
  assert.match(html, /aria-haspopup="dialog"/)
  assert.doesNotMatch(html, /퀴즈를 작성할 콘텐츠를 선택|현재 편집|material-question|<dialog/)
  assert.ok(!keys.some((key) => typeof key[3] === 'string' && key[3].includes('/question')))
})

test('검색 조건을 유지하며 서버에서 5개씩 조회하고 범위와 페이지 번호를 표시한다', () => {
  const { html, keys } = renderPage(
    '/admin/materials?q=엑셀&category_id=7&status=DRAFT&missing=learning_material&page=2',
    { total: 12 },
  )
  const path = keys.map((key) => key[3]).find((path) => path?.startsWith('/contents?'))
  const query = new URL(path, 'http://local').searchParams
  for (const [key, value] of Object.entries({
    q: '엑셀',
    category_id: '7',
    status: 'DRAFT',
    missing: 'learning_material',
    page: '2',
    size: '5',
  }))
    assert.equal(query.get(key), value)
  assert.match(html, /총 <strong>12<\/strong>개 중 <strong>6–10<\/strong>/)
  assert.match(html, /aria-label="2페이지" aria-current="page"/)
  assert.match(html, /aria-label="3페이지"/)
  assert.doesNotMatch(html, /이전 대상 페이지|다음 대상 페이지|<select/)
})

test('퀴즈 등록 여부는 각 콘텐츠 제목 위에, 분야는 제목 아래에 표시한다', () => {
  const { html } = renderPage('/admin/materials', {
    items: [content, { ...content, content_id: 43, title: '피벗 테이블 기초', has_quiz: false }],
  })
  assert.match(
    html,
    /is-registered[^]*?퀴즈 등록[^]*?<h3>[^]*?엑셀 함수 기초[^]*?admin-target-picker__category[^]*?문서·OA/,
  )
  assert.match(html, /is-missing[^]*?퀴즈 미등록[^]*?<h3>[^]*?피벗 테이블 기초/)
  assert.match(html, /피벗 테이블 기초 퀴즈 작성/)
})

test('기존 학습자료 상세 주소로 들어가도 편집은 콘텐츠 서브창으로 열린다', () => {
  const { html } = renderPage('/admin/materials/42?q=엑셀&page=2', { total: 12 })
  assert.match(html, /<dialog[^]*?class="admin-content-dialog"/)
  assert.match(html, /id="content-dialog-title">엑셀 함수 기초/)
  assert.match(html, /서브 화면 닫기/)
  assert.doesNotMatch(html, /현재 편집|퀴즈를 작성할 콘텐츠를 선택/)
})

test('서브창은 선택한 퀴즈 버전·정답·해설·미리보기·이력을 유지하고 목록을 중복 표시하지 않는다', () => {
  const { html, keys } = renderPage('/admin/materials', { editor: true })
  assert.match(html, /material-question/)
  assert.match(html, /SUM은 합계를 구하는 함수인가요/)
  assert.match(html, /SUM 함수는 지정한 범위의 합계를 계산해요/)
  assert.match(html, /현재 문항 v2/)
  assert.match(html, /수정 이력/)
  assert.match(html, /학습자료 미리보기/)
  assert.match(html, /변경사항 저장/)
  assert.doesNotMatch(html, /admin-target-picker|현재 편집|<dialog/)
  assert.ok(!keys.some((key) => key[3]?.startsWith('/contents?')))
})

test('퀴즈가 없는 콘텐츠의 서브창은 빈 작성 폼으로 시작한다', () => {
  const { html } = renderPage('/admin/materials', { editor: true, existing: null })
  assert.match(html, /새 퀴즈/)
  assert.match(html, /id="material-question"[^]*?><\/textarea>/)
  assert.doesNotMatch(html, /수정 이력|SUM은/)
})

test('공유 미리보기는 확인 전 정답을 숨기고 확인 후 선택한 오답과 정답을 구별한다', () => {
  const props = {
    question: '합계를 구하는 함수는?',
    options: [
      { option_id: 0, option_order: 1, option_text: 'SUM' },
      { option_id: 1, option_order: 2, option_text: 'COUNT' },
    ],
    selectedOptionId: 1,
    onSelect() {},
  }
  const before = renderToStaticMarkup(createElement(QuestionPreview, props))
  assert.equal((before.match(/<button/g) ?? []).length, 2)
  assert.match(before, /aria-pressed="true"/)
  assert.doesNotMatch(before, /is-answer|is-wrong|admin-result-badge|disabled=""/)

  const after = renderToStaticMarkup(
    createElement(QuestionPreview, { ...props, correctOptionId: 0, disabled: true }),
  )
  assert.match(after, /is-answer[^]*?SUM[^]*?정답/)
  assert.match(after, /is-picked is-wrong[^]*?COUNT/)
  assert.equal((after.match(/disabled=""/g) ?? []).length, 2)
})

const response = {
  response_id: 17,
  user_id: 2,
  result: 'WRONG',
  selected_option_id: 92,
  correct_option_id: 91,
  correct_answer: '제출 당시 보기',
  explanation: '제출 당시 해설',
  question: {
    ...question,
    question_version_id: 900,
    question_text: '수정 전 문항',
    options: [
      { option_id: 92, option_order: 2, option_text: '제출 당시 보기' },
      { option_id: 91, option_order: 1, option_text: '제출 당시 보기' },
    ],
  },
}

test('응답 상세는 당시 문항을 읽기 전용으로 표시하고 보기 문구가 같아도 ID로 정답을 구별한다', () => {
  const html = renderToStaticMarkup(createElement(ResponseDetail, { response }))
  assert.match(html, /수정 전 문항/)
  assert.match(html, /제출 당시 해설/)
  assert.match(html, /버전 #900/)
  const choices = html.match(/<ol[^]*?<\/ol>/)?.[0] ?? ''
  assert.equal((choices.match(/is-answer/g) ?? []).length, 1)
  assert.equal((choices.match(/is-wrong/g) ?? []).length, 1)
  assert.ok(choices.indexOf('is-answer') < choices.indexOf('is-wrong'))
  assert.doesNotMatch(html, /<button|<input/)
})

test('건너뛴 응답에는 선택한 답이 없고 정답과 해설은 계속 확인할 수 있다', () => {
  const html = renderToStaticMarkup(
    createElement(ResponseDetail, {
      response: { ...response, result: 'SKIP', selected_option_id: null },
    }),
  )
  assert.match(html, /선택한 답 없음/)
  assert.match(html, /당시 정답/)
  assert.match(html, /제출 당시 해설/)
  assert.match(html, /is-answer/)
  assert.doesNotMatch(html, /is-picked|is-wrong|<button/)
})
