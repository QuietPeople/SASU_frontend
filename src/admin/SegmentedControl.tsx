import { useLayoutEffect, useRef } from 'react'
import './segmented-control.css'

export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { id: T; label: string }[]
  onChange: (value: T) => void
}) {
  const selection = useRef<HTMLSpanElement>(null)
  const previous = useRef(value)
  const selectedIndex = options.findIndex((option) => option.id === value)
  useLayoutEffect(() => {
    if (previous.current === value) return
    previous.current = value
    const pill = selection.current
    if (!pill) return
    pill.getAnimations().forEach((animation) => animation.cancel())
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    pill.animate(
      [
        { transform: 'scale(1)', offset: 0 },
        { transform: 'scale(.48, .66)', offset: 0.38 },
        { transform: 'scale(1.055, .97)', offset: 0.78 },
        { transform: 'scale(1)', offset: 1 },
      ],
      { duration: 480, easing: 'cubic-bezier(.4, 0, .2, 1)' },
    )
  }, [value])
  return (
    <div
      className="admin-tabs admin-segmented"
      role="group"
      aria-label={label}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {selectedIndex >= 0 && (
        <span
          className="admin-segmented__track"
          aria-hidden="true"
          style={{
            width: `calc((100% - 8px) / ${options.length})`,
            transform: `translateX(${selectedIndex * 100}%)`,
          }}
        >
          <span ref={selection} className="admin-segmented__selection" />
        </span>
      )}
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          className={`admin-tabs__tab ${value === option.id ? 'admin-is-active' : ''}`}
          aria-pressed={value === option.id}
          onClick={() => {
            if (value !== option.id) onChange(option.id)
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
