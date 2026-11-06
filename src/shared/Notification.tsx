import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useFeedbackHost } from './feedbackContext'
import { DisclosureSummary } from './DisclosureSummary'
import './feedback.css'

export function Notification({
  title,
  message,
  action,
  details,
  event,
  kind = 'toast',
  tone = 'error',
}: {
  title: string
  message?: string
  action?: ReactNode
  details?: ReactNode
  event?: unknown
  kind?: 'toast' | 'snackbar'
  tone?: 'ok' | 'error' | 'info'
}) {
  const host = useFeedbackHost(kind)
  const occurrence = useMemo(() => ({ title, message, event }), [title, message, event])
  const [dismissed, setDismissed] = useState<typeof occurrence | null>(null)
  const [paused, setPaused] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const card = useRef<HTMLDivElement>(null)
  const visible = kind === 'snackbar' || dismissed !== occurrence
  useEffect(() => {
    if (!visible || !host?.isConnected) return
    // 다이얼로그 전용 호스트도 사용하며, 이미 열린 알림의 포커스를 유지한다.
    if (typeof host.showPopover === 'function') {
      if (!host.matches(':popover-open')) host.showPopover()
    } else host.removeAttribute('popover')
  }, [host, visible, occurrence])
  useEffect(() => {
    if (!visible || kind === 'snackbar' || action || paused || expanded) return
    const timer = window.setTimeout(() => setDismissed(occurrence), tone === 'ok' ? 3500 : 8000)
    return () => window.clearTimeout(timer)
  }, [occurrence, visible, kind, tone, paused, expanded, action])
  if (!visible) return null
  const notice = (
    <div
      ref={card}
      data-interactive
      className={`sasu-notification sasu-notification--${kind} sasu-notification--${tone}${host ? '' : ' sasu-notification--standalone'}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => {
        if (!card.current?.contains(document.activeElement)) setPaused(false)
      }}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false)
      }}
    >
      <span className="sasu-notification__mark" aria-hidden="true">
        {tone === 'ok' ? '✓' : tone === 'info' ? 'i' : '!'}
      </span>
      <div className="sasu-notification__body">
        <div role={tone === 'error' ? 'alert' : 'status'} aria-atomic="true">
          <strong>{title}</strong>
          {message && message !== title && <p>{message}</p>}
        </div>
        {action && <div className="sasu-notification__actions">{action}</div>}
        {details && (
          <details onToggle={(event) => setExpanded(event.currentTarget.open)}>
            <DisclosureSummary>오류 상세</DisclosureSummary>
            <div className="sasu-notification__details">{details}</div>
          </details>
        )}
      </div>
      {kind === 'toast' && (
        <button
          type="button"
          className="sasu-notification__close"
          aria-label="알림 닫기"
          onClick={() => setDismissed(occurrence)}
        >
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="m6 6 12 12M18 6 6 18" />
          </svg>
        </button>
      )}
    </div>
  )
  return host ? createPortal(notice, host) : notice
}
