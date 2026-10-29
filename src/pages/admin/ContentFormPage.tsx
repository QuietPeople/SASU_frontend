import type { ContentSubview } from '../../admin/contentSubview'
import { RequestError } from '../../admin/RequestFeedback'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { invalidateContentChange } from '../../api/queryInvalidation'
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
import { Badge, Button, Spinner } from '../../admin/ui'
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
  resolveContentTags,
  contentMetadataBody,
  contentFieldError,
  type TextField,
  addContentTag,
  publishFields,
  type ContentFields,
  type ContentTag,
  type PublishField,
} from '../../admin/contentEditor'
import { uploadVideo, type VideoUploadProgress } from '../../admin/uploadVideo'
import '../../admin/content-editor.css'

export function ContentFormPage({ embedded }: { embedded?: ContentSubview } = {}) {
  const { id: routeId } = useParams()
  const id = embedded ? String(embedded.contentId) : routeId
  const { actorId, generation } = useSession()
  const detail = useAdminQuery<EditableContent>(id ? `/contents/${id}?view=editor` : null)
  if (id && detail.isPending)
    return (
      <div className="admin-page">
        <Spinner label="콘텐츠를 불러오는 중" />
      </div>
    )
  if (id && detail.isError && detail.data === undefined)
    return (
      <div className="admin-page">
        <RequestError
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
  saved?: EditableContent
  baseline: string
}
// 화면 이동 동안만 보존한다. 사용자·기록 세대별로 분리하며 파일을 서버나 브라우저 저장소에 자동 업로드하지 않는다.
const editorDrafts = new Map<string, EditorDraft>()
type SaveStage = 'tags' | 'metadata' | 'video' | 'publish'
const stageLabels: Record<SaveStage, string> = {
  tags: '태그 확인 중',
  metadata: '콘텐츠 정보 저장 중',
  video: '영상 전송 중',
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
  const cache = useQueryClient()
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
        saved: initial,
        baseline: contentSignature(initialFields(initial), initial?.detail.content.tags ?? []),
      },
  )
  const [saved, setSaved] = useState(seed.saved)
  const [file, setFile] = useState<File | null>(seed.file)
  const [form, setForm] = useState(seed.form)
  const [tags, setTags] = useState(seed.tags)
  const [tagDraft, setTagDraft] = useState(seed.tagDraft)
  const [tagSelection, setTagSelection] = useState<AdminTag | null>(seed.tagSelection ?? null)
  const [baseline, setBaseline] = useState(seed.baseline)
  const [stage, setStage] = useState<SaveStage | null>(null)
  const [uploadProgress, setUploadProgress] = useState<VideoUploadProgress | null>(null)
  const [error, setError] = useState('')
  const [warning, setWarning] = useState('')
  const [showFieldErrors, setShowFieldErrors] = useState(false)
  const [categoryOpen, setCategoryOpen] = useState(false)
  const [touched, setTouched] = useState<Partial<Record<TextField | 'tags', boolean>>>({})
  const [previewError, setPreviewError] = useState(false)
  const [fileError, setFileError] = useState('')
  const [draggingFile, setDraggingFile] = useState(false)
  const dragDepth = useRef(0)
  const videoRef = useRef<HTMLVideoElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const savingRef = useRef(false)
  const saveMutation = useMutation({
    mutationFn: persistContent,
    onSettled: () => {
      savingRef.current = false
      setStage(null)
      setUploadProgress(null)
    },
  })
  const busy = saveMutation.isPending
    ? saveMutation.variables?.publish
      ? 'publish'
      : 'save'
    : null
  const requestError = saveMutation.error
  const tagOptions = useAdminQuery<ApiPage<AdminTag>>(tagSearchPath(tagDraft))
  const pendingTag = resolveContentTag(tagSelection ?? tagDraft, [
    ...tags,
    ...(tagOptions.data?.items ?? []),
  ])
  const selectedTagError = tags.map((tag) => tagInputError(tag)).find(Boolean)
  const tagError = (tagDraft ? tagInputError(pendingTag) : null) ?? selectedTagError
  const canAddTag = tagInputError(pendingTag) === null
  const dirty = file !== null || !!tagDraft.trim() || contentSignature(form, tags) !== baseline
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
  const videoStatus =
    uploadProgress?.phase === 'processing'
      ? '영상 확인 및 저장 중…'
      : uploadProgress?.percent != null
        ? `업로드 중 ${uploadProgress.percent}%`
        : '영상 전송 중…'
  const activeStageLabel = stage === 'video' ? videoStatus : stage ? stageLabels[stage] : ''
  const reviewedError = fieldError('reviewed')
  const cautionInvalid = form.caution && !!fieldError('cautionText')
  const publishDisabled = !saved || missing.length > 0 || busy !== null || actorId === null
  const publishHint = busy
    ? '처리가 끝날 때까지 기다려 주세요'
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
      editorDrafts.set(draftKey, { form, tags, tagDraft, tagSelection, file, saved, baseline })
    else editorDrafts.delete(draftKey)
  }, [draftKey, dirty, initial, form, tags, tagDraft, tagSelection, file, saved, baseline])
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
    const field = document.getElementById(publishFields.find((item) => item.key === key)!.input)
    field?.focus()
    field?.scrollIntoView({ block: 'center', behavior: 'auto' })
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
      setWarning(`저장된 영상 정보를 다시 불러오지 못했어요. ${adminError(cause)}`)
    }
  }
  const save = (publish: boolean) => {
    if (savingRef.current || actorId === null) return
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
    savingRef.current = true
    saveMutation.mutate({ publish, actorId })
  }
  async function persistContent({ publish, actorId }: { publish: boolean; actorId: number }) {
    setUploadProgress(null)
    setError('')
    setWarning('')
    let current = saved
    let completedMetadata = false
    let tagsChanged = false
    const operation: { stage: SaveStage } = { stage: 'tags' }
    const startStage = (next: SaveStage) => {
      operation.stage = next
      setStage(next)
    }
    try {
      startStage('tags')
      const uniqueTags = await resolveContentTags(tags, async (name) => {
        const tag = await api<AdminTag>('/tags', { method: 'POST', actorId, body: { name } })
        tagsChanged = true
        return tag
      })
      setTags(uniqueTags)
      setTagDraft('')
      startStage('metadata')
      current = await api<EditableContent>(
        current ? `/contents/${current.detail.content.content_id}` : '/contents',
        {
          method: current ? 'PATCH' : 'POST',
          actorId,
          body: contentMetadataBody(form, uniqueTags),
        },
      )
      setSaved(current)
      setBaseline(contentSignature(form, uniqueTags))
      completedMetadata = true
      if (file) {
        startStage('video')
        const uploaded = await uploadVideo({
          contentId: current.detail.content.content_id,
          actorId,
          file,
          expectedMediaRevision: saved?.detail.content.media_revision,
          onProgress: setUploadProgress,
        })
        current = {
          ...current,
          detail: { ...current.detail, content: { ...current.detail.content, ...uploaded } },
          missing_for_publish: current.missing_for_publish.filter((field) => field !== 'video'),
        }
        setSaved(current)
        setFile(null)
        setPreviewError(false)
        if (fileRef.current) fileRef.current.value = ''
        try {
          current = await api<EditableContent>(
            `/contents/${current.detail.content.content_id}?view=editor`,
            { actorId },
          )
          setSaved(current)
        } catch {
          setWarning('영상은 저장됐어요. 최신 정보를 다시 불러와 주세요.')
        }
      }
      if (publish) {
        startStage('publish')
        current = await api<EditableContent>(
          `/contents/${current.detail.content.content_id}/publish`,
          { method: 'POST', actorId },
        )
        setSaved(current)
      }
      cache.setQueryData(
        [
          'admin',
          actorId,
          generation,
          `/contents/${current.detail.content.content_id}?view=editor`,
        ],
        current,
      )
      await invalidateContentChange(cache, {
        contentId: current.detail.content.content_id,
        tagsChanged,
      })
      setShowFieldErrors(false)
      show(publish ? '공개했어요.' : '저장했어요.')
      editorDrafts.delete(draftKey)
      if (!initial && !embedded)
        navigate(`/admin/contents/${current.detail.content.content_id}`, { replace: true })
      return current
    } catch (cause) {
      const prefix = completedMetadata
        ? operation.stage === 'video'
          ? '콘텐츠 정보는 저장됐지만 영상 업로드에 실패했어요. 선택한 파일은 유지돼요. '
          : operation.stage === 'publish'
            ? '콘텐츠는 저장됐지만 공개에 실패했어요. '
            : ''
        : ''
      if (current) {
        cache.setQueryData(
          [
            'admin',
            actorId,
            generation,
            `/contents/${current.detail.content.content_id}?view=editor`,
          ],
          current,
        )
      }
      if (completedMetadata || tagsChanged)
        await invalidateContentChange(cache, {
          contentId: completedMetadata ? current?.detail.content.content_id : undefined,
          tagsChanged,
        })
      throw new Error(`${prefix}${adminError(cause)}`, { cause })
    }
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
          <Badge tone={saved?.detail.content.status === 'PUBLISHED' ? 'green' : 'neutral'}>
            {saved
              ? saved.detail.content.status === 'PUBLISHED'
                ? '공개'
                : '임시저장'
              : '작성 중'}
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
      {requestError && (
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
      <fieldset disabled={busy !== null} className="admin-editor__fieldset">
        <legend className="admin-sr">콘텐츠 작성</legend>
        <div className="admin-editor__grid">
          <div className="admin-editor__column">
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
          <div className="admin-editor__column">
            <section
              className={`admin-editor__section admin-editor__video-section${draggingFile ? ' admin-is-dragging' : ''}`}
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
                event.dataTransfer.dropEffect = savingRef.current || !policy.data ? 'none' : 'copy'
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
              <SectionHeading number="02" title="영상" complete={!missing.includes('video')} />
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
                  이 브라우저에서는 선택한 파일을 미리 볼 수 없어요. 지원 형식이면 저장 시 서버에서
                  확인해요.
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
                    saved?.detail.content.media_revision ? '영상 교체 파일 선택' : '영상 파일 선택'
                  }
                  aria-invalid={invalid('video') || !!fileError}
                  aria-describedby={
                    fileError
                      ? 'content-video-selection-error'
                      : invalid('video')
                        ? 'content-video-error'
                        : undefined
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
              {policy.data && (
                <div className="admin-editor__policy">
                  <span>최대 {Math.round(policy.data.max_bytes / 1024 / 1024)} MB</span>
                  <span>
                    {policy.data.min_duration_sec}–{policy.data.max_duration_sec}초
                  </span>
                  <details>
                    <summary>지원 형식 확인</summary>
                    <ul>
                      {policy.data.formats.map((format) => (
                        <li key={format}>{format}</li>
                      ))}
                    </ul>
                  </details>
                </div>
              )}
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
              <span>완료될 때까지 이 화면을 유지해 주세요.</span>
            </>
          ) : (
            <>
              <strong>
                {dirty
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
          <Button
            disabled={!saved || busy !== null}
            onClick={() => {
              if (embedded) {
                embedded.onOpenMaterials()
                return
              }
              if (
                !dirty ||
                window.confirm(
                  '저장하지 않은 변경이 있어요. 학습자료로 이동할까요? 작성 내용은 이 탭에 유지돼요.',
                )
              )
                navigate(`/admin/materials/${saved!.detail.content.content_id}`)
            }}
          >
            학습자료
          </Button>
          <Button
            variant={saved ? 'default' : 'primary'}
            onClick={() => void save(false)}
            loading={busy === 'save'}
            disabled={busy !== null || actorId === null}
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

function SectionHeading({
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
function Field({
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
