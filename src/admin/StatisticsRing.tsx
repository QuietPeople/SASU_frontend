import type { CSSProperties } from 'react'
import type { Rate } from '../api/admin'

export function StatisticsRing({
  rate,
  label,
  tone = 'blue',
  compact = false,
}: {
  rate: Rate
  label: string
  tone?: 'blue' | 'gold' | 'orange'
  compact?: boolean
}) {
  const percent = rate.percent
  const filled = Math.max(0, Math.min(100, percent ?? 0))
  return (
    <div
      className={`admin-stats__ring admin-stats__ring--${tone}${compact ? ' admin-stats__ring--compact' : ''}`}
      role="img"
      aria-label={`${label}: ${percent === null ? '기록 없음' : `${percent.toLocaleString('ko-KR')}%`}`}
      style={{ '--ring-offset': 100 - filled } as CSSProperties}
    >
      <svg viewBox="0 0 100 100" fill="none" aria-hidden="true">
        <circle className="admin-stats__ring-track" cx="50" cy="50" r="43" strokeWidth="7" />
        {filled > 0 && (
          <circle
            key={percent}
            className="admin-stats__ring-value"
            cx="50"
            cy="50"
            r="43"
            strokeWidth="7"
            strokeLinecap="round"
            pathLength="100"
            strokeDasharray="100 100"
            strokeDashoffset={100 - filled}
            transform="rotate(-90 50 50)"
          />
        )}
      </svg>
      <div className="admin-stats__ring-center" aria-hidden="true">
        <strong>{percent === null ? '—' : percent.toLocaleString('ko-KR')}</strong>
        <span>{percent === null ? '기록 없음' : '%'}</span>
      </div>
    </div>
  )
}
