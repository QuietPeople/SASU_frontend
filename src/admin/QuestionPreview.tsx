import type { AdminQuestion } from '../api/admin'
import { ResultBadge } from './ResultBadge'
import './question-preview.css'

export function QuestionPreview({
  question,
  options,
  selectedOptionId = null,
  correctOptionId = null,
  disabled = false,
  onSelect,
}: {
  question: string
  options: AdminQuestion['options']
  selectedOptionId?: number | null
  correctOptionId?: number | null
  disabled?: boolean
  onSelect?: (id: number) => void
}) {
  const readOnly = !onSelect
  return (
    <div className="admin-question-preview">
      <p className="admin-question-preview__question">
        {question.trim() || '질문을 입력해 주세요'}
      </p>
      <ol
        className="admin-question-preview__options"
        aria-label={readOnly ? '제출 당시 보기' : '퀴즈 미리보기 답 선택'}
      >
        {[...options]
          .sort((a, b) => a.option_order - b.option_order)
          .map((option) => {
            const selected = option.option_id === selectedOptionId
            const correct = option.option_id === correctOptionId
            const className = `admin-question-preview__option${selected ? ' is-picked' : ''}${correct ? ' is-answer' : ''}${selected && correctOptionId !== null && !correct ? ' is-wrong' : ''}`
            const content = (
              <>
                <span className="admin-question-preview__number">{option.option_order}</span>
                <span className="admin-question-preview__text">
                  {option.option_text.trim() || `${option.option_order}번 보기`}
                </span>
                {correct ? (
                  <ResultBadge
                    result="CORRECT"
                    label={readOnly && selected ? '제출 · 정답' : '정답'}
                  />
                ) : readOnly && selected ? (
                  <span className="admin-question-preview__selected">제출한 답</span>
                ) : null}
              </>
            )
            return (
              <li key={option.option_id}>
                {readOnly ? (
                  <div className={className}>{content}</div>
                ) : (
                  <button
                    type="button"
                    className={className}
                    aria-pressed={selected}
                    disabled={disabled || !option.option_text.trim()}
                    onClick={() => onSelect(option.option_id)}
                  >
                    {content}
                  </button>
                )}
              </li>
            )
          })}
      </ol>
    </div>
  )
}
