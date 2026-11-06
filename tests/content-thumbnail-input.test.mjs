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
const { ContentFormPage } = await import('../src/pages/admin/ContentFormPage.tsx')
const { ContentThumbnailInput } = await import('../src/admin/ContentThumbnailInput.tsx')
const { ThumbnailEditor } = await import('../src/admin/ThumbnailEditor.tsx')
const { SessionContext } = await import('../src/state/session.ts')
after(() => hooks.deregister())

test('새 콘텐츠에서 ID가 없어도 썸네일 탭과 이미지 선택을 제공한다', () => {
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  try {
    const html = renderToStaticMarkup(
      createElement(
        QueryClientProvider,
        { client: cache },
        createElement(
          SessionContext,
          { value: { actorId: 1, generation: 0 } },
          createElement(
            MemoryRouter,
            { initialEntries: ['/admin/contents/new'] },
            createElement(
              Routes,
              null,
              createElement(Route, {
                path: '/admin/contents/new',
                element: createElement(ContentFormPage),
              }),
            ),
          ),
        ),
      ),
    )
    assert.match(html, /aria-label="영상과 썸네일 선택"/)
    assert.match(html, /role="region" aria-label="영상 파일"/)
    assert.match(html, /hidden="" role="region" aria-label="썸네일 이미지"/)
    const input = html.match(/<input[^>]*id="content-thumbnail"[^>]*>/)?.[0]
    assert.ok(input)
    assert.match(input, /type="file"/)
    assert.doesNotMatch(input, /disabled/)
    assert.doesNotMatch(html, /먼저 임시저장한 뒤 이미지를 등록|파일을 선택하면 바로 저장/)
  } finally {
    cache.clear()
  }
})

test('선택한 썸네일과 삭제 예약은 저장 전 대기 상태로 표시하고 취소할 수 있다', () => {
  const props = {
    file: null,
    remove: false,
    savedUrl: '/old.png',
    refreshKey: 0,
    disabled: false,
    uploading: false,
    onChange() {},
  }
  const file = new File(['image'], '선택한 이미지.png', { type: 'image/png' })
  const pending = renderToStaticMarkup(createElement(ContentThumbnailInput, { ...props, file }))
  assert.match(pending, /선택한 이미지.png/)
  assert.match(pending, /업로드 대기/)
  assert.match(pending, /선택 취소/)
  const deleting = renderToStaticMarkup(
    createElement(ContentThumbnailInput, { ...props, remove: true }),
  )
  assert.match(deleting, /썸네일 삭제 예정/)
  assert.match(deleting, /삭제 취소/)
  assert.match(deleting, /저장 전에는 기존 이미지가 유지/)
})

test('시리즈 생성 전에도 썸네일을 선택할 수 있고 선택 파일은 저장 대기로 표시한다', () => {
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  const render = (file) =>
    renderToStaticMarkup(
      createElement(
        QueryClientProvider,
        { client: cache },
        createElement(
          SessionContext,
          { value: { actorId: 1, generation: 0 } },
          createElement(ThumbnailEditor, {
            resource: 'curriculums',
            id: null,
            file,
            onChange() {},
          }),
        ),
      ),
    )
  try {
    const html = render(null)
    const input = html.match(/<input[^>]*type="file"[^>]*>/)?.[0]
    assert.ok(input)
    assert.doesNotMatch(input, /disabled/)
    assert.doesNotMatch(html, /먼저 저장하면|선택하면 바로 저장/)
    assert.match(html, /시리즈를 저장할 때 함께 반영/)
    const pending = render(new File(['image'], 'series.png', { type: 'image/png' }))
    assert.match(pending, /선택한 썸네일 미리보기/)
    assert.match(pending, /series.png · 업로드 대기/)
    assert.match(pending, /선택 취소/)
  } finally {
    cache.clear()
  }
})
