import type { ReactNode } from 'react'
import { ErrorFeedback } from '../../shared/ErrorFeedback'

export function VideoUnavailable({
  title,
  error,
  action,
}: {
  title: string
  error?: unknown
  action: ReactNode
}) {
  return (
    <div className="sasu-player content-viewer__unavailable">
      <ErrorFeedback variant="screen" title={title} error={error} action={action} />
    </div>
  )
}
