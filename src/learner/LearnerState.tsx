import type { ReactNode } from 'react'
import { StateBlock } from './ui'
import { ErrorFeedback } from '../shared/ErrorFeedback'

export function LearnerState({
  title,
  text,
  action,
  error,
  variant,
}: {
  title: string
  text?: string
  action?: ReactNode
  error?: unknown
  variant?: 'screen' | 'toast'
}) {
  if (error != null || variant != null)
    return (
      <ErrorFeedback
        title={title}
        text={text}
        action={action}
        error={error}
        variant={variant ?? 'screen'}
      />
    )
  return <StateBlock title={title} text={text} action={action} />
}
