import { useEffect, useRef, useState } from 'react'
import type { AdminContent } from '../api/admin'
import { ContentFormPage } from '../pages/admin/ContentFormPage'
import { MaterialPage } from '../pages/admin/MaterialPage'
import { StatsPage } from '../pages/admin/StatsPage'
import type { ContentSubview, ContentSubviewKind } from './contentSubview'
import { RequestFeedback } from './RequestFeedback'
import { Icon } from './Icon'
import { Button } from './ui'
import './content-dialog.css'

const titles: Record<ContentSubviewKind, string> = {
  edit: '콘텐츠 편집',
  materials: '학습자료',
  stats: '콘텐츠 통계',
}

export function ContentDialog({
  content,
  initialView,
  onClose,
}: {
  content: AdminContent
  initialView: ContentSubviewKind
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const [view, setView] = useState(initialView)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<'close' | 'materials' | null>(null)
  const continueRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const dialog = dialogRef.current!
    const previousFocus = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.showModal()
    closeRef.current?.focus()
    return () => {
      dialog.close()
      document.body.style.overflow = overflow
      previousFocus?.focus({ preventScroll: true })
    }
  }, [])
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 })
  }, [view])
  useEffect(() => {
    if (pending) continueRef.current?.focus()
  }, [pending])
  const finish = (target: 'close' | 'materials') => {
    setPending(null)
    if (target === 'close') onClose()
    else {
      setDirty(false)
      setView('materials')
    }
  }
  const request = (target: 'close' | 'materials') => {
    if (busy) return
    if (dirty) setPending(target)
    else finish(target)
  }
  const embedded: ContentSubview = {
    contentId: content.content_id,
    onClose: () => request('close'),
    onOpenMaterials: () => request('materials'),
    onDirtyChange: setDirty,
    onBusyChange: setBusy,
  }
  return (
    <dialog
      ref={dialogRef}
      className="admin-content-dialog"
      aria-labelledby="content-dialog-title"
      onCancel={(event) => {
        if (event.target !== event.currentTarget) return
        event.preventDefault()
        if (pending) setPending(null)
        else request('close')
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) request('close')
      }}
    >
      <header className="admin-content-dialog__header">
        <div>
          <p>{titles[view]}</p>
          <h2 id="content-dialog-title">{content.title || '제목 없음'}</h2>
        </div>
        <button
          ref={closeRef}
          type="button"
          className="admin-content-dialog__close"
          disabled={busy}
          aria-label="서브 화면 닫기"
          onClick={() => request('close')}
        >
          <Icon name="close" size={20} />
        </button>
      </header>
      {pending && (
        <div className="admin-content-dialog__confirm" role="alert">
          <div>
            <strong>저장하지 않은 변경이 있어요.</strong>
            <p>저장 없이 {pending === 'close' ? '닫을까요?' : '학습자료로 이동할까요?'}</p>
          </div>
          <div className="admin-row">
            <button
              ref={continueRef}
              type="button"
              className="admin-btn admin-btn--primary"
              onClick={() => {
                setPending(null)
                closeRef.current?.focus()
              }}
            >
              계속 작성
            </button>
            <Button onClick={() => finish(pending)}>
              저장 없이 {pending === 'close' ? '닫기' : '이동'}
            </Button>
          </div>
        </div>
      )}
      <div ref={bodyRef} className="admin-content-dialog__body">
        <RequestFeedback key={view}>
          {view === 'edit' ? (
            <ContentFormPage embedded={embedded} />
          ) : view === 'materials' ? (
            <MaterialPage embedded={embedded} />
          ) : (
            <StatsPage embedded={embedded} />
          )}
        </RequestFeedback>
      </div>
    </dialog>
  )
}
