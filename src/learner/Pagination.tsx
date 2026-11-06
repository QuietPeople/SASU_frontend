import { pageNumbers } from '../shared/pagination'
import './pagination.css'

export function Pagination({
  page,
  size,
  total,
  hasNext,
  disabled = false,
  label,
  onChange,
}: {
  page: number
  size: number
  total: number
  hasNext: boolean
  disabled?: boolean
  label: string
  onChange: (page: number) => void
}) {
  const pages = Math.max(1, Math.ceil(total / size))
  const first = total > 0 && page <= pages ? (page - 1) * size + 1 : 0
  const last = first ? Math.min(page * size, total) : 0
  return (
    <footer className="learner-pagination-footer">
      <p className="learner-pagination__range">
        총 <strong>{total.toLocaleString()}</strong>개 중{' '}
        <strong>
          {first.toLocaleString()}–{last.toLocaleString()}
        </strong>
      </p>
      <nav className="learner-pagination" aria-label={label}>
        <button
          type="button"
          aria-label="이전 페이지"
          disabled={disabled || page <= 1}
          onClick={() => onChange(page - 1)}
        >
          <Arrow backwards />
        </button>
        {pageNumbers(page, pages).map((number) =>
          typeof number === 'number' ? (
            <button
              type="button"
              key={number}
              aria-label={`${number}페이지`}
              aria-current={page === number ? 'page' : undefined}
              disabled={disabled}
              onClick={() => {
                if (number !== page) onChange(number)
              }}
            >
              {number}
            </button>
          ) : (
            <span key={number} className="learner-pagination__gap" aria-hidden="true">
              …
            </span>
          ),
        )}
        <button
          type="button"
          aria-label="다음 페이지"
          disabled={disabled || !hasNext}
          onClick={() => onChange(page + 1)}
        >
          <Arrow />
        </button>
      </nav>
    </footer>
  )
}

function Arrow({ backwards = false }: { backwards?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="17"
      height="17"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={backwards ? 'm14 6-6 6 6 6' : 'm10 6 6 6-6 6'} />
    </svg>
  )
}
