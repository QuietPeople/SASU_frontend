import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { test } from 'node:test'
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
let SeriesPage, SessionContext
try {
  ;({ SeriesPage } = await import('../src/pages/learner/SeriesPage.tsx'))
  ;({ SessionContext } = await import('../src/state/session.ts'))
} finally {
  hooks.deregister()
}

const session = {
  actorId: 2,
  learnerId: 2,
  generation: 1,
  isPending: false,
  error: null,
}
const summary = {
  curriculum_id: 7,
  title: '엑셀 실무',
  description: '함수와 피벗 테이블을 배워요.',
  thumbnail_url: null,
  total_steps: 1,
  available_steps: 1,
  completed_steps: 0,
  progress_percent: 0,
}
const step = {
  curriculum_content_id: 70,
  content_id: 17,
  step_order: 1,
  watch_completed: false,
  question_correct: false,
  completed: false,
  available: true,
  content: {
    title: 'VLOOKUP 배우기',
    thumbnail_url: null,
    category: { name: '문서·OA' },
    has_quiz: true,
  },
}

function renderPage(
  path,
  { items = [summary], steps = [step], detailSummary = summary, withDetail = true } = {},
) {
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity, staleTime: Infinity } },
  })
  const query = new URL(path, 'http://local').searchParams
  const page = Number(query.get('page') ?? 1)
  cache.setQueryData(['learner', 'curriculums', 2, 2, 1, (query.get('q') ?? '').trim(), page, 5], {
    items,
    total: items.length,
    page,
    size: 5,
    has_next: false,
  })
  if (withDetail)
    cache.setQueryData(['learner', 'curriculum', 2, 2, 1, 7], { summary: detailSummary, steps })
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
                path: '/learner/series/:id?',
                element: createElement(SeriesPage),
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
        .map((query) => query.queryKey),
    }
  } finally {
    cache.clear()
  }
}

test('시리즈 목록에 들어가면 첫 상세를 자동 조회하거나 펼치지 않는다', () => {
  const { html, keys } = renderPage('/learner/series', { withDetail: false })
  assert.match(html, /엑셀 실무 학습 내용 보기/)
  assert.match(html, /aria-haspopup="dialog"/)
  assert.ok(!html.includes('<dialog'))
  assert.ok(!keys.some((key) => key[1] === 'curriculum'))
})

test('목록 검색 결과에 없는 시리즈도 직접 링크로 상세 창을 열 수 있다', () => {
  const { html } = renderPage('/learner/series/7?q=검색&page=2', { items: [] })
  const dialog = html.slice(html.indexOf('<dialog'))
  assert.match(dialog, /class="learner-series-dialog"/)
  assert.match(dialog, /시리즈 학습 내용 닫기/)
  assert.match(dialog, /VLOOKUP 배우기/)
  assert.match(dialog, /시리즈 학습 진행률/)
  assert.match(dialog, /학습 시작하기/)
  assert.ok(!dialog.includes('<table'))
})

test('이용 불가 영상은 단계에 남기되 학습 실행을 막는다', () => {
  const { html } = renderPage('/learner/series/7', {
    steps: [{ ...step, available: false, content: null }],
    detailSummary: { ...summary, available_steps: 0 },
  })
  assert.match(html, /이용할 수 없는 영상/)
  assert.match(html, /이용 불가/)
  assert.match(html, /<button[^>]*disabled=""[^>]*>영상 보기<\/button>/)
  assert.ok(!html.includes('학습 시작하기'))
  assert.match(html, /현재 학습할 수 있는 영상이 없어요/)
})

test('시청과 정답 기록을 구분하고 전체 완료 시 다시 학습하기를 제공한다', () => {
  const { html } = renderPage('/learner/series/7', {
    steps: [{ ...step, watch_completed: true, question_correct: true, completed: true }],
    detailSummary: { ...summary, completed_steps: 1, progress_percent: 100 },
  })
  assert.match(html, /시청 완료/)
  assert.match(html, /퀴즈 정답/)
  assert.match(html, /다시 학습하기/)
  assert.match(html, /<progress[^>]*value="100"/)
})

test('잘못된 시리즈 주소도 닫을 수 있는 안내 창을 제공한다', () => {
  const { html } = renderPage('/learner/series/invalid')
  assert.match(html, /올바른 시리즈를 선택해 주세요/)
  assert.match(html, /시리즈 학습 내용 닫기/)
  assert.ok(!html.includes('VLOOKUP 배우기'))
})
