import { useEffect, useRef, useState } from 'react'
interface Option {
  id: string
  label: string
}

export function AutocompleteInput({
  id,
  placeholder,
  listLabel,
  showAll = false,
  prefix,
  onSelect,
  onOpen,
  onClose,
  value,
  options,
  onChange,
  onConfirm,
  invalid,
  describedBy,
  maxLength,
}: {
  id: string
  placeholder: string
  listLabel: string
  showAll?: boolean
  prefix?: string
  onSelect: (option: Option) => void
  onOpen?: () => void
  onClose?: () => void
  value: string
  options: Option[]
  onChange: (value: string) => void
  onConfirm?: () => void
  invalid: boolean
  describedBy?: string
  maxLength?: number
}) {
  const root = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const [focused, setFocused] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [active, setActive] = useState(-1)
  const matches = value.trim()
    ? options.filter((tag) =>
        tag.label.toLocaleLowerCase().includes(value.trim().toLocaleLowerCase()),
      )
    : showAll
      ? options
      : []
  const expanded = focused && !dismissed && matches.length > 0
  const selected = expanded ? matches[active] : undefined
  useEffect(() => {
    if (expanded && active >= 0)
      list.current?.children[active]?.scrollIntoView({ block: 'nearest' })
  }, [active, expanded])
  const choose = (tag: Option) => {
    input.current?.focus()
    onSelect(tag)
    setDismissed(true)
    setActive(-1)
  }
  return (
    <div
      ref={root}
      className="admin-autocomplete"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setFocused(false)
          setActive(-1)
          onClose?.()
        }
      }}
    >
      <input
        ref={input}
        id={id}
        className="admin-input"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={expanded ? `${id}-suggestions` : undefined}
        aria-activedescendant={selected ? `${id}-option-${selected.id}` : undefined}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        autoComplete="off"
        maxLength={maxLength}
        value={value}
        placeholder={placeholder}
        onFocus={() => {
          setFocused(true)
          setDismissed(false)
          onOpen?.()
        }}
        onClick={() => {
          if (!focused || dismissed) onOpen?.()
          setDismissed(false)
        }}
        onChange={(event) => {
          onChange(event.target.value)
          setDismissed(false)
          setActive(-1)
        }}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return
          if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && matches.length) {
            event.preventDefault()
            setDismissed(false)
            setActive((current) =>
              event.key === 'ArrowDown'
                ? (current + 1) % matches.length
                : current <= 0
                  ? matches.length - 1
                  : current - 1,
            )
          } else if (event.key === 'Escape') {
            event.preventDefault()
            setDismissed(true)
            setActive(-1)
            onClose?.()
          } else if (event.key === 'Enter') {
            event.preventDefault()
            if (selected) choose(selected)
            else {
              onConfirm?.()
              setDismissed(true)
              setActive(-1)
            }
          }
        }}
      />
      {expanded && (
        <ul
          ref={list}
          id={`${id}-suggestions`}
          className="admin-autocomplete__suggestions"
          role="listbox"
          aria-label={listLabel}
        >
          {matches.map((tag, index) => (
            <li key={tag.id} role="presentation">
              <button
                type="button"
                id={`${id}-option-${tag.id}`}
                role="option"
                aria-selected={index === active}
                tabIndex={-1}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(tag)}
              >
                {prefix && <span aria-hidden="true">{prefix}</span>}
                {tag.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
