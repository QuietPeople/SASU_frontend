import { useId } from 'react'
import type { Category } from '../api/learner'

export function InterestCategoryPicker({
  categories,
  value,
  onToggle,
  disabled = false,
}: {
  categories: Category[]
  value: number[]
  onToggle: (id: number) => void
  disabled?: boolean
}) {
  const titleId = useId()
  return (
    <div className="learner-interests">
      <div className="learner-preferences__heading">
        <div>
          <h2 id={titleId}>관심 분야</h2>
          <p>관심 있는 분야를 여러 개 골라 주세요.</p>
        </div>
        <span className="learner-interests__count" role="status">
          <strong>{value.length}</strong>개 선택
        </span>
      </div>
      {categories.length ? (
        <div className="learner-interests__grid" role="group" aria-labelledby={titleId}>
          {categories.map((category) => {
            const selected = value.includes(category.category_id)
            return (
              <button
                key={category.category_id}
                type="button"
                className="learner-interests__option"
                aria-pressed={selected}
                disabled={disabled}
                onClick={() => onToggle(category.category_id)}
              >
                <span>{category.name}</span>
                <span className="learner-interests__check" aria-hidden="true">
                  <svg viewBox="0 0 16 16" fill="none" focusable="false">
                    <path
                      d="m4 8 2.5 2.5L12 5"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              </button>
            )
          })}
        </div>
      ) : (
        <p className="learner-interests__empty">아직 등록된 분야가 없어요.</p>
      )}
    </div>
  )
}
