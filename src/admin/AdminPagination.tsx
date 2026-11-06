import { pageNumbers } from './pagination'
import { Icon } from './Icon'
import './pagination.css'

export function AdminPagination({
  page,
  size,
  total,
  hasNext,
  disabled = false,
  compact = false,
  label,
  onChange,
}: {
  page: number
  size: number
  total: number
  hasNext: boolean
  disabled?: boolean
  compact?: boolean
  label: string
  onChange: (page: number) => void
}) {
  const pages = Math.max(1, Math.ceil(total / size))
  const first = total > 0 && page <= pages ? (page - 1) * size + 1 : 0
  const last = first ? Math.min(page * size, total) : 0
  return (
    <footer className={`admin-page-controls${compact ? ' admin-page-controls--compact' : ''}`}>
      <p>
        총 <strong>{total.toLocaleString('ko-KR')}</strong>개 중{' '}
        <strong>
          {first.toLocaleString('ko-KR')}–{last.toLocaleString('ko-KR')}
        </strong>
      </p>
      <nav aria-label={label}>
        <button
          type="button"
          aria-label="이전 페이지"
          disabled={disabled || page <= 1}
          onClick={() => onChange(page - 1)}
        >
          <Icon name="chevronLeft" size={17} />
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
            <span key={number} aria-hidden="true">
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
          <Icon name="chevronRight" size={17} />
        </button>
      </nav>
    </footer>
  )
}
