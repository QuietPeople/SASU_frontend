import { useLayoutEffect, useRef } from 'react'
import './segmented-tabs.css'

export function SegmentedTabs<T extends string>({
  label,
  value,
  options,
  onChange,
  idPrefix,
  panelId,
  disabled = false,
}: {
  label: string
  value: T
  options: { id: T; label: string; count?: number }[]
  onChange: (value: T) => void
  idPrefix: string
  panelId: string
  disabled?: boolean
}) {
  const selection = useRef<HTMLSpanElement>(null)
  const previous = useRef(value)
  const buttons = useRef(new Map<T, HTMLButtonElement>())
  const selectedIndex = options.findIndex((option) => option.id === value)
  useLayoutEffect(() => {
    if (previous.current === value) return
    previous.current = value
    const pill = selection.current
    if (!pill) return
    const currentTransform = getComputedStyle(pill).transform
    pill.getAnimations().forEach((animation) => animation.cancel())
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    pill.animate(
      [
        { transform: currentTransform === 'none' ? 'scale(1)' : currentTransform, offset: 0 },
        { transform: 'scale(.48, .66)', offset: 0.38 },
        { transform: 'scale(1.055, .97)', offset: 0.78 },
        { transform: 'scale(1)', offset: 1 },
      ],
      { duration: 480, easing: 'cubic-bezier(.4, 0, .2, 1)' },
    )
  }, [value])
  return (
    <div
      className="learner-segmented"
      role="tablist"
      aria-label={label}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {selectedIndex >= 0 && (
        <span
          className="learner-segmented__track"
          aria-hidden="true"
          style={{
            width: `calc((100% - 8px) / ${options.length})`,
            transform: `translateX(${selectedIndex * 100}%)`,
          }}
        >
          <span ref={selection} className="learner-segmented__selection" />
        </span>
      )}
      {options.map((option, index) => (
        <button
          key={option.id}
          ref={(button) => {
            if (button) buttons.current.set(option.id, button)
            else buttons.current.delete(option.id)
          }}
          type="button"
          role="tab"
          id={`${idPrefix}-${option.id}`}
          aria-controls={panelId}
          aria-selected={value === option.id}
          tabIndex={value === option.id ? 0 : -1}
          disabled={disabled}
          className="learner-segmented__tab"
          onClick={() => {
            if (value !== option.id) onChange(option.id)
          }}
          onKeyDown={(event) => {
            if (disabled || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
            event.preventDefault()
            const nextIndex =
              event.key === 'Home'
                ? 0
                : event.key === 'End'
                  ? options.length - 1
                  : (index + (event.key === 'ArrowRight' ? 1 : -1) + options.length) %
                    options.length
            const next = options[nextIndex].id
            if (value !== next) onChange(next)
            buttons.current.get(next)?.focus({ preventScroll: true })
          }}
        >
          {option.label}
          {'count' in option && (
            <span className="learner-segmented__count" aria-hidden={option.count === undefined}>
              {option.count ?? '—'}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
