import type { ReactNode } from 'react'
import { StateBlock } from '../../shared/ui'
import { learnerErrorMessage } from './state'

export function LearnerState({
  title,
  text,
  action,
  error,
}: {
  title: string
  text?: string
  action?: ReactNode
  error?: unknown
}) {
  return (
    <div role={error ? 'alert' : undefined}>
      <StateBlock title={title} text={error ? learnerErrorMessage(error) : text} action={action} />
      {error instanceof Error ? (
        <details className="sasu-error-detail">
          <summary>오류 상세 정보</summary>
          <p>{error.message}</p>
          {'code' in error ? <p>오류 코드: {String(error.code)}</p> : null}
        </details>
      ) : null}
    </div>
  )
}
