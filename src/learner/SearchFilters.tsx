import { useEffect, useId, useRef, useState } from 'react'
import type { Category } from '../api/learner'
import { ImeInput } from '../shared/ImeInput'
import { LiveSearchInput } from './LiveSearchInput'
import './search.css'

export function SearchFilters({
  query,
  categoryId,
  categories,
  pending = false,
  disabled = false,
  label = '학습 영상 검색',
  placeholder = '제목·태그·핵심 정리로 검색',
  onQueryChange,
  onCategoryChange,
  onReset,
}: {
  query: string
  categoryId?: number
  categories?: Category[]
  pending?: boolean
  disabled?: boolean
  label?: string
  placeholder?: string
  onQueryChange: (value: string) => void
  onCategoryChange?: (value: string) => void
  onReset: () => void
}) {
  const [resetRevision, setResetRevision] = useState(0)
  return (
    <form
      className={`learner-search__toolbar${categories ? '' : ' learner-search__toolbar--plain'}`}
      role="search"
      aria-label={label}
      onSubmit={(event) => {
        event.preventDefault()
        if (!disabled) onQueryChange(String(new FormData(event.currentTarget).get('q') ?? ''))
      }}
    >
      <label className="learner-search__input">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          aria-hidden="true"
        >
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="m16 16 5 5" />
        </svg>
        <span className="sasu-sr">검색어</span>
        <LiveSearchInput
          key={resetRevision}
          name="q"
          type="search"
          value={query}
          onValueChange={onQueryChange}
          disabled={disabled}
          maxLength={200}
          placeholder={placeholder}
        />
      </label>
      {categories && onCategoryChange && (
        <CategoryFilter
          value={categoryId ? String(categoryId) : ''}
          onChange={onCategoryChange}
          categories={categories}
          pending={pending}
          disabled={disabled}
        />
      )}
      <button type="submit" className="learner-search__submit" disabled={disabled}>
        검색
      </button>
      <button
        type="button"
        className="learner-search__reset"
        disabled={disabled}
        onClick={() => {
          setResetRevision((value) => value + 1)
          onReset()
        }}
      >
        조건 초기화
      </button>
    </form>
  )
}

function CategoryFilter({
  value,
  onChange,
  categories,
  pending,
  disabled,
}: {
  value: string
  onChange: (value: string) => void
  categories: Category[]
  pending: boolean
  disabled: boolean
}) {
  const id = useId()
  const root = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const [open, setOpen] = useState(false)
  const [term, setTerm] = useState('')
  const [active, setActive] = useState(-1)
  const options = [
    { id: '', label: '전체 분야' },
    ...categories.map((category) => ({ id: String(category.category_id), label: category.name })),
  ]
  const label = options.find((option) => option.id === value)?.label ?? '선택한 분야'
  const matches = options.filter((option) =>
    option.label.toLocaleLowerCase().includes(term.trim().toLocaleLowerCase()),
  )
  const highlighted = open ? matches[active] : undefined
  const expand = () => {
    setTerm('')
    setActive(-1)
    setOpen(true)
  }
  const close = () => {
    setOpen(false)
    setActive(-1)
  }
  const choose = (id: string) => {
    input.current?.focus()
    onChange(id)
    close()
  }
  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) {
        setOpen(false)
        setActive(-1)
      }
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])
  useEffect(() => {
    if (open && active >= 0) list.current?.children[active]?.scrollIntoView({ block: 'nearest' })
  }, [open, active])
  return (
    <div
      ref={root}
      className="learner-search__category"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) close()
      }}
    >
      <label htmlFor={id}>분야</label>
      <input type="hidden" name="cat" value={value} />
      <div className="learner-search__category-control">
        <ImeInput
          id={id}
          ref={input}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={open ? `${id}-options` : undefined}
          aria-activedescendant={
            highlighted ? `${id}-option-${highlighted.id || 'all'}` : undefined
          }
          disabled={pending || disabled}
          autoComplete="off"
          value={pending ? '' : open ? term : label}
          placeholder={pending ? '불러오는 중…' : label}
          onFocus={expand}
          onClick={() => {
            if (!open) expand()
          }}
          onValueChange={(next) => {
            setTerm(next)
            setActive(-1)
            setOpen(true)
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault()
              if (!open) {
                expand()
                return
              }
              if (!matches.length) return
              setActive((index) =>
                event.key === 'ArrowDown'
                  ? (index + 1) % matches.length
                  : index <= 0
                    ? matches.length - 1
                    : index - 1,
              )
            } else if (open && event.key === 'Enter') {
              event.preventDefault()
              if (highlighted) choose(highlighted.id)
              else if (matches.length === 1) choose(matches[0].id)
            } else if (open && event.key === 'Escape') {
              event.preventDefault()
              close()
            }
          }}
        />
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          aria-hidden="true"
          data-open={open || undefined}
        >
          <path d="m7 10 5 5 5-5" />
        </svg>
        {open && (
          <div className="learner-search__category-menu">
            <ul ref={list} id={`${id}-options`} role="listbox" aria-label="분야 선택">
              {matches.map((option, index) => (
                <li key={option.id} role="presentation">
                  <button
                    type="button"
                    role="option"
                    id={`${id}-option-${option.id || 'all'}`}
                    aria-selected={value === option.id}
                    data-highlighted={index === active || undefined}
                    tabIndex={-1}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => choose(option.id)}
                  >
                    <span>{option.label}</span>
                    {value === option.id && (
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        aria-hidden="true"
                      >
                        <path d="m5 12 4 4L19 6" />
                      </svg>
                    )}
                  </button>
                </li>
              ))}
            </ul>
            {!matches.length && <p role="status">일치하는 분야가 없어요.</p>}
          </div>
        )}
      </div>
    </div>
  )
}
