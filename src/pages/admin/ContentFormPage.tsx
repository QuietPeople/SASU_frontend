import { ContentLifecycleActions } from '../../admin/ContentLifecycleActions'
import { contentStatusLabel, contentStatusTone } from '../../admin/contentStatus'
import { Skeleton } from '../../shared/Skeleton'
import { ContentThumbnailInput } from '../../admin/ContentThumbnailInput'
import { SegmentedControl } from '../../admin/SegmentedControl'
import type { ContentSubview } from '../../admin/contentSubview'
import { isEditConflict } from '../../admin/editVersion'
import { EditConflictNotice } from '../../admin/EditConflictNotice'
import { RequestError } from '../../admin/RequestFeedback'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { api, type ApiPage } from '../../api/client'
import {
  adminError,
  useAdminQuery,
  type AdminCategory,
  type AdminTag,
  type EditableContent,
  type VideoPolicy,
} from '../../api/admin'
import { useSession } from '../../state/session'
import { Badge, Button, ConfirmDialog, Spinner } from '../../admin/ui'
import { useToast } from '../../admin/useToast'
import { CategoryDialog } from '../../admin/CategoryDialog'
import { ReviewDateInput } from '../../admin/ReviewDateInput'
import { TagInput } from '../../admin/TagInput'
import { CategoryInput } from '../../admin/CategoryInput'
import { Icon } from '../../admin/Icon'
import {
  contentSignature,
  initialFields,
  missingPublishFields,
  videoSelectionError,
  tagInputError,
  tagSearchPath,
  resolveContentTag,
  contentFieldError,
  type TextField,
  addContentTag,
  publishFields,
  type ContentFields,
  type ContentTag,
  type PublishField,
} from '../../admin/contentEditor'
import { useVideoUpload } from '../../admin/useVideoUpload'
import { VideoUploadFeedback } from '../../admin/VideoUploadFeedback'
import { VideoPolicyGuide } from '../../admin/VideoPolicyGuide'
import { UploadNeedsReviewError } from '../../admin/uploadRecovery'
import '../../admin/content-editor.css'
import { useContentDraft } from '../../admin/useContentDraft'
import { useContentSave } from '../../admin/useContentSave'
import type { SaveStage } from '../../admin/contentSave'
import { Field, SectionHeading } from '../../admin/ContentFields'

export function ContentFormPage({ embedded }: { embedded?: ContentSubview } = {}) {
  const { id: routeId } = useParams()
  const id = embedded ? String(embedded.contentId) : routeId
  const { actorId, generation } = useSession()
  const detail = useAdminQuery<EditableContent>(id ? `/contents/${id}?view=editor` : null)
  if (id && detail.isPending)
    return (
      <div className="admin-page">
        <Skeleton variant="form" label="콘텐츠를 불러오는 중" />
      </div>
    )
  if (id && detail.isError && detail.data === undefined)
    return (
      <div className="admin-page">
        <RequestError
          variant="screen"
          title="콘텐츠를 불러오지 못했어요."
          error={detail.error}
          action={<Button onClick={() => void detail.refetch()}>다시 시도</Button>}
        />
      </div>
    )
  return (
    <>
      {id && detail.isError ? (
        <RequestError
          title="최신 콘텐츠 정보를 불러오지 못했어요. 작성 중인 내용은 유지돼요."
          error={detail.error}
          action={<Button onClick={() => void detail.refetch()}>다시 시도</Button>}
        />
      ) : null}
      <ContentEditor
        key={`${actorId}:${generation}:${id ?? 'new'}`}
        initial={id ? detail.data : undefined}
        embedded={embedded}
      />
    </>
  )
}

interface EditorDraft {
  form: ContentFields
  tags: ContentTag[]
  tagDraft: string
  tagSelection?: AdminTag | null
  file: File | null
  thumbnailFile: File | null
  removeThumbnail: boolean
  saved?: EditableContent
  baseline: string
}
// 화면 이동 동안만 보존한다. 사용자·기록 세대별로 분리하며 파일을 서버나 브라우저 저장소에 자동 업로드하지 않는다.
const editorDrafts = new Map<string, EditorDraft>()
const stageLabels: Record<SaveStage, string> = {
  tags: '태그 확인 중',
  metadata: '콘텐츠 정보 저장 중',
  video: '영상 전송 중',
  thumbnail: '썸네일 저장 중',
  publish: '공개 처리 중',
}

function ContentEditor({
  initial,
  embedded,
}: {
  initial?: EditableContent
  embedded?: ContentSubview
}) {
  const { actorId, generation } = useSession()
  const navigate = useNavigate()
  const { show, node } = useToast()
  const categories = useAdminQuery<{ items: AdminCategory[] }>('/categories')
  const policy = useAdminQuery<VideoPolicy>('/contents/video-policy')
  const draftKey = `${actorId}:${generation}:${initial?.detail.content.content_id ?? 'new'}`
  const [seed] = useState<EditorDraft>(
    () =>
      editorDrafts.get(draftKey) ?? {
        form: initialFields(initial),
        tags: initial?.detail.content.tags ?? [],
        tagDraft: '',
        file: null,
        thumbnailFile: null,
        removeThumbnail: false,
        saved: initial,
        baseline: contentSignature(initialFields(initial), initial?.detail.content.tags ?? []),
      },
  )
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(seed.thumbnailFile ?? null)
  const [removeThumbnail, setRemoveThumbnail] = useState(seed.removeThumbnail ?? false)
  const [thumbnailRevision, setThumbnailRevision] = useState(0)
  const [mediaTab, setMediaTab] = useState<'video' | 'thumbnail'>('video')
  const [saved, setSaved] = useState(seed.saved)
  const [file, setFile] = useState<File | null>(seed.file)
  const {
    form,
    setForm,
    tags,
    setTags,
    tagDraft,
    setTagDraft,
    tagSelection,
    setTagSelection,
    baseline,
    setBaseline,
    dirty: textDirty,
  } = useContentDraft(seed)
  const videoUpload = useVideoUpload({
    actorId,
    generation,
    contentId: seed.saved?.detail.content.content_id,
  })
  const uploadProgress = videoUpload.progress
  const [error, setError] = useState('')
  const [warning, setWarning] = useState('')
  const [showFieldErrors, setShowFieldErrors] = useState(false)
  const [categoryOpen, setCategoryOpen] = useState(false)
  const [confirmMaterials, setConfirmMaterials] = useState(false)
  const [touched, setTouched] = useState<Partial<Record<TextField | 'tags', boolean>>>({})
  const [previewError, setPreviewError] = useState(false)
  const [fileError, setFileError] = useState('')
  const [draggingFile, setDraggingFile] = useState(false)
  const dragDepth = useRef(0)
  const videoRef = useRef<HTMLVideoElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const contentSave = useContentSave({
    upload: videoUpload.upload,
    onTags: (resolved) => {
      setTags(resolved)
      setTagDraft('')
    },
    onSaved: setSaved,
    onBaseline: setBaseline,
    onVideoSaved: () => {
      setFile(null)
      setPreviewError(false)
      if (fileRef.current) fileRef.current.value = ''
    },
    onThumbnailSaved: () => {
      setThumbnailFile(null)
      setRemoveThumbnail(false)
      setThumbnailRevision((value) => value + 1)
    },
    onWarning: setWarning,
    onSuccess: (current, publish) => {
      setShowFieldErrors(false)
      show(publish ? '공개했어요.' : '저장했어요.')
      editorDrafts.delete(draftKey)
      if (!initial && !embedded)
        navigate(`/admin/contents/${current.detail.content.content_id}`, { replace: true })
    },
  })
  const { savingRef, busy: saveBusy, stage, error: requestError } = contentSave
  const [controlBusy, setControlBusy] = useState(false)
  const busy = saveBusy ?? (controlBusy ? 'control' : null)
  const editConflict = isEditConflict(requestError)
  const tagOptions = useAdminQuery<ApiPage<AdminTag>>(tagSearchPath(tagDraft))
  const pendingTag = resolveContentTag(tagSelection ?? tagDraft, [
    ...tags,
    ...(tagOptions.data?.items ?? []),
  ])
  const selectedTagError = tags.map((tag) => tagInputError(tag)).find(Boolean)
  const tagError = (tagDraft ? tagInputError(pendingTag) : null) ?? selectedTagError
  const canAddTag = tagInputError(pendingTag) === null
  const dirty = file !== null || thumbnailFile !== null || removeThumbnail || textDirty
  const missing = missingPublishFields(form, tags, !!file || !!saved?.detail.content.media_revision)
  const touch = (key: TextField | 'tags') => setTouched((current) => ({ ...current, [key]: true }))
  const fieldError = (key: TextField) =>
    form[key] || touched[key] || showFieldErrors
      ? (contentFieldError(key, form[key]) ?? undefined)
      : undefined
  const invalid = (key: PublishField) => {
    if (key === 'video') return showFieldErrors && missing.includes(key)
    if (key === 'tags')
      return !!tagError || !!((touched.tags || showFieldErrors) && missing.includes(key))
    return !!fieldError(key)
  }
  const videoStatus = videoUpload.recovery
    ? '영상 저장 결과 확인 중…'
    : uploadProgress?.phase === 'processing'
      ? '영상 확인 및 저장 중…'
      : uploadProgress?.percent != null
        ? `업로드 중 ${uploadProgress.percent}%`
        : '영상 전송 중…'
  const activeStageLabel = stage === 'video' ? videoStatus : stage ? stageLabels[stage] : ''
  const reviewedError = fieldError('reviewed')
  const cautionInvalid = form.caution && !!fieldError('cautionText')
  const publishDisabled =
    editConflict ||
    !saved ||
    missing.length > 0 ||
    busy !== null ||
    actorId === null ||
    videoUpload.recovery !== null
  const publishHint = editConflict
    ? '최신 내용을 다시 불러와 주세요'
    : busy
      ? '처리가 끝날 때까지 기다려 주세요'
      : videoUpload.recovery
        ? '영상 저장 결과를 먼저 확인해 주세요'
        : actorId === null
          ? '관리자 사용자를 선택해 주세요'
          : missing.length
            ? '필수 항목을 채워주세요'
            : !saved
              ? '먼저 임시저장해 주세요'
              : undefined
  const set = <K extends keyof ContentFields>(key: K, value: ContentFields[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
    setError('')
  }

  const onTitleChange = embedded?.onTitleChange
  const savedTitle = saved?.detail.content.title
  useEffect(() => {
    if (savedTitle !== undefined) onTitleChange?.(savedTitle)
  }, [savedTitle, onTitleChange])
  const onDirtyChange = embedded?.onDirtyChange
  const onBusyChange = embedded?.onBusyChange
  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])
  useEffect(() => {
    onBusyChange?.(busy !== null)
  }, [busy, onBusyChange])

  useEffect(() => {
    if (dirty || (!initial && saved))
      editorDrafts.set(draftKey, {
        form,
        tags,
        tagDraft,
        tagSelection,
        file,
        thumbnailFile,
        removeThumbnail,
        saved,
        baseline,
      })
    else editorDrafts.delete(draftKey)
  }, [
    draftKey,
    dirty,
    initial,
    form,
    tags,
    tagDraft,
    tagSelection,
    file,
    thumbnailFile,
    removeThumbnail,
    saved,
    baseline,
  ])
  useEffect(() => {
    if (!dirty && !busy) return
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [dirty, busy])
  useEffect(() => {
    if (!file || !videoRef.current) return
    const url = URL.createObjectURL(file)
    videoRef.current.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])

  const selectVideo = (files: File[]) => {
    if (savingRef.current) return
    const problem = videoSelectionError(files, policy.data)
    if (problem) {
      setFileError(problem + (file ? ' 기존 선택은 유지돼요.' : ''))
      return
    }
    setFile(files[0])
    setFileError('')
    setPreviewError(false)
    setError('')
  }

  const addTag = () => {
    if (!canAddTag) return
    setTags(addContentTag(tags, pendingTag))
    setTagSelection(null)
    setError('')
    setTagDraft('')
  }
  const focusField = (key: PublishField) => {
    const focus = () => {
      const field = document.getElementById(publishFields.find((item) => item.key === key)!.input)
      field?.focus()
      field?.scrollIntoView({ block: 'center', behavior: 'auto' })
    }
    if (key === 'video') {
      setMediaTab('video')
      requestAnimationFrame(focus)
    } else focus()
  }
  const refreshSaved = async () => {
    if (!saved || actorId === null) return
    try {
      setSaved(
        await api<EditableContent>(`/contents/${saved.detail.content.content_id}?view=editor`, {
          actorId,
        }),
      )
      setWarning('')
    } catch (cause) {
      setWarning(`저장된 콘텐츠 정보를 다시 불러오지 못했어요. ${adminError(cause)}`)
    }
  }
  const reloadAfterConflict = async () => {
    if (!saved || actorId === null) return
    const latest = await api<EditableContent>(
      `/contents/${saved.detail.content.content_id}?view=editor`,
      { actorId },
    )
    const fields = initialFields(latest)
    setSaved(latest)
    setForm(fields)
    setTags(latest.detail.content.tags)
    setTagDraft('')
    setTagSelection(null)
    setBaseline(contentSignature(fields, latest.detail.content.tags))
    setFile(null)
    setThumbnailFile(null)
    setRemoveThumbnail(false)
    setThumbnailRevision((value) => value + 1)
    if (fileRef.current) fileRef.current.value = ''
    setPreviewError(false)
    setFileError('')
    setError('')
    setWarning('')
    setTouched({})
    setShowFieldErrors(false)
    contentSave.reset()
  }
  const save = (publish: boolean, confirmedSaved?: EditableContent) => {
    if (editConflict) return
    if (savingRef.current || actorId === null || (videoUpload.recovery && !confirmedSaved)) return
    if (tagDraft.trim()) {
      setError(
        '입력 중인 태그가 있어요. 추가 버튼이나 Enter로 확정하거나 입력을 지운 뒤 저장해 주세요.',
      )
      focusField('tags')
      return
    }
    const invalidField = publishFields.find(
      ({ key }) =>
        key !== 'tags' && key !== 'video' && form[key].trim() && contentFieldError(key, form[key]),
    )
    if (invalidField) {
      setShowFieldErrors(true)
      setError('입력 조건에 맞지 않는 항목을 확인해 주세요.')
      focusField(invalidField.key)
      return
    }
    if (selectedTagError) {
      setShowFieldErrors(true)
      setError('태그의 입력 조건을 확인해 주세요.')
      focusField('tags')
      return
    }
    if (publish && missing.length) {
      setShowFieldErrors(true)
      setError('공개에 필요한 항목을 확인해 주세요.')
      focusField(missing[0])
      return
    }
    if (form.caution && !form.cautionText.trim()) {
      setShowFieldErrors(true)
      setError('주의 문구를 입력해 주세요.')
      document.getElementById('content-caution')?.focus()
      return
    }
    if (file && policy.data && file.size > policy.data.max_bytes) {
      setError('허용 용량보다 큰 파일이에요. 다른 영상을 선택해 주세요.')
      focusField('video')
      return
    }
    setError('')
    setWarning('')
    contentSave.save({
      publish,
      actorId,
      generation,
      form,
      tags,
      file,
      thumbnailFile,
      removeThumbnail,
      saved: confirmedSaved ?? saved,
    })
  }
  return (
    <div className="admin-page admin-editor">
      <div className="admin-editor__top">
        {!embedded && (
          <button
            type="button"
            className="admin-link"
            disabled={busy !== null}
            onClick={() => navigate('/admin/contents')}
          >
            <Icon name="chevronLeft" size={16} /> 콘텐츠 목록
          </button>
        )}
        <div className="admin-row">
          <Badge tone={contentStatusTone(saved?.detail.content.status)}>
            {saved ? contentStatusLabel(saved.detail.content.status) : '작성 중'}
          </Badge>
          {dirty && <span className="admin-editor__unsaved">미저장 변경 있음</span>}
          {saved && !dirty && !busy && (
            <span className="admin-editor__saved">
              <Icon name="check" size={14} /> 저장됨
            </span>
          )}
        </div>
      </div>
      {!embedded && (
        <header className="admin-page__head">
          <p className="admin-eyebrow">관리자 · 콘텐츠</p>
          <h1 className="admin-title">{saved ? '콘텐츠 수정' : '새 콘텐츠 만들기'}</h1>
          <p className="admin-sub">
            {saved
              ? '기본 정보와 영상을 수정할 수 있어요.'
              : '먼저 초안을 저장하고, 준비가 끝나면 공개해 주세요.'}{' '}
            필수 항목은 공개할 때 필요하며, 작성 중에도 임시저장할 수 있어요.
          </p>
        </header>
      )}
      {editConflict && <EditConflictNotice onReload={reloadAfterConflict} />}
      {requestError && !editConflict && !(requestError instanceof UploadNeedsReviewError) && (
        <RequestError
          title="콘텐츠 저장·공개 실패"
          error={requestError.cause ?? requestError}
          text={requestError.message}
        />
      )}
      {error && (
        <div className="admin-editor__notice admin-editor__notice--error" role="alert">
          <strong>입력 내용을 확인해 주세요</strong>
          <p>{error}</p>
        </div>
      )}
      {warning && (
        <RequestError
          title="저장된 최신 정보 조회 실패"
          text={warning}
          action={
            <Button disabled={busy !== null} onClick={() => void refreshSaved()}>
              최신 정보 다시 불러오기
            </Button>
          }
        />
      )}
      <fieldset
        disabled={busy !== null || videoUpload.recovery !== null}
        className="admin-editor__fieldset"
      >
        <legend className="admin-sr">콘텐츠 작성</legend>
        <div className="admin-editor__grid">
          <div className="admin-editor__column admin-editor__column--basic">
            <section className="admin-editor__section">
              <SectionHeading
                number="01"
                title="기본 정보"
                description="콘텐츠를 찾고 이해하는 데 필요한 정보를 입력해 주세요."
              />
              <Field
                label="제목"
                id="content-title"
                complete={!missing.includes('title')}
                onBlur={() => touch('title')}
                error={fieldError('title')}
              >
                <input
                  id="content-title"
                  className="admin-input"
                  value={form.title}
                  onChange={(e) => set('title', e.target.value)}
                  placeholder="콘텐츠의 주제를 간결하게 적어 주세요"
                  aria-invalid={invalid('title')}
                  aria-describedby={invalid('title') ? 'content-title-error' : undefined}
                />
              </Field>
              <Field
                label="분야"
                id="content-category"
                complete={!missing.includes('category')}
                onBlur={() => touch('category')}
                error={fieldError('category')}
              >
                <div className="admin-editor__inline">
                  <CategoryInput
                    value={form.category}
                    options={categories.data?.items ?? []}
                    onChange={(value) => set('category', value)}
                    pending={categories.isPending}
                    invalid={invalid('category')}
                    describedBy={invalid('category') ? 'content-category-error' : undefined}
                  />
                  <Button onClick={() => setCategoryOpen(true)}>분야 관리</Button>
                </div>
                {categories.isError && (
                  <RequestError
                    title="분야 조회 실패"
                    error={categories.error}
                    action={<Button onClick={() => void categories.refetch()}>다시 시도</Button>}
                  />
                )}
              </Field>
              <Field
                label="태그"
                id="content-tag-input"
                complete={!missing.includes('tags')}
                onBlur={() => touch('tags')}
                error={invalid('tags') && !tagError ? '태그를 하나 이상 입력해 주세요.' : undefined}
              >
                <div className="admin-editor__inline">
                  <TagInput
                    value={tagDraft}
                    options={(tagOptions.data?.items ?? []).filter(
                      (option) =>
                        !tags.some(
                          (tag) => tag.tag_id === option.tag_id || tag.name === option.name,
                        ),
                    )}
                    onChange={(value) => {
                      setTagDraft(value)
                      setTagSelection(null)
                    }}
                    onSelect={(tag) => {
                      setTagDraft(tag.name)
                      setTagSelection(tag)
                    }}
                    onAdd={addTag}
                    invalid={invalid('tags') || !!tagError}
                    describedBy={
                      tagError
                        ? 'content-tag-help'
                        : invalid('tags')
                          ? 'content-tag-input-error'
                          : 'content-tag-help'
                    }
                  />
                  <Button disabled={!canAddTag} onClick={addTag}>
                    추가
                  </Button>
                </div>
                <p
                  id="content-tag-help"
                  className={tagError ? 'admin-field-error' : 'admin-help'}
                  aria-live="polite"
                >
                  {tagError ?? 'Enter 또는 추가 버튼으로 확정한 태그만 저장돼요.'}
                </p>
                {tags.length > 0 && (
                  <div className="admin-chips">
                    {tags.map((tag, index) => (
                      <button
                        key={tag.tag_id ?? `new:${tag.name}`}
                        type="button"
                        className="admin-chip admin-chip--pick admin-is-on"
                        aria-label={`${tag.name} 태그 제거`}
                        onClick={() => setTags((current) => current.filter((_, i) => i !== index))}
                      >
                        {tag.name}
                        <Icon name="close" size={12} />
                      </button>
                    ))}
                  </div>
                )}
                {tagOptions.isError && (
                  <RequestError
                    title="태그 목록 조회 실패"
                    error={tagOptions.error}
                    action={<Button onClick={() => void tagOptions.refetch()}>다시 시도</Button>}
                  />
                )}
              </Field>
              <Field
                label="핵심 정리"
                id="content-core"
                complete={!missing.includes('core')}
                onBlur={() => touch('core')}
                error={fieldError('core')}
              >
                <textarea
                  id="content-core"
                  className="admin-input admin-input--area"
                  rows={5}
                  value={form.core}
                  onChange={(e) => set('core', e.target.value)}
                  placeholder="이 콘텐츠에서 꼭 기억해야 할 내용을 적어 주세요"
                  aria-invalid={invalid('core')}
                  aria-describedby={invalid('core') ? 'content-core-error' : undefined}
                />
              </Field>
              <div className="admin-editor__source-row">
                <Field
                  label="출처"
                  id="content-source"
                  complete={!missing.includes('source')}
                  onBlur={() => touch('source')}
                  error={fieldError('source')}
                >
                  <input
                    id="content-source"
                    className="admin-input"
                    value={form.source}
                    onChange={(e) => set('source', e.target.value)}
                    placeholder="참고 자료명 또는 링크"
                    aria-invalid={invalid('source')}
                    aria-describedby={invalid('source') ? 'content-source-error' : undefined}
                  />
                </Field>
                <Field
                  label="검토일"
                  id="content-reviewed"
                  error={reviewedError}
                  complete={!missing.includes('reviewed')}
                  onBlur={() => touch('reviewed')}
                >
                  <ReviewDateInput
                    value={form.reviewed}
                    onChange={(value) => set('reviewed', value)}
                    onBlur={() => touch('reviewed')}
                    invalid={!!reviewedError}
                    describedBy={reviewedError ? 'content-reviewed-error' : undefined}
                  />
                </Field>
              </div>
            </section>
          </div>
          <div className="admin-editor__column admin-editor__column--video">
            <section className="admin-editor__section">
              <SectionHeading
                number="02"
                title="영상 및 썸네일"
                complete={mediaTab === 'video' ? !missing.includes('video') : undefined}
              />
              <SegmentedControl
                label="영상과 썸네일 선택"
                value={mediaTab}
                options={[
                  { id: 'video', label: '영상' },
                  { id: 'thumbnail', label: '썸네일' },
                ]}
                onChange={(tab) => {
                  if (tab === 'thumbnail') videoRef.current?.pause()
                  setMediaTab(tab)
                }}
              />
              <div
                hidden={mediaTab !== 'video'}
                role="region"
                aria-label="영상 파일"
                className={`admin-editor__media-panel admin-editor__video-section${draggingFile ? ' admin-is-dragging' : ''}`}
                onDragEnter={(event) => {
                  if (!event.dataTransfer.types.includes('Files')) return
                  event.preventDefault()
                  if (savingRef.current) return
                  dragDepth.current += 1
                  setDraggingFile(true)
                }}
                onDragOver={(event) => {
                  if (!event.dataTransfer.types.includes('Files')) return
                  event.preventDefault()
                  event.dataTransfer.dropEffect =
                    savingRef.current || !policy.data ? 'none' : 'copy'
                }}
                onDragLeave={() => {
                  dragDepth.current = Math.max(0, dragDepth.current - 1)
                  if (dragDepth.current === 0) setDraggingFile(false)
                }}
                onDrop={(event) => {
                  event.preventDefault()
                  dragDepth.current = 0
                  setDraggingFile(false)
                  if (!event.dataTransfer.types.includes('Files')) return
                  selectVideo(Array.from(event.dataTransfer.files))
                }}
              >
                <div
                  className={`admin-editor__preview${invalid('video') || fileError ? ' admin-editor__preview--error' : ''}`}
                >
                  {file ? (
                    <video
                      ref={videoRef}
                      key="local-preview"
                      controls
                      preload="metadata"
                      onError={() => setPreviewError(true)}
                      aria-label="선택한 영상 미리보기"
                    />
                  ) : saved?.detail.content.video_url ? (
                    <video
                      ref={videoRef}
                      key={saved.detail.content.video_url}
                      src={saved.detail.content.video_url}
                      controls
                      preload="metadata"
                      aria-label="저장된 영상 미리보기"
                    />
                  ) : (
                    <div>
                      <Icon name="video" size={32} />
                      <strong>영상을 추가해 주세요</strong>
                      <span>지원하는 영상 파일 한 개를 여기에 끌어 놓으세요</span>
                    </div>
                  )}
                  {draggingFile && (
                    <div className="admin-editor__drop-overlay" role="status">
                      <Icon name="plus" size={28} />
                      <strong>
                        {policy.data
                          ? '여기에 영상을 놓아 주세요'
                          : '업로드 기준을 불러오는 중이에요'}
                      </strong>
                      <span>지원 형식과 용량을 확인한 후 선택돼요</span>
                    </div>
                  )}
                </div>
                {fileError && (
                  <p className="admin-field-error" id="content-video-selection-error" role="alert">
                    {fileError}
                  </p>
                )}
                {file && previewError && (
                  <p className="admin-help">
                    이 브라우저에서는 선택한 파일을 미리 볼 수 없어요. 지원 형식이면 저장 시
                    서버에서 확인해요.
                  </p>
                )}
                <label className="admin-editor__file-picker">
                  <input
                    ref={fileRef}
                    id="content-video"
                    type="file"
                    accept={policy.data?.accept ?? ''}
                    disabled={busy !== null || !policy.data}
                    aria-label={
                      saved?.detail.content.media_revision
                        ? '영상 교체 파일 선택'
                        : '영상 파일 선택'
                    }
                    aria-invalid={invalid('video') || !!fileError}
                    aria-describedby={
                      [
                        policy.data ? 'content-video-policy' : '',
                        fileError
                          ? 'content-video-selection-error'
                          : invalid('video')
                            ? 'content-video-error'
                            : '',
                      ]
                        .filter(Boolean)
                        .join(' ') || undefined
                    }
                    onChange={(event) => {
                      const selected = Array.from(event.target.files ?? [])
                      if (selected.length) selectVideo(selected)
                      event.target.value = ''
                    }}
                  />
                  <Icon name="plus" size={18} />
                  {file
                    ? '다른 파일 선택'
                    : saved?.detail.content.media_revision
                      ? '영상 교체'
                      : '영상 파일 선택'}
                </label>
                {invalid('video') && (
                  <p className="admin-field-error" id="content-video-error">
                    영상 파일을 선택해 주세요.
                  </p>
                )}
                {file && (
                  <div className="admin-editor__file-info">
                    <div>
                      <strong>{file.name}</strong>
                      <span>
                        {(file.size / 1024 / 1024).toFixed(1)} MB ·{' '}
                        {stage === 'video' ? videoStatus : '업로드 대기'}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="admin-link"
                      onClick={() => {
                        setFile(null)
                        setFileError('')
                        setPreviewError(false)
                        if (fileRef.current) fileRef.current.value = ''
                      }}
                    >
                      선택 취소
                    </button>
                  </div>
                )}
                {stage === 'video' && uploadProgress && (
                  <div className="admin-editor__upload-progress">
                    <div className="admin-editor__upload-caption">
                      <strong>{videoStatus}</strong>
                      {uploadProgress.phase === 'uploading' && uploadProgress.total !== null && (
                        <span>
                          {(uploadProgress.loaded / 1024 / 1024).toFixed(1)} /{' '}
                          {(uploadProgress.total / 1024 / 1024).toFixed(1)} MB
                        </span>
                      )}
                    </div>
                    {uploadProgress.phase === 'processing' ? (
                      <div className="admin-editor__upload-processing">
                        <Spinner label="영상 확인 및 저장 중" />
                        <span>파일 전송이 끝났어요. 서버에서 영상을 확인하고 있어요.</span>
                      </div>
                    ) : (
                      <progress
                        max={100}
                        value={uploadProgress.percent ?? undefined}
                        aria-label="영상 파일 전송률"
                      />
                    )}
                  </div>
                )}
                {policy.data && <VideoPolicyGuide policy={policy.data} />}
                {policy.isError && (
                  <RequestError
                    title="영상 업로드 기준 조회 실패"
                    error={policy.error}
                    action={<Button onClick={() => void policy.refetch()}>다시 시도</Button>}
                  />
                )}
                {saved?.detail.content.media_revision && (
                  <p className="admin-help">영상 교체 후에도 기존 학습 기록은 유지돼요.</p>
                )}
                {saved && (
                  <ContentLifecycleActions
                    content={saved}
                    disabled={saveBusy !== null || videoUpload.recovery !== null || editConflict}
                    dirty={dirty || tagDraft.trim().length > 0}
                    onUpdated={(latest) => {
                      setSaved(latest)
                      editorDrafts.delete(draftKey)
                      show(
                        latest.detail.content.status === 'PRIVATE'
                          ? '비공개로 전환했어요.'
                          : '다시 공개했어요.',
                      )
                    }}
                    onDeleted={(result) => {
                      editorDrafts.delete(draftKey)
                      if (embedded?.onDeleted) embedded.onDeleted(result.file_cleanup_pending)
                      else
                        navigate('/admin/contents', {
                          replace: true,
                          state: { contentDeleted: { pending: result.file_cleanup_pending } },
                        })
                    }}
                    onBusyChange={setControlBusy}
                    onReload={reloadAfterConflict}
                  />
                )}
              </div>
              <div hidden={mediaTab !== 'thumbnail'} role="region" aria-label="썸네일 이미지">
                <ContentThumbnailInput
                  key={thumbnailRevision}
                  file={thumbnailFile}
                  remove={removeThumbnail}
                  savedUrl={saved?.detail.content.thumbnail_url}
                  refreshKey={thumbnailRevision}
                  disabled={busy !== null || videoUpload.recovery !== null || editConflict}
                  uploading={stage === 'thumbnail'}
                  onChange={(file, remove) => {
                    setThumbnailFile(file)
                    setRemoveThumbnail(remove)
                    setError('')
                  }}
                />
              </div>
            </section>
          </div>
          <div className="admin-editor__column admin-editor__column--caution">
            {' '}
            <section className="admin-editor__section">
              <SectionHeading
                number="03"
                title="추가 안내"
                description="학습자가 참고할 주의 사항을 설정할 수 있어요."
              />
              <label className="admin-editor__check">
                <input
                  type="checkbox"
                  checked={form.caution}
                  onChange={(e) => set('caution', e.target.checked)}
                />
                주의 문구 표시
              </label>
              {form.caution && (
                <Field
                  label="주의 문구"
                  id="content-caution"
                  onBlur={() => touch('cautionText')}
                  error={fieldError('cautionText')}
                >
                  <textarea
                    id="content-caution"
                    className="admin-input admin-input--area"
                    rows={3}
                    value={form.cautionText}
                    onChange={(e) => set('cautionText', e.target.value)}
                    aria-invalid={cautionInvalid}
                    aria-describedby={cautionInvalid ? 'content-caution-error' : undefined}
                  />
                </Field>
              )}
              <p className="admin-help">
                관련 시리즈:{' '}
                {saved?.detail.related_curriculums.map((item) => item.title).join(', ') ||
                  '연결된 시리즈 없음'}
              </p>
            </section>
          </div>
        </div>
      </fieldset>
      <div className="admin-editor__savebar">
        <div className="admin-editor__save-status" role="status" aria-live="polite">
          {busy && stage ? (
            <>
              <Spinner label={activeStageLabel} />
              <strong>{activeStageLabel}</strong>
              <span>
                {stage === 'video'
                  ? '요청을 중단하면 영상 저장 결과를 별도로 확인해요.'
                  : '완료될 때까지 이 화면을 유지해 주세요.'}
              </span>
            </>
          ) : (
            <>
              <strong>
                {videoUpload.recovery
                  ? '영상 저장 결과를 확인해 주세요'
                  : dirty
                    ? '저장하지 않은 변경이 있어요'
                    : saved
                      ? '현재 내용이 저장돼 있어요'
                      : '새 콘텐츠를 작성하고 있어요'}
              </strong>
              <span>
                {!saved
                  ? '임시저장하면 학습자료 연결과 공개가 가능해요.'
                  : missing.length
                    ? `공개 준비: ${missing.map((key) => publishFields.find((item) => item.key === key)!.label).join(' · ')} 필요`
                    : '공개 필수 항목이 입력됐어요.'}
              </span>
            </>
          )}
        </div>
        <div className="admin-editor__save-actions">
          <VideoUploadFeedback
            upload={videoUpload}
            busy={busy !== null}
            fileName={file?.name}
            contentTitle={form.title}
            onRetry={(latest) => {
              setSaved(latest)
              videoUpload.dismissRecovery()
              save(false, latest)
            }}
            onUseCurrent={(latest) => {
              setSaved(latest)
              setFile(null)
              setPreviewError(false)
              if (fileRef.current) fileRef.current.value = ''
              videoUpload.dismissRecovery()
              contentSave.reset()
            }}
          />
          {busy && stage === 'video' && !videoUpload.recovery && (
            <Button onClick={videoUpload.cancel}>
              {uploadProgress?.phase === 'processing' ? '응답 대기 종료' : '업로드 요청 취소'}
            </Button>
          )}
          <Button
            disabled={!saved || busy !== null}
            onClick={() => {
              if (embedded) {
                embedded.onOpenMaterials()
                return
              }
              if (dirty) setConfirmMaterials(true)
              else navigate(`/admin/materials/${saved!.detail.content.content_id}`)
            }}
          >
            학습자료
          </Button>
          <Button
            variant={saved ? 'default' : 'primary'}
            onClick={() => void save(false)}
            loading={busy === 'save'}
            disabled={
              editConflict || busy !== null || actorId === null || videoUpload.recovery !== null
            }
          >
            {saved ? '변경 저장' : '임시저장'}
          </Button>
          <span
            className={`admin-editor__publish-action${publishDisabled ? ' admin-is-disabled' : ''}`}
            tabIndex={publishHint ? 0 : undefined}
            aria-label={publishHint ? '공개 불가 안내' : undefined}
            aria-describedby={publishHint ? 'content-publish-hint' : undefined}
          >
            <Button
              variant="primary"
              onClick={() => void save(true)}
              loading={busy === 'publish'}
              disabled={publishDisabled}
            >
              {saved?.detail.content.status === 'PUBLISHED' ? '저장 후 공개' : '공개'}
            </Button>
            {publishHint && (
              <span id="content-publish-hint" role="tooltip" className="admin-editor__publish-hint">
                {publishHint}
              </span>
            )}
          </span>
        </div>
      </div>
      <ConfirmDialog
        open={confirmMaterials}
        title="저장하지 않은 변경이 있어요."
        cancelLabel="계속 작성"
        confirmLabel="저장 없이 이동"
        busy={busy !== null}
        onCancel={() => setConfirmMaterials(false)}
        onConfirm={() => {
          if (!saved || savingRef.current) return
          setConfirmMaterials(false)
          navigate(`/admin/materials/${saved.detail.content.content_id}`)
        }}
      >
        <p>저장 없이 학습자료로 이동할까요?</p>
        <p>작성 내용은 현재 브라우저 탭에 유지돼요.</p>
      </ConfirmDialog>
      {categoryOpen && (
        <CategoryDialog
          onClose={() => setCategoryOpen(false)}
          onCreated={(category) => set('category', String(category.category_id))}
        />
      )}
      {node}
    </div>
  )
}
