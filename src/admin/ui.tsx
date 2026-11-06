import { useEffect, useId, useRef, type PropsWithChildren, type ReactNode } from 'react'

// 관리자 UI는 학습자 디자인 작업과 독립적으로 관리한다. 통합 시 공통화 여부를 검토한다.

interface ButtonProps {
  variant?: 'default' | 'primary' | 'ghost' | 'danger' | 'light'
  size?: 'md' | 'sm'
  active?: boolean
  loading?: boolean
  disabled?: boolean
  type?: 'button' | 'submit'
  onClick?: () => void
  'aria-pressed'?: boolean
  title?: string
  children: ReactNode
}

export function Button({
  variant = 'default',
  size = 'md',
  active = false,
  loading = false,
  disabled,
  type = 'button',
  onClick,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type === 'submit' ? 'submit' : 'button'}
      className={`admin-btn admin-btn--${variant} ${size === 'sm' ? 'admin-btn--sm' : ''} ${active ? 'admin-is-active' : ''}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      onClick={onClick}
      {...rest}
    >
      {loading ? <span className="admin-spinner" aria-hidden="true" /> : null}
      {children}
    </button>
  )
}

// 상태 배지. 색만으로 구분하지 않도록 텍스트를 항상 함께 보여 줌
export function Badge({
  tone = 'neutral',
  children,
}: PropsWithChildren<{ tone?: 'neutral' | 'green' | 'blue' | 'amber' | 'red' }>) {
  return <span className={`admin-badge admin-badge--${tone}`}>{children}</span>
}

export function Spinner({
  light = false,
  label = '불러오는 중',
}: {
  light?: boolean
  label?: string
}) {
  return (
    <span className="admin-loading" role="status">
      <span className={`admin-spinner ${light ? 'admin-spinner--light' : ''}`} aria-hidden="true" />
      <span className="admin-sr">{label}</span>
    </span>
  )
}

// 로딩·빈 목록·오류를 구분해 보여 주는 상태 블록(화면 설계서 1-2 비동기 처리)
export function StateBlock({
  title,
  text,
  action,
}: {
  title: string
  text?: string
  action?: ReactNode
}) {
  return (
    <div className="admin-empty">
      <p className="admin-empty__title">{title}</p>
      {text ? <p className="admin-empty__text">{text}</p> : null}
      {action ? <div className="admin-empty__action">{action}</div> : null}
    </div>
  )
}

// 확인 대화상자. 되돌리기를 약속하지 않는 동작(A07) 등에서 명시적 확인을 받음
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = '취소',
  onConfirm,
  onCancel,
  busy = false,
  danger = false,
}: PropsWithChildren<{
  open: boolean
  title: string
  confirmLabel: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
  busy?: boolean
  danger?: boolean
}>) {
  const ref = useRef<HTMLDialogElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  useEffect(() => {
    if (!open) return undefined
    const dialog = ref.current!
    const prev = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.showModal()
    cancelRef.current?.focus({ preventScroll: true })
    return () => {
      dialog.close()
      document.body.style.overflow = overflow
      if (prev?.isConnected) prev.focus({ preventScroll: true })
    }
  }, [open])
  if (!open) return null
  return (
    <dialog
      ref={ref}
      className="admin-modal__box admin-confirm-dialog"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        if (event.target !== event.currentTarget) return
        event.preventDefault()
        if (!busy) onCancel()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel()
      }}
    >
      <h2 id={titleId} className="admin-modal__title">
        {title}
      </h2>
      <div id={descriptionId} className="admin-modal__body">
        {children}
      </div>
      <div className="admin-modal__foot">
        <button
          ref={cancelRef}
          type="button"
          className="admin-btn"
          onClick={onCancel}
          disabled={busy}
        >
          {cancelLabel}
        </button>
        <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={busy}>
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  )
}
