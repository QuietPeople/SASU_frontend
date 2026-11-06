import './thumbnail-editor.css'
import { useEffect, useId, useRef, useState } from 'react'
import { useAdminQuery, type EditableContent, type CurriculumDetail } from '../api/admin'
import { Thumbnail } from '../shared/Thumbnail'
import { RequestError } from './RequestFeedback'
import { Icon } from './Icon'
import { Button } from './ui'
import { thumbnailFileError, THUMBNAIL_ACCEPT, type ThumbnailResource } from './thumbnail'

export function ThumbnailEditor({
  resource,
  id,
  file,
  fallbackUrl,
  disabled = false,
  onChange,
}: {
  resource: ThumbnailResource
  id: number | null
  file: File | null
  fallbackUrl?: string | null
  disabled?: boolean
  onChange: (file: File | null) => void
}) {
  const inputId = useId()
  const image = useRef<HTMLImageElement>(null)
  const [error, setError] = useState<unknown>(null)
  const [previewError, setPreviewError] = useState(false)
  const detail = useAdminQuery<EditableContent | CurriculumDetail>(
    id === null ? null : `/${resource}/${id}?view=editor`,
  )
  const data = detail.data
  const src = data
    ? 'summary' in data
      ? data.summary.thumbnail_url
      : data.detail.content.thumbnail_url
    : id === null
      ? fallbackUrl
      : null
  const series = resource === 'curriculums'
  const loading = !file && id !== null && detail.isPending

  useEffect(() => {
    if (!file || !image.current) return
    const url = URL.createObjectURL(file)
    image.current.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])

  const change = (next: File | null) => {
    if (disabled) return
    const problem = next ? thumbnailFileError(next) : null
    if (problem) {
      setError(new Error(problem))
      return
    }
    setError(null)
    setPreviewError(false)
    onChange(next)
  }

  return (
    <section className="admin-thumbnail-editor" aria-labelledby={`${inputId}-title`}>
      <div className="admin-thumbnail-editor__body">
        <figure className="admin-thumbnail-editor__figure">
          <div
            className="admin-thumbnail-editor__preview"
            role="img"
            aria-label={
              file
                ? '선택한 썸네일 미리보기'
                : loading
                  ? '썸네일 불러오는 중'
                  : src
                    ? '현재 썸네일 미리보기'
                    : '썸네일 없음'
            }
            aria-busy={loading}
          >
            {file ? (
              <img ref={image} alt="선택한 썸네일 미리보기" onError={() => setPreviewError(true)} />
            ) : src ? (
              <Thumbnail src={src} refreshKey={detail.dataUpdatedAt} />
            ) : (
              <div className="admin-thumbnail-editor__empty">
                <Icon name="contents" size={26} />
                <span>{loading ? '불러오는 중' : '썸네일 없음'}</span>
              </div>
            )}
            {file && <span className="admin-thumbnail-editor__pending">저장 시 적용</span>}
          </div>
          <figcaption>9:16 미리보기</figcaption>
        </figure>
        <div className="admin-thumbnail-editor__controls">
          <header className="admin-thumbnail-editor__heading">
            <h3 id={`${inputId}-title`}>썸네일</h3>
            <p>{series ? '시리즈' : '콘텐츠'} 목록에 보여줄 이미지를 관리해요.</p>
          </header>
          <div className="admin-thumbnail-editor__actions">
            <label className="admin-thumbnail-editor__picker" htmlFor={inputId}>
              <input
                id={inputId}
                type="file"
                accept={THUMBNAIL_ACCEPT}
                disabled={disabled}
                aria-label={file || src ? '썸네일 이미지 교체' : '썸네일 이미지 선택'}
                aria-describedby={`${inputId}-policy ${inputId}-save-hint`}
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  event.target.value = ''
                  if (file) change(file)
                }}
              />
              <Icon name={file || src ? 'draft' : 'plus'} size={17} />
              {file ? '다른 이미지 선택' : src ? '이미지 교체' : '이미지 선택'}
            </label>
            {file && (
              <button
                type="button"
                className="admin-link"
                disabled={disabled}
                onClick={() => change(null)}
              >
                선택 취소
              </button>
            )}
          </div>
          <div className="admin-thumbnail-editor__guidance">
            <div className="admin-thumbnail-editor__policy" id={`${inputId}-policy`}>
              <span>JPEG · PNG · WebP</span>
              <span>최대 10MB</span>
            </div>
            <p className="admin-thumbnail-editor__hint" id={`${inputId}-save-hint`}>
              선택한 이미지는 {series ? '시리즈' : '콘텐츠'}를 저장할 때 함께 반영돼요.
            </p>
            {series && (
              <p className="admin-thumbnail-editor__fallback">
                직접 등록하지 않으면 첫 영상의 썸네일을 사용해요.
              </p>
            )}
          </div>
        </div>
      </div>
      <div className="admin-thumbnail-editor__status" role="status">
        {file && (
          <>
            <Icon name="draft" size={15} />
            <span>{file.name} · 업로드 대기</span>
          </>
        )}
      </div>
      {error != null && <RequestError title="썸네일 선택 확인" error={error} />}
      {file && previewError && (
        <p className="admin-field-error">
          이미지를 미리 볼 수 없어요. 다른 이미지 파일을 선택해 주세요.
        </p>
      )}
      {id !== null && detail.isError && (
        <RequestError
          title="저장된 썸네일 정보 조회 실패"
          error={detail.error}
          action={
            <Button disabled={disabled} onClick={() => void detail.refetch()}>
              다시 조회
            </Button>
          }
        />
      )}
    </section>
  )
}
