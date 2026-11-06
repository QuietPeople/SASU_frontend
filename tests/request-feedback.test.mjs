import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
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

let ErrorFeedback, Notification, Skeleton, LearnerState, ScreenLoading, RequestError
try {
  ;({ ErrorFeedback } = await import('../src/shared/ErrorFeedback.tsx'))
  ;({ Notification } = await import('../src/shared/Notification.tsx'))
  ;({ Skeleton } = await import('../src/shared/Skeleton.tsx'))
  ;({ LearnerState } = await import('../src/learner/LearnerState.tsx'))
  ;({ ScreenLoading } = await import('../src/app/RouteContent.tsx'))
  ;({ RequestError } = await import('../src/admin/RequestFeedback.tsx'))
} finally {
  hooks.deregister()
}
const render = (component, props) => renderToStaticMarkup(createElement(component, props))

test('화면 조회 실패는 본문의 그림과 지속형 재시도 스낵바로 구분한다', () => {
  const html = render(ErrorFeedback, {
    title: '목록을 불러오지 못했어요.',
    variant: 'screen',
    error: new Error('network disconnected'),
  })
  assert.match(html, /class="sasu-failure"/)
  assert.match(html, /role="img" aria-label="목록을 불러오지 못했어요."/)
  assert.match(html, /sasu-notification--snackbar/)
  assert.match(html, />새로고침<\/button>/)
  assert.doesNotMatch(html, /알림 닫기/)
  assert.match(html, /<details>.*오류 상세/s)
})
test('일반 요청 실패는 본문 오류 박스나 실패 그림 없이 토스트로 표시한다', () => {
  const html = render(RequestError, {
    title: '저장하지 못했어요.',
    error: new Error('temporary error'),
  })
  assert.match(html, /sasu-notification--toast/)
  assert.match(html, /role="alert"/)
  assert.doesNotMatch(html, /sasu-failure|admin-request-summary|sasu-empty/)
  assert.match(html, /알림 닫기/)
})
test('옮긴 재시도 버튼은 기존 콜백을 그대로 유지한다', () => {
  let retried = 0
  const action = createElement(
    'button',
    {
      onClick: () => {
        retried += 1
      },
    },
    '다시 시도',
  )
  const tree = ErrorFeedback({ title: '실패', variant: 'screen', action })
  const notice = tree.props.children.find((node) => node?.type === Notification)
  assert.equal(notice.props.action, action)
  notice.props.action.props.onClick()
  assert.equal(retried, 1)
  assert.equal(notice.props.kind, 'snackbar')
})
test('정상 빈 목록 안내는 오류 토스트로 바뀌지 않는다', () => {
  const html = render(LearnerState, { title: '저장한 영상이 없어요.' })
  assert.match(html, /sasu-empty/)
  assert.doesNotMatch(html, /sasu-notification|sasu-failure/)
})
test('학습자 요청 실패와 배경 갱신 실패도 관리자와 같은 오류 표시를 쓴다', () => {
  const props = { title: '조회 실패', error: new Error('failed') }
  assert.match(render(LearnerState, props), /sasu-notification--snackbar/)
  const toast = render(LearnerState, { ...props, variant: 'toast' })
  assert.match(toast, /sasu-notification--toast/)
  assert.doesNotMatch(toast, /sasu-failure/)
})
test('같은 제목과 설명은 알림에 중복해서 표시하지 않는다', () => {
  const html = render(Notification, { title: '실패했어요.', message: '실패했어요.' })
  assert.equal(html.split('실패했어요.').length - 1, 1)
})
test('스켈레톤은 로딩 상태를 알리고 장식 블록은 스크린리더에서 제외한다', () => {
  for (const variant of ['page', 'list', 'form', 'dashboard', 'cards', 'text', 'video']) {
    const html = render(Skeleton, { variant, label: '자료 조회 중' })
    assert.match(html, /role="status" aria-label="자료 조회 중" aria-busy="true"/)
    assert.match(html, /aria-hidden="true"/)
    assert.doesNotMatch(html, /spinner|loading-ring/)
  }
  assert.equal(
    (
      render(Skeleton, { variant: 'cards', count: 8 }).match(
        /sasu-skeleton__block sasu-skeleton__card/g,
      ) ?? []
    ).length,
    8,
  )
})
test('화면 지연 로딩도 회전 표시 대신 스켈레톤을 제공한다', () => {
  const html = render(ScreenLoading, { label: '화면 준비 중' })
  assert.match(html, /sasu-skeleton--page/)
  assert.doesNotMatch(html, /loading__ring|spinner/)
})
