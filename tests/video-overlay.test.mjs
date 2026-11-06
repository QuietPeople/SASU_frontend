import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
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
let BufferedVideo, SwipeContext, VideoLoading, learningKey
try {
  ;({ BufferedVideo } = await import('../src/features/content-viewer/BufferedVideo.tsx'))
  ;({ SwipeContext } = await import('../src/features/content-viewer/swipeContext.ts'))
  ;({ VideoLoading } = await import('../src/features/content-viewer/VideoLoading.tsx'))
  ;({ learningKey } = await import('../src/api/learning.ts'))
} finally {
  hooks.deregister()
}

const identity = { actorId: 2, learnerId: 2, generation: 1 }
const content = {
  content_id: 22,
  title: '엑셀 조건부 서식',
  category: { category_id: 1, name: '엑셀' },
  tags: [{ tag_id: 1, name: '표 관리' }],
  video_url: '/api/contents/22/video',
  media_revision: 'revision-22',
  video_duration: 30,
  thumbnail_url: null,
  view_count: 12,
  like_count: 7,
  liked: true,
  saved: true,
  watch_completed: true,
  status: 'PUBLISHED',
  has_quiz: true,
}

function renderSlide({ active, cached = false, panelOpen = false }) {
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  if (cached) cache.setQueryData(learningKey(identity, 'content', 22), { content })
  try {
    return renderToStaticMarkup(
      createElement(
        QueryClientProvider,
        { client: cache },
        createElement(
          SwipeContext,
          { value: { materialPanel: { open: panelOpen, tab: 'core' } } },
          createElement(
            BufferedVideo,
            {
              identity,
              contentId: 22,
              content,
              active,
              overlay: { recommendationLabel: '관심 분야 영상' },
              mediaHost: createElement(
                'div',
                { className: 'swipe-viewport__media' },
                active && !cached ? createElement(VideoLoading) : null,
              ),
            },
            createElement('span', null, '활성 영상 학습 처리'),
          ),
        ),
      ),
    )
  } finally {
    cache.clear()
  }
}

function assertOverlay(html) {
  assert.match(html, /<video[^>]+src="\/api\/contents\/22\/video"/)
  for (const text of ['엑셀 조건부 서식', '#표 관리', '조회수 12', '시청 완료', '관심 분야 영상'])
    assert.ok(html.includes(text), `${text} 정보가 영상과 함께 표시되어야 함`)
  for (const label of ['좋아요', '보관함에 저장됨', '학습자료'])
    assert.ok(html.includes(`aria-label="${label}`), `${label} 버튼이 먼저 표시되어야 함`)
  assert.match(html, /class="media-slider-track"/)
  assert.match(html, /class="swipe-preview__overlay" inert="" aria-hidden="true"/)
  assert.ok(!html.includes('활성 영상 학습 처리'), '미리보기만으로 학습 처리를 실행하지 않음')
}

test('상세 조회와 재생 준비 전에도 다음 영상의 정보·버튼·재생바를 함께 렌더링한다', () => {
  assertOverlay(renderSlide({ active: false }))
})

test('사전 조회가 끝난 영상도 동일한 배치와 열린 학습자료 상태를 유지한다', () => {
  const html = renderSlide({ active: false, cached: true, panelOpen: true })
  assertOverlay(html)
  assert.match(html, /aria-expanded="true" aria-label="학습자료 접기"/)
})

test('현재 영상으로 바뀌어 상세 정보를 기다려도 정보·버튼은 남고 로딩 표시만 겹친다', () => {
  const html = renderSlide({ active: true })
  assertOverlay(html)
  assert.match(html, /class="swipe-viewport__media"><div class="content-viewer__video-loading"/)
})
