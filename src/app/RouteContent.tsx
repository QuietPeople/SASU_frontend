import { Component, Suspense, type ReactNode } from 'react'
import { useLocation } from 'react-router'
import './route-content.css'

class ScreenBoundary extends Component<
  { children: ReactNode; resetKey: string },
  { failed: boolean; resetKey: string }
> {
  state = { failed: false, resetKey: this.props.resetKey }

  static getDerivedStateFromProps(props: { resetKey: string }, state: { resetKey: string }) {
    return props.resetKey === state.resetKey ? null : { failed: false, resetKey: props.resetKey }
  }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (this.state.failed)
      return (
        <div className="route-content-state" role="alert">
          <p>화면을 불러오지 못했어요.</p>
          <p>연결 상태를 확인한 뒤 다시 불러와 주세요.</p>
          <button type="button" onClick={() => window.location.reload()}>
            화면 다시 불러오기
          </button>
        </div>
      )
    return this.props.children
  }
}

export function ScreenLoading({ label = '화면 불러오는 중' }: { label?: string }) {
  return (
    <div className="route-content-loading" role="status">
      <span className="route-content-loading__ring" aria-hidden="true" />
      <span className="route-content-loading__label">{label}</span>
    </div>
  )
}

export function RouteContent({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  return (
    <ScreenBoundary resetKey={pathname}>
      <Suspense fallback={<ScreenLoading />}>{children}</Suspense>
    </ScreenBoundary>
  )
}
