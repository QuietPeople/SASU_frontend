import { useEffect, useId, useRef, useState } from 'react'
import { isValidReviewDate, localReviewDate } from './contentEditor'
import { Icon } from './Icon'

const ROW_HEIGHT = 40

function DateWheel({
  label,
  values,
  value,
  onChange,
}: {
  label: string
  values: number[]
  value: number
  onChange: (value: number) => void
}) {
  const id = useId()
  const ref = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const selectedIndex = values.indexOf(value)
  useEffect(() => {
    const wheel = ref.current
    if (wheel && Math.abs(wheel.scrollTop - selectedIndex * ROW_HEIGHT) > 1) {
      wheel.scrollTop = selectedIndex * ROW_HEIGHT
    }
  }, [selectedIndex])
  useEffect(() => () => clearTimeout(timer.current), [])
  const select = (index: number) => {
    const next = Math.max(0, Math.min(values.length - 1, index))
    clearTimeout(timer.current)
    onChange(values[next])
    ref.current?.scrollTo({ top: next * ROW_HEIGHT, behavior: 'instant' })
  }
  return (
    <div className="admin-date-wheel">
      <span className="admin-date-wheel__label">{label}</span>
      <div className="admin-date-wheel__frame">
        <div
          ref={ref}
          className="admin-date-wheel__scroll"
          role="listbox"
          aria-label={label}
          aria-activedescendant={`${id}-${value}`}
          tabIndex={0}
          onScroll={() => {
            clearTimeout(timer.current)
            timer.current = setTimeout(() => {
              const index = Math.round((ref.current?.scrollTop ?? 0) / ROW_HEIGHT)
              onChange(values[Math.max(0, Math.min(values.length - 1, index))])
            }, 120)
          }}
          onKeyDown={(event) => {
            const offsets: Record<string, number> = {
              ArrowUp: -1,
              ArrowDown: 1,
              PageUp: -5,
              PageDown: 5,
            }
            if (event.key in offsets) {
              event.preventDefault()
              select(selectedIndex + offsets[event.key])
            } else if (event.key === 'Home' || event.key === 'End') {
              event.preventDefault()
              select(event.key === 'Home' ? 0 : values.length - 1)
            }
          }}
        >
          {values.map((item) => (
            <div
              key={item}
              id={`${id}-${item}`}
              role="option"
              aria-selected={value === item}
              className="admin-date-wheel__option"
              onClick={() => select(values.indexOf(item))}
            >
              {label === '연도' ? item : String(item).padStart(2, '0')}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ReviewDateDialog({
  value,
  onApply,
  onClose,
}: {
  value: string
  onApply: (value: string) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const [seed] = useState(() =>
    (isValidReviewDate(value) ? value : localReviewDate(0)).split('-').map(Number),
  )
  const [year, setYear] = useState(seed[0])
  const [month, setMonth] = useState(seed[1])
  const [day, setDay] = useState(seed[2])
  const firstYear = Math.min(1900, seed[0])
  const lastYear = Math.max(new Date().getFullYear() + 20, seed[0])
  const years = Array.from({ length: lastYear - firstYear + 1 }, (_, index) => firstYear + index)
  const daysInMonth = (y: number, m: number) => {
    const date = new Date(0)
    date.setFullYear(y, m, 0)
    return date.getDate()
  }
  const changeYear = (next: number) => {
    setYear(next)
    setDay((current) => Math.min(current, daysInMonth(next, month)))
  }
  const changeMonth = (next: number) => {
    setMonth(next)
    setDay((current) => Math.min(current, daysInMonth(year, next)))
  }
  const applySelection = () => {
    const wheels = ref.current!.querySelectorAll<HTMLElement>('[role="listbox"]')
    const centered = Array.from(wheels, (wheel) => {
      const index = Math.round(wheel.scrollTop / ROW_HEIGHT)
      return Number(
        wheel.children[Math.max(0, Math.min(wheel.children.length - 1, index))]?.textContent,
      )
    })
    const [selectedYear, selectedMonth, selectedDay] = centered
    const validDay = Math.min(selectedDay, daysInMonth(selectedYear, selectedMonth))
    onApply(
      `${String(selectedYear).padStart(4, '0')}-${String(selectedMonth).padStart(2, '0')}-${String(validDay).padStart(2, '0')}`,
    )
    onClose()
  }
  useEffect(() => {
    const dialog = ref.current!
    const previousFocus = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.showModal()
    dialog.querySelectorAll<HTMLElement>('[role="listbox"]').forEach((wheel) => {
      const option = wheel.querySelector<HTMLElement>('[aria-selected="true"]')
      if (option) wheel.scrollTop = option.offsetTop - 80
    })
    return () => {
      dialog.close()
      document.body.style.overflow = previousOverflow
      previousFocus?.focus()
    }
  }, [])
  return (
    <dialog
      ref={ref}
      className="admin-date-dialog"
      aria-labelledby="review-date-title"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="admin-date-dialog__body">
        <header>
          <div>
            <h2 id="review-date-title">검토일 선택</h2>
            <p>연·월·일을 위아래로 돌려 선택해 주세요.</p>
          </div>
          <button
            type="button"
            className="admin-date-dialog__close"
            aria-label="검토일 선택 닫기"
            onClick={onClose}
          >
            <Icon name="close" size={18} />
          </button>
        </header>
        <div className="admin-date-dialog__wheels">
          <DateWheel label="연도" values={years} value={year} onChange={changeYear} />
          <DateWheel
            label="월"
            values={Array.from({ length: 12 }, (_, index) => index + 1)}
            value={month}
            onChange={changeMonth}
          />
          <DateWheel
            label="일"
            values={Array.from({ length: daysInMonth(year, month) }, (_, index) => index + 1)}
            value={day}
            onChange={setDay}
          />
        </div>
        <p className="admin-date-dialog__selected" aria-live="polite">
          {year}년 {month}월 {day}일
        </p>
        <footer>
          <button type="button" className="admin-btn" onClick={onClose}>
            취소
          </button>
          <button type="button" className="admin-btn admin-btn--primary" onClick={applySelection}>
            적용
          </button>
        </footer>
      </div>
    </dialog>
  )
}

export function ReviewDateInput({
  value,
  onChange,
  onBlur,
  invalid,
  describedBy,
}: {
  value: string
  onChange: (value: string) => void
  onBlur: () => void
  invalid: boolean
  describedBy?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="admin-review-date">
      <button
        id="content-reviewed"
        className={`admin-input admin-review-date__trigger${value ? '' : ' admin-is-empty'}`}
        type="button"
        onClick={() => setOpen(true)}
        onBlur={onBlur}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-invalid={invalid}
        aria-describedby={describedBy}
      >
        <span>{value ? value.replaceAll('-', '.') : '검토일 선택'}</span>
        <Icon name="chevronDown" size={16} />
      </button>
      {open && <ReviewDateDialog value={value} onApply={onChange} onClose={() => setOpen(false)} />}
    </div>
  )
}
