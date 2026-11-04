import type { ReactNode } from 'react'
export function SectionHeading({
  number,
  title,
  description,
  complete,
}: {
  number: string
  title: string
  description?: string
  complete?: boolean
}) {
  return (
    <header className="admin-editor__section-head">
      <span>{number}</span>
      <div>
        <div className="admin-editor__label-row">
          <h2>{title}</h2>
          {complete !== undefined && <FieldStatus complete={complete} />}
        </div>
        {description && <p>{description}</p>}
      </div>
    </header>
  )
}
export function Field({
  label,
  id,
  error,
  complete,
  onBlur,
  children,
}: {
  label: string
  id: string
  error?: string
  complete?: boolean
  onBlur?: () => void
  children: ReactNode
}) {
  return (
    <div
      className="admin-field"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) onBlur?.()
      }}
    >
      <div className="admin-editor__label-row">
        <label className="admin-field__label" htmlFor={id}>
          {label}
        </label>
        {complete !== undefined && <FieldStatus complete={complete} />}
      </div>
      {children}
      <p
        id={`${id}-error`}
        className="admin-field-error admin-editor__field-feedback"
        aria-live="polite"
      >
        {error}
      </p>
    </div>
  )
}

function FieldStatus({ complete }: { complete: boolean }) {
  return (
    <span className={`admin-editor__field-status${complete ? ' admin-is-complete' : ''}`}>
      {complete ? '입력 완료' : '입력 필요'}
    </span>
  )
}
