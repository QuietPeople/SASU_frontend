import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { ApiError } from '../api/client'
import { Icon } from './Icon'
import './request-feedback.css'

const FeedbackContext = createContext<{
  host: HTMLDivElement | null
  notify: () => void
} | null>(null)

export function RequestFeedback({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<HTMLDivElement | null>(null)
  const [notice, setNotice] = useState<number | null>(null)
  const sequence = useRef(0)
  const popup = useRef<HTMLDivElement>(null)
  const notify = useCallback(() => setNotice(++sequence.current), [])
  useEffect(() => {
    if (notice === null) return
    popup.current?.showPopover()
    const timer = window.setTimeout(() => setNotice(null), 4000)
    return () => window.clearTimeout(timer)
  }, [notice])
  return (
    <FeedbackContext.Provider value={{ host, notify }}>
      {children}
      <div ref={setHost} className="admin-request-errors" aria-label="요청 오류 상세" />
      {notice !== null && (
        <div ref={popup} popover="manual" className="admin-request-toast" role="alert">
          <span className="admin-request-toast__mark" aria-hidden="true">
            !
          </span>
          <div>
            <strong>요청을 완료하지 못했어요</strong>
            <span>화면 아래에서 자세한 내용을 확인해 주세요.</span>
          </div>
          <button type="button" aria-label="오류 알림 닫기" onClick={() => setNotice(null)}>
            <Icon name="close" size={16} />
          </button>
        </div>
      )}
    </FeedbackContext.Provider>
  )
}

export function RequestError({
  title,
  text,
  error,
  action,
}: {
  title: string
  text?: string
  error?: unknown
  action?: ReactNode
}) {
  const context = useContext(FeedbackContext)
  const notify = context?.notify
  const message = text ?? (error instanceof Error ? error.message : undefined)
  const code = error instanceof ApiError ? error.code : undefined
  const status = error instanceof ApiError ? error.status : undefined
  const fields =
    error instanceof ApiError && error.fields != null
      ? JSON.stringify(error.fields, null, 2)
      : undefined
  useEffect(() => {
    notify?.()
  }, [notify, title, message, code, status, error])
  const details = (
    <details className="admin-request-error">
      <summary>
        <span className="admin-request-error__dot" aria-hidden="true" />
        <span>요청 오류</span>
        <span className="admin-request-error__title">{title}</span>
        <Icon name="chevronDown" size={14} />
      </summary>
      <div className="admin-request-error__details">
        <strong>{title}</strong>
        {message && <p>{message}</p>}
        {code && (
          <p className="admin-request-error__code">
            {status ? `HTTP ${status} · ` : ''}
            {code}
          </p>
        )}
        {fields && <pre className="admin-request-error__fields">{fields}</pre>}
        {action && <div className="admin-request-error__action">{action}</div>}
      </div>
    </details>
  )
  return context?.host ? createPortal(details, context.host) : context ? null : details
}
