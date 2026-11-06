import type { ReactNode } from 'react'
import { ApiError } from '../api/client'
import { learnerErrorMessage } from '../features/learner-navigation/state'
import { Notification } from './Notification'
import './feedback.css'

export function FailureIllustration({ label = '화면을 불러오지 못했어요' }: { label?: string }) {
  return (
    <div className="sasu-failure">
      <svg viewBox="0 0 240 200" role="img" aria-label={label}>
        <ellipse cx="120" cy="175" rx="68" ry="9" fill="#e8edf7" />
        <circle cx="120" cy="94" r="72" fill="#f1f5ff" />
        <path
          d="M55 56h-9m4-5v10m140 63h-9m4-5v10"
          stroke="#bacbef"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <g transform="rotate(-7 120 104)">
          <path
            d="M83 36h62l27 29v82a18 18 0 0 1-18 18H83a18 18 0 0 1-18-18V54a18 18 0 0 1 18-18Z"
            fill="white"
            stroke="#9bb7ea"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path d="M145 37v20a9 9 0 0 0 9 9h17" fill="#e6efff" stroke="#9bb7ea" strokeWidth="3" />
          <path
            d="m90 94 9 4m-9 4 9-4m39-4-9 4m9 4-9-4"
            stroke="#536b99"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <ellipse cx="88" cy="112" rx="7" ry="4" fill="#ffdfda" />
          <ellipse cx="140" cy="112" rx="7" ry="4" fill="#ffdfda" />
          <path
            d="M106 121q8-7 16 0"
            fill="none"
            stroke="#536b99"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="m82 161-7 10m69-10 7 10"
            stroke="#9bb7ea"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </g>
        <path
          d="M180 44q12-5 11-14c-1-7-13-7-14 0m5 22h.1"
          fill="none"
          stroke="#9bb7ea"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
    </div>
  )
}

export function ErrorFeedback({
  title,
  text,
  error,
  action,
  variant = 'toast',
}: {
  title: string
  text?: string
  error?: unknown
  action?: ReactNode
  variant?: 'toast' | 'screen'
}) {
  const message = text ?? (error ? learnerErrorMessage(error) : undefined)
  return (
    <>
      {variant === 'screen' && <FailureIllustration label={title} />}
      <Notification
        kind={variant === 'screen' ? 'snackbar' : 'toast'}
        title={title}
        message={message}
        event={error}
        action={
          action ??
          (variant === 'screen' ? (
            <button type="button" onClick={() => window.location.reload()}>
              새로고침
            </button>
          ) : undefined)
        }
        details={
          error instanceof Error ? (
            <>
              <p>{error.message}</p>
              {error instanceof ApiError && (
                <p>
                  {error.status ? `HTTP ${error.status} · ` : ''}
                  {error.code}
                </p>
              )}
              {error instanceof ApiError && error.fields != null && (
                <pre>{JSON.stringify(error.fields, null, 2)}</pre>
              )}
            </>
          ) : undefined
        }
      />
    </>
  )
}
