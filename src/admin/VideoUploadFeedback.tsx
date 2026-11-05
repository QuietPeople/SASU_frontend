import { useEffect, useId, useRef, useState } from 'react'
import type { EditableContent } from '../api/admin'
import type { useVideoUpload } from './useVideoUpload'
import { Icon } from './Icon'
import { Button, Spinner } from './ui'
import './video-upload-feedback.css'

interface UploadFeedbackProps {
  upload: ReturnType<typeof useVideoUpload>
  busy: boolean
  fileName?: string
  contentTitle: string
  onRetry: (latest: EditableContent) => void
  onUseCurrent: (latest: EditableContent) => void
}

export function VideoUploadFeedback(props: UploadFeedbackProps) {
  return props.upload.recovery ? <UploadRecoveryView {...props} /> : null
}

function UploadRecoveryView({
  upload,
  busy,
  fileName,
  contentTitle,
  onRetry,
  onUseCurrent,
}: UploadFeedbackProps) {
  const { recovery, check } = upload
  const [open, setOpen] = useState(true)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const reopenRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    if (!open) return
    const dialog = dialogRef.current!
    const previousFocus = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    const lockScroll = previousOverflow !== 'hidden'
    const reopen = reopenRef.current
    if (lockScroll) document.body.style.overflow = 'hidden'
    dialog.showModal()
    closeRef.current?.focus({ preventScroll: true })
    return () => {
      dialog.close()
      if (lockScroll) document.body.style.overflow = previousOverflow
      if (previousFocus?.isConnected && !previousFocus.matches(':disabled'))
        previousFocus.focus({ preventScroll: true })
      else reopen?.focus({ preventScroll: true })
    }
  }, [open])

  const latest = check && 'content' in check ? check.content : null
  const checking = check?.status === 'checking'
  const video = latest?.detail.content
  const statusTitle = checking
    ? '저장 상태를 확인하고 있어요'
    : check?.status === 'changed'
      ? '저장된 영상이 변경됐어요'
      : check?.status === 'unchanged'
        ? '아직 새 영상이 확인되지 않았어요'
        : check?.status === 'unavailable'
          ? '저장 상태를 확인하지 못했어요'
          : '저장 상태를 확인해 주세요'
  const statusDescription = checking
    ? '현재 서버에 연결된 영상을 조회하고 있어요.'
    : check?.status === 'changed'
      ? '다른 작업으로 바뀐 영상일 수도 있어요. 미리보기를 확인한 뒤 다음 작업을 선택해 주세요.'
      : check?.status === 'unchanged'
        ? '서버 처리가 아직 진행 중일 수 있어요. 잠시 후 다시 확인하거나 현재 저장 상태로 돌아갈 수 있어요.'
        : check?.status === 'unavailable'
          ? '연결 상태를 확인하고 다시 조회해 주세요. 작성 내용과 선택한 파일은 유지돼요.'
          : '다음 작업을 선택하기 전에 서버에 저장된 영상을 확인해 주세요.'

  return (
    <>
      <button
        ref={reopenRef}
        type="button"
        className="admin-btn admin-btn--primary"
        onClick={() => setOpen(true)}
      >
        영상 저장 결과 확인
      </button>
      {open && (
        <dialog
          ref={dialogRef}
          className="admin-upload-dialog"
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          onCancel={(event) => {
            event.preventDefault()
            event.stopPropagation()
            setOpen(false)
          }}
          onClick={(event) => {
            if (event.target === event.currentTarget) setOpen(false)
          }}
        >
          <header className="admin-upload-dialog__header">
            <div>
              <p className="admin-upload-dialog__eyebrow">콘텐츠 · 영상 업로드</p>
              <h2 id={titleId}>영상 저장 결과 확인</h2>
              <p id={descriptionId} className="admin-upload-dialog__description">
                {recovery?.reason === 'timeout'
                  ? '응답 대기 시간이 지나 요청을 종료했어요.'
                  : recovery?.reason === 'interrupted'
                    ? '업로드 요청을 중단했어요.'
                    : '영상 저장 응답을 받지 못했어요.'}{' '}
                서버에서 처리가 이어질 수 있어 저장 상태를 확인해요.
              </p>
            </div>
            <button
              ref={closeRef}
              type="button"
              className="admin-upload-dialog__close"
              aria-label="영상 저장 확인 닫기"
              onClick={() => setOpen(false)}
            >
              <Icon name="close" size={20} />
            </button>
          </header>
          <div className="admin-upload-dialog__body">
            <section className="admin-upload-dialog__preview">
              <h3>현재 저장된 영상</h3>
              <p className="admin-upload-dialog__content-title">{contentTitle || '제목 없음'}</p>
              <div className="admin-upload-dialog__media">
                {video?.video_url ? (
                  <video
                    key={video.media_revision}
                    controls
                    playsInline
                    preload="metadata"
                    src={video.video_url}
                    aria-label="현재 서버에 저장된 영상"
                  />
                ) : (
                  <div className="admin-upload-dialog__empty">
                    {checking ? (
                      <Spinner label="저장된 영상 확인 중" />
                    ) : (
                      <Icon name="video" size={30} />
                    )}
                    <span>
                      {checking
                        ? '영상 확인 중'
                        : latest
                          ? '저장된 영상 없음'
                          : '조회 후 영상을 확인할 수 있어요'}
                    </span>
                  </div>
                )}
              </div>
              <span className="admin-upload-dialog__preview-note">
                서버에 저장된 상태를 보여줘요.
              </span>
            </section>
            <section className="admin-upload-dialog__next">
              <div className="admin-upload-dialog__status" role="status" aria-live="polite">
                <span className="admin-upload-dialog__status-icon" aria-hidden="true">
                  {checking ? <span className="admin-spinner" /> : <Icon name="video" size={19} />}
                </span>
                <div>
                  <h3>{statusTitle}</h3>
                  <p>{statusDescription}</p>
                </div>
              </div>
              <div className="admin-upload-dialog__choices">
                <h3>다음 작업 선택</h3>
                <button
                  type="button"
                  className="admin-upload-dialog__choice"
                  disabled={!latest || busy}
                  onClick={() => latest && onUseCurrent(latest)}
                >
                  <span>
                    <strong>현재 저장 상태로 계속 작성</strong>
                    <span>
                      {fileName
                        ? '선택했던 파일을 해제하고, 현재 저장된 상태로 돌아가요.'
                        : '현재 저장된 상태를 반영하고, 콘텐츠 작성을 이어가요.'}
                    </span>
                  </span>
                  <Icon name="chevronRight" size={18} />
                </button>
                {fileName && (
                  <button
                    type="button"
                    className="admin-upload-dialog__choice admin-upload-dialog__choice--retry"
                    disabled={!latest || busy}
                    onClick={() => latest && onRetry(latest)}
                  >
                    <span>
                      <strong>선택한 파일로 다시 업로드</strong>
                      <span>{fileName}</span>
                    </span>
                    <Icon name="arrow" size={18} />
                  </button>
                )}
              </div>
            </section>
          </div>
          <footer className="admin-upload-dialog__footer">
            <p>창을 닫아도 작성 내용은 유지돼요.</p>
            <div>
              <Button onClick={() => setOpen(false)}>닫기</Button>
              <Button disabled={checking} onClick={() => void upload.recheck()}>
                <Icon name="reset" size={16} />
                저장 결과 다시 확인
              </Button>
            </div>
          </footer>
        </dialog>
      )}
    </>
  )
}
