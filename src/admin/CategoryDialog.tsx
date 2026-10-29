import { RequestFeedback } from './RequestFeedback'
import { useEffect, useRef, useState } from 'react'
import type { AdminCategory } from '../api/admin'
import { CategoryManager } from './CategoryManager'
import { Button } from './ui'
import { Icon } from './Icon'

export function CategoryDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (category: AdminCategory) => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  useEffect(() => {
    const dialog = ref.current!
    const previousFocus = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.showModal()
    return () => {
      dialog.close()
      document.body.style.overflow = previousOverflow
      previousFocus?.focus()
    }
  }, [])
  const requestClose = () => {
    if (busy) return
    if (dirty) setConfirmClose(true)
    else onClose()
  }
  return (
    <dialog
      ref={ref}
      className="admin-category-dialog"
      aria-labelledby="category-dialog-title"
      onCancel={(event) => {
        event.preventDefault()
        requestClose()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) requestClose()
      }}
    >
      <div className="admin-category-dialog__body">
        <header className="admin-category-dialog__header">
          <div>
            <h2 id="category-dialog-title">분야 관리</h2>
            <p>콘텐츠 작성 내용은 그대로 유지돼요.</p>
          </div>
          <button
            type="button"
            className="admin-category-dialog__close"
            aria-label="분야 관리 닫기"
            disabled={busy}
            onClick={requestClose}
          >
            <Icon name="close" />
          </button>
        </header>
        <RequestFeedback>
          <CategoryManager onCreated={onCreated} onBusyChange={setBusy} onDirtyChange={setDirty} />
        </RequestFeedback>
        {confirmClose && (
          <div className="admin-editor__notice" role="alert">
            <p>저장하지 않은 분야 입력을 버리고 닫을까요? 콘텐츠 작성 내용은 유지돼요.</p>
            <div className="admin-row">
              <Button onClick={() => setConfirmClose(false)}>계속 작성</Button>
              <Button variant="danger" onClick={onClose}>
                버리고 닫기
              </Button>
            </div>
          </div>
        )}
        <footer>
          <Button onClick={requestClose} disabled={busy}>
            완료
          </Button>
        </footer>
      </div>
    </dialog>
  )
}
