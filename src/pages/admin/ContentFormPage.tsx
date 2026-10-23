import { useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { api, queryString, type ApiPage } from '../../api/client'
import {
  adminError,
  useAdminQuery,
  type AdminCategory,
  type AdminTag,
  type EditableContent,
  type UploadedVideo,
  type VideoPolicy,
} from '../../api/admin'
import { useSession } from '../../state/session'
import { Badge, Button, Spinner, StateBlock } from '../../shared/ui'
import { useToast } from '../../shared/useToast'

export function ContentFormPage() {
  const { id } = useParams()
  const { actorId } = useSession()
  const detail = useAdminQuery<EditableContent>(id ? `/contents/${id}?view=editor` : null)
  if (id && detail.isPending)
    return (
      <div className="sasu-page">
        <Spinner label="콘텐츠를 불러오는 중" />
      </div>
    )
  if (id && detail.isError && detail.data === undefined)
    return (
      <div className="sasu-page">
        <StateBlock
          title="콘텐츠를 불러오지 못했어요."
          text={detail.error.message}
          action={<Button onClick={() => void detail.refetch()}>다시 시도</Button>}
        />
      </div>
    )
  return (
    <>
      {id && detail.isError ? (
        <StateBlock
          title="최신 콘텐츠 정보를 불러오지 못했어요. 작성 중인 내용은 유지돼요."
          text={detail.error.message}
          action={<Button onClick={() => void detail.refetch()}>다시 시도</Button>}
        />
      ) : null}
      <ContentEditor key={`${actorId}:${id ?? 'new'}`} initial={id ? detail.data : undefined} />
    </>
  )
}

function ContentEditor({ initial }: { initial?: EditableContent }) {
  const { actorId, generation } = useSession()
  const navigate = useNavigate()
  const cache = useQueryClient()
  const { show, node } = useToast()
  const categories = useAdminQuery<{ items: AdminCategory[] }>('/categories')
  const policy = useAdminQuery<VideoPolicy>('/contents/video-policy')
  const [saved, setSaved] = useState(initial)
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState<'save' | 'publish' | null>(null)
  const [error, setError] = useState('')
  const [warning, setWarning] = useState('')
  const [tags, setTags] = useState<{ tag_id?: number; name: string }[]>(
    initial?.detail.content.tags ?? [],
  )
  const [tagDraft, setTagDraft] = useState('')
  const tagOptions = useAdminQuery<ApiPage<AdminTag>>(
    `/tags${queryString({ q: tagDraft.trim(), size: 20 })}`,
  )
  const [form, setForm] = useState({
    title: initial?.detail.content.title ?? '',
    category: initial?.detail.content.category?.category_id.toString() ?? '',
    core: initial?.detail.core_content ?? '',
    source: initial?.detail.source ?? '',
    reviewed: initial?.detail.reviewed_on ?? '',
    caution: initial?.detail.caution_enabled ?? false,
    cautionText: initial?.detail.caution_text ?? '',
  })
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }))
  const withDraftTag = () => {
    const name = tagDraft.trim()
    if (!name || tags.some((tag) => tag.name === name)) return tags
    return [...tags, tagOptions.data?.items.find((tag) => tag.name === name) ?? { name }]
  }
  const addTag = () => {
    setTags(withDraftTag())
    setTagDraft('')
  }
  const refreshSaved = async () => {
    if (!saved || actorId === null) return
    try {
      const latest = await api<EditableContent>(
        `/contents/${saved.detail.content.content_id}?view=editor`,
        { actorId },
      )
      setSaved(latest)
      setWarning('')
    } catch (cause) {
      setWarning(`저장된 영상 정보를 다시 불러오지 못했어요. ${adminError(cause)}`)
    }
  }
  const save = async (publish: boolean) => {
    if (busy || actorId === null) return
    const chosenTags = withDraftTag()
    if (
      publish &&
      (!form.title.trim() ||
        !form.category ||
        !chosenTags.length ||
        !form.core.trim() ||
        !form.source.trim() ||
        !form.reviewed ||
        (!file && !saved?.detail.content.media_revision))
    ) {
      setError('영상·제목·분야·태그·핵심 정리·출처·검토일을 모두 입력해 주세요.')
      return
    }
    if (form.caution && !form.cautionText.trim()) {
      setError('주의 문구를 입력해 주세요.')
      return
    }
    setBusy(publish ? 'publish' : 'save')
    setError('')
    setWarning('')
    let current = saved
    const expectedRevision = saved?.detail.content.media_revision
    try {
      if (chosenTags.some((tag) => tag.tag_id === undefined && tag.name.length > 30))
        throw new Error('태그는 각각 30자 이내로 입력해 주세요.')
      const resolvedTags: AdminTag[] = []
      for (const tag of chosenTags)
        resolvedTags.push(
          tag.tag_id === undefined
            ? await api<AdminTag>('/tags', { method: 'POST', actorId, body: { name: tag.name } })
            : { tag_id: tag.tag_id, name: tag.name },
        )
      const uniqueTags = [...new Map(resolvedTags.map((tag) => [tag.tag_id, tag])).values()]
      setTags(uniqueTags)
      setTagDraft('')
      const body = {
        title: form.title.trim() || null,
        category_id: form.category ? Number(form.category) : null,
        tag_ids: uniqueTags.map((tag) => tag.tag_id),
        core_content: form.core.trim() || null,
        source: form.source.trim() || null,
        reviewed_on: form.reviewed || null,
        caution_enabled: form.caution,
        caution_text: form.cautionText.trim() || null,
      }
      current = await api<EditableContent>(
        current ? `/contents/${current.detail.content.content_id}` : '/contents',
        { method: current ? 'PATCH' : 'POST', actorId, body },
      )
      setSaved(current)
      // Persist the new content ID before attempting upload so retry never creates a second draft.
      if (file) {
        const data = new FormData()
        data.append('file', file)
        if (expectedRevision) data.append('expected_media_revision', expectedRevision)
        const uploaded = await api<UploadedVideo>(
          `/contents/${current.detail.content.content_id}/video`,
          {
            method: 'PUT',
            actorId,
            body: data,
          },
        )
        current = {
          ...current,
          detail: { ...current.detail, content: { ...current.detail.content, ...uploaded } },
          missing_for_publish: current.missing_for_publish.filter((field) => field !== 'video'),
        }
        setSaved(current)
        setFile(null)
        try {
          current = await api<EditableContent>(
            `/contents/${current.detail.content.content_id}?view=editor`,
            { actorId },
          )
          setSaved(current)
        } catch {
          setWarning('영상은 저장됐어요. 최신 콘텐츠 정보를 다시 불러와 주세요.')
        }
      }
      if (publish) {
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
      await cache.invalidateQueries()
      show(publish ? '공개했어요.' : '저장했어요.')
      if (!initial)
        navigate(`/admin/contents/${current.detail.content.content_id}`, { replace: true })
    } catch (cause) {
      setError(adminError(cause))
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
        await cache.invalidateQueries()
      }
    } finally {
      setBusy(null)
    }
  }
  return (
    <div className="sasu-page sasu-form">
      <div className="sasu-review__top">
        <button type="button" className="sasu-link" onClick={() => navigate('/admin/contents')}>
          ← 콘텐츠 목록으로
        </button>
        <Badge tone={saved?.detail.content.status === 'PUBLISHED' ? 'green' : 'neutral'}>
          {saved?.detail.content.status === 'PUBLISHED' ? '공개' : '임시저장'}
        </Badge>
      </div>
      <header className="sasu-page__head">
        <p className="sasu-eyebrow">관리자 · 콘텐츠</p>
        <h1 className="sasu-title">{saved ? '콘텐츠 수정' : '콘텐츠 등록'}</h1>
        <p className="sasu-sub">
          별표 항목은 공개에 필요해요. 초안은 작성 중에도 저장할 수 있어요.
        </p>
      </header>
      {error ? (
        <p className="sasu-field-error" role="alert">
          {error}
        </p>
      ) : null}
      {warning ? (
        <div role="status">
          <p>{warning}</p>
          <Button disabled={busy !== null} onClick={() => void refreshSaved()}>
            최신 정보 다시 불러오기
          </Button>
        </div>
      ) : null}
      <fieldset disabled={busy !== null} style={{ border: 0, padding: 0, margin: 0 }}>
        <div className="sasu-form__grid">
          <section className="sasu-card">
            <Field label="제목 *">
              <input
                className="sasu-input"
                maxLength={200}
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
              />
            </Field>
            <Field label="분야 *">
              <select
                className="sasu-input"
                value={form.category}
                onChange={(e) => set('category', e.target.value)}
              >
                <option value="">선택</option>
                {categories.data?.items.map((c) => (
                  <option key={c.category_id} value={c.category_id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {categories.isError ? (
                <p role="alert">
                  분야를 불러오지 못했어요.{' '}
                  <button type="button" onClick={() => void categories.refetch()}>
                    다시 시도
                  </button>
                </p>
              ) : null}
              <Button size="sm" onClick={() => navigate('/admin/categories')}>
                분야 관리
              </Button>
            </Field>
            <div className="sasu-field sasu-field--block">
              <label className="sasu-field__label" htmlFor="content-tag-input">
                태그 *
              </label>
              <div className="sasu-chips">
                {tags.map((tag, index) => (
                  <button
                    key={tag.tag_id ?? `new:${tag.name}`}
                    type="button"
                    className="sasu-chip sasu-chip--pick is-on"
                    title={`${tag.name} 태그 제거`}
                    onClick={() =>
                      setTags((currentTags) => currentTags.filter((_, i) => i !== index))
                    }
                  >
                    {tag.name} ×
                  </button>
                ))}
              </div>
              <div className="sasu-row sasu-row--tight">
                <input
                  id="content-tag-input"
                  className="sasu-input"
                  list="content-tag-options"
                  maxLength={30}
                  value={tagDraft}
                  onChange={(e) => setTagDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addTag()
                    }
                  }}
                  placeholder="태그를 하나씩 입력하거나 선택해 주세요"
                />
                <datalist id="content-tag-options">
                  {tagOptions.data?.items.map((tag) => (
                    <option key={tag.tag_id} value={tag.name} />
                  ))}
                </datalist>
                <Button size="sm" disabled={!tagDraft.trim()} onClick={addTag}>
                  추가
                </Button>
              </div>
              {tagOptions.isError ? (
                <p role="alert">
                  태그 목록을 불러오지 못했어요. 기존 선택은 유지돼요.{' '}
                  <button type="button" onClick={() => void tagOptions.refetch()}>
                    다시 시도
                  </button>
                </p>
              ) : null}
            </div>
            <Field label="핵심 정리 *">
              <textarea
                className="sasu-input sasu-input--area"
                rows={3}
                value={form.core}
                onChange={(e) => set('core', e.target.value)}
              />
            </Field>
            <Field label="출처 *">
              <input
                className="sasu-input"
                value={form.source}
                onChange={(e) => set('source', e.target.value)}
              />
            </Field>
            <Field label="검토일 *">
              <input
                className="sasu-input"
                type="date"
                value={form.reviewed}
                onChange={(e) => set('reviewed', e.target.value)}
              />
            </Field>
          </section>
          <section className="sasu-card">
            <h2 className="sasu-card__title">영상 *</h2>
            <div className="sasu-form__media">
              {saved?.detail.content.video_url ? (
                <video
                  key={saved.detail.content.video_url}
                  src={saved.detail.content.video_url}
                  controls
                  preload="metadata"
                  style={{ width: '100%', maxHeight: 320 }}
                />
              ) : (
                <span className="sasu-muted">아직 영상이 없어요</span>
              )}
            </div>
            <label className="sasu-field">
              <span className="sasu-field__label">
                {saved?.detail.content.media_revision ? '영상 교체' : '파일 선택'}
              </span>
              <input
                type="file"
                accept={policy.data?.accept ?? 'video/*'}
                onChange={(e) => {
                  const selected = e.target.files?.[0] ?? null
                  if (selected && policy.data && selected.size > policy.data.max_bytes) {
                    setFile(null)
                    setError('허용 용량보다 큰 파일이에요.')
                    e.target.value = ''
                    return
                  }
                  setFile(selected)
                  setError('')
                }}
              />
            </label>
            {file ? (
              <p className="sasu-help">선택한 파일: {file.name} · 저장할 때 업로드해요.</p>
            ) : null}
            {policy.data ? (
              <p className="sasu-help">
                최대 {Math.round(policy.data.max_bytes / 1024 / 1024)}MB ·{' '}
                {policy.data.min_duration_sec}~{policy.data.max_duration_sec}초<br />
                {policy.data.formats.join(' / ')}
              </p>
            ) : null}
            {saved?.detail.content.media_revision ? (
              <p className="sasu-help">영상을 교체해도 기존 학습 기록은 유지돼요.</p>
            ) : null}
            <hr className="sasu-hr" />
            <h2 className="sasu-card__title">학습 패널 표시 자료</h2>
            <label>
              <input
                type="checkbox"
                checked={form.caution}
                onChange={(e) => set('caution', e.target.checked)}
              />{' '}
              주의 문구 표시
            </label>
            {form.caution ? (
              <Field label="주의 문구">
                <textarea
                  className="sasu-input"
                  value={form.cautionText}
                  onChange={(e) => set('cautionText', e.target.value)}
                />
              </Field>
            ) : null}
            <p className="sasu-help">
              관련 시리즈:{' '}
              {saved?.detail.related_curriculums.map((c) => c.title).join(', ') ||
                '연결된 시리즈 없음'}
            </p>
          </section>
        </div>
      </fieldset>
      <div className="sasu-row sasu-form__actions">
        <Button
          variant="primary"
          onClick={() => void save(false)}
          loading={busy === 'save'}
          disabled={busy !== null || actorId === null}
        >
          {saved ? '변경 저장' : '임시저장'}
        </Button>
        <Button
          disabled={!saved || busy !== null}
          onClick={() => navigate(`/admin/materials/${saved!.detail.content.content_id}`)}
        >
          학습자료 관리
        </Button>
        <Button
          variant="primary"
          onClick={() => void save(true)}
          loading={busy === 'publish'}
          disabled={!saved || busy !== null}
        >
          공개
        </Button>
      </div>
      <p className="sasu-help">
        초안을 저장한 뒤 공개를 선택해 주세요. 퀴즈가 없어도 공개할 수 있어요.
      </p>
      {node}
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="sasu-field sasu-field--block">
      <span className="sasu-field__label">{label}</span>
      {children}
    </label>
  )
}
