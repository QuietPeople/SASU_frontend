import { useEffect, useRef, useState } from 'react'
import { Thumbnail } from '../shared/Thumbnail'
import { Icon } from './Icon'
import { thumbnailFileError, THUMBNAIL_ACCEPT } from './thumbnail'

export function ContentThumbnailInput({
  file,
  remove,
  savedUrl,
  refreshKey,
  disabled,
  uploading,
  onChange,
}: {
  file: File | null
  remove: boolean
  savedUrl: string | null | undefined
  refreshKey: number
  disabled: boolean
  uploading: boolean
  onChange: (file: File | null, remove: boolean) => void
}) {
  const image = useRef<HTMLImageElement>(null)
  const dragDepth = useRef(0)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState('')
  const [previewError, setPreviewError] = useState(false)
  useEffect(() => {
    if (!file || !image.current) return
    const url = URL.createObjectURL(file)
    image.current.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])
  const select = (files: File[]) => {
    if (disabled) return
    const problem =
      files.length !== 1 ? '이미지 파일을 한 개만 선택해 주세요.' : thumbnailFileError(files[0])
    if (problem) {
      setError(problem + (file ? ' 기존 선택은 유지돼요.' : ''))
      return
    }
    setError('')
    setPreviewError(false)
    onChange(files[0], false)
  }
  const change = (remove: boolean) => {
    if (disabled) return
    setError('')
    setPreviewError(false)
    onChange(null, remove)
  }
  return (
    <div
      className="admin-editor__media-panel"
      onDragEnter={(event) => {
        if (!event.dataTransfer.types.includes('Files')) return
        event.preventDefault()
        if (disabled) return
        dragDepth.current += 1
        setDragging(true)
      }}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes('Files')) return
        event.preventDefault()
        event.dataTransfer.dropEffect = disabled ? 'none' : 'copy'
      }}
      onDragLeave={() => {
        dragDepth.current = Math.max(0, dragDepth.current - 1)
        if (dragDepth.current === 0) setDragging(false)
      }}
      onDrop={(event) => {
        event.preventDefault()
        dragDepth.current = 0
        setDragging(false)
        if (event.dataTransfer.types.includes('Files')) select(Array.from(event.dataTransfer.files))
      }}
    >
      <div
        className={`admin-editor__preview${error || previewError ? ' admin-editor__preview--error' : ''}`}
      >
        {file ? (
          <img ref={image} alt="선택한 썸네일 미리보기" onError={() => setPreviewError(true)} />
        ) : savedUrl && !remove ? (
          <Thumbnail src={savedUrl} refreshKey={refreshKey} className="admin-editor__thumbnail" />
        ) : (
          <div>
            <Icon name="contents" size={32} />
            <strong>{remove ? '썸네일 삭제 예정' : '첫 프레임을 썸네일로 사용해요'}</strong>
            <span>
              {remove
                ? '저장하면 등록된 썸네일이 삭제돼요'
                : '다른 이미지를 사용하려면 여기에 끌어 놓으세요'}
            </span>
          </div>
        )}
        {dragging && (
          <div className="admin-editor__drop-overlay" role="status">
            <Icon name="plus" size={28} />
            <strong>여기에 이미지를 놓아 주세요</strong>
          </div>
        )}
      </div>
      {error && (
        <p id="content-thumbnail-error" className="admin-field-error" role="alert">
          {error}
        </p>
      )}
      {file && previewError && (
        <p className="admin-field-error">
          이미지를 미리 볼 수 없어요. 다른 이미지 파일을 선택해 주세요.
        </p>
      )}
      <label className="admin-editor__file-picker">
        <input
          id="content-thumbnail"
          type="file"
          accept={THUMBNAIL_ACCEPT}
          disabled={disabled}
          aria-label="썸네일 이미지 선택"
          aria-invalid={!!error}
          aria-describedby={
            error ? 'content-thumbnail-error content-thumbnail-policy' : 'content-thumbnail-policy'
          }
          onChange={(event) => {
            const files = Array.from(event.target.files ?? [])
            if (files.length) select(files)
            event.target.value = ''
          }}
        />
        <Icon name="plus" size={18} />
        {file ? '다른 이미지 선택' : savedUrl && !remove ? '썸네일 교체' : '썸네일 선택'}
      </label>
      {file ? (
        <div className="admin-editor__file-info">
          <div>
            <strong>{file.name}</strong>
            <span>
              {(file.size / 1024 / 1024).toFixed(1)} MB · {uploading ? '저장 중…' : '업로드 대기'}
            </span>
          </div>
          <button
            type="button"
            className="admin-link"
            disabled={disabled}
            onClick={() => change(false)}
          >
            선택 취소
          </button>
        </div>
      ) : remove ? (
        <div className="admin-editor__file-info">
          <div>
            <strong>썸네일 삭제 예정</strong>
            <span>저장 전에는 기존 이미지가 유지돼요.</span>
          </div>
          <button
            type="button"
            className="admin-link"
            disabled={disabled}
            onClick={() => change(false)}
          >
            삭제 취소
          </button>
        </div>
      ) : savedUrl ? (
        <button
          type="button"
          className="admin-link admin-editor__thumbnail-remove"
          disabled={disabled}
          onClick={() => change(true)}
        >
          썸네일 삭제
        </button>
      ) : null}
      <div className="admin-editor__policy" id="content-thumbnail-policy">
        <span>JPEG · PNG · WebP</span>
        <span>최대 10MB</span>
        <span>선택 사항</span>
      </div>
      <p className="admin-help">
        {!file && !savedUrl && !remove
          ? '등록된 썸네일이 없으면 영상 업로드 시 첫 프레임으로 자동 생성돼요.'
          : '선택한 이미지와 삭제 변경은 콘텐츠를 저장할 때 반영돼요.'}
      </p>
    </div>
  )
}
