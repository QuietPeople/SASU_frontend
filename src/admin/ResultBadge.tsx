import './result-badge.css'

const labels = { CORRECT: '정답', WRONG: '오답', SKIP: '건너뜀' } as const

export function ResultBadge({ result, label }: { result: keyof typeof labels; label?: string }) {
  return (
    <span className={`admin-result-badge admin-result-badge--${result.toLowerCase()}`}>
      {label ?? labels[result]}
    </span>
  )
}
