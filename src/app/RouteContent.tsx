import { ErrorFeedback } from '../shared/ErrorFeedback'
import { Skeleton } from '../shared/Skeleton'
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
        <div className="route-content-state">
          <ErrorFeedback
            variant="screen"
            title="화면을 불러오지 못했어요."
            text="연결 상태를 확인하고 새로고침해 주세요."
          />
        </div>
      )
    return this.props.children
  }
}

export function ScreenLoading({ label = '화면 불러오는 중' }: { label?: string }) {
  return (
    <div className="route-content-loading">
      <Skeleton variant="page" label={label} />
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
