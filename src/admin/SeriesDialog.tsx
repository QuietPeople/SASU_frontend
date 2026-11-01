import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { invalidateCurriculumChange } from '../api/queryInvalidation'
import { api } from '../api/client'
import {
  adminError,
  useAdminPages,
  useAdminQuery,
  type AdminContent,
  type CurriculumDetail,
} from '../api/admin'
import { useSession } from '../state/session'
import { RequestError, RequestFeedback } from './RequestFeedback'
import { AutocompleteInput } from './AutocompleteInput'
import { SegmentedControl } from './SegmentedControl'
import { Icon } from './Icon'
import { Button, Spinner } from './ui'
import { useToast } from './useToast'
import {
  addSeriesStep,
  initialSeries,
  moveSeriesStep,
  saveSeries,
  seriesDirty,
  seriesInfo,
  seriesNameError,
  stepWarnings,
  type SeriesFields,
  type SeriesSession,
} from './seriesEditor'

// 화면을 벗어나도 입력과 부분 저장된 ID를 유지한다. 새로고침 이후에는 서버 저장분만 남는다.
const drafts = new Map<string, SeriesSession>()

export function SeriesDialog({ id, onClose }: { id: number | 'new'; onClose: () => void }) {
  const { actorId } = useSession()
  const ref = useRef<HTMLDialogElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const continueButton = useRef<HTMLButtonElement>(null)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  const candidates = useAdminPages<AdminContent>('/contents?status=ALL')
  const detail = useAdminQuery<CurriculumDetail>(
    id === 'new' ? null : `/curriculums/${id}?view=editor`,
  )
  const ready = candidates.data !== undefined && (id === 'new' || detail.data !== undefined)
  const error = candidates.error ?? (id === 'new' ? null : detail.error)
  const requestClose = () => {
    if (busy) return
    if (dirty) setConfirmClose(true)
    else onClose()
  }
  useEffect(() => {
    const dialog = ref.current!
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.showModal()
    closeButton.current?.focus()
    return () => {
      dialog.close()
      document.body.style.overflow = overflow
      previous?.focus({ preventScroll: true })
    }
  }, [])
  useEffect(() => {
    if (confirmClose) continueButton.current?.focus()
  }, [confirmClose])
  return (
    <dialog
      ref={ref}
      className="admin-series-dialog"
      aria-labelledby="series-dialog-title"
      onCancel={(event) => {
        event.preventDefault()
        if (confirmClose) setConfirmClose(false)
        else requestClose()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) requestClose()
      }}
    >
      <header className="admin-series-dialog__header">
        <div>
          <p>{id === 'new' ? '새 시리즈' : '시리즈 편집'}</p>
          <h2 id="series-dialog-title">
            {id === 'new'
              ? '학습할 순서를 만들어 보세요'
              : (detail.data?.summary.title ?? '시리즈 불러오는 중')}
          </h2>
        </div>
        <button
          ref={closeButton}
          type="button"
          className="admin-series__icon-button"
          aria-label="시리즈 편집 닫기"
          disabled={busy}
          onClick={requestClose}
        >
          <Icon name="close" />
        </button>
      </header>
      {confirmClose && (
        <div className="admin-series-dialog__confirm" role="alert">
          <div>
            <strong>저장하지 않은 변경이 있어요.</strong>
            <p>입력은 이 탭에 임시 보관돼요. 새로고침하면 사라져요.</p>
          </div>
          <div className="admin-row">
            <button
              ref={continueButton}
              type="button"
              className="admin-btn admin-btn--primary"
              onClick={() => {
                setConfirmClose(false)
                closeButton.current?.focus()
              }}
            >
              계속 작성
            </button>
            <Button onClick={onClose}>저장 없이 닫기</Button>
          </div>
        </div>
      )}
      <RequestFeedback>
        {error && (
          <RequestError
            title={
              ready
                ? '최신 정보를 불러오지 못했어요. 작성 중인 내용은 유지돼요.'
                : '시리즈 정보를 불러오지 못했어요.'
            }
            error={error}
            action={
              <Button
                onClick={() => {
                  void candidates.refetch()
                  if (id !== 'new') void detail.refetch()
                }}
              >
                다시 시도
              </Button>
            }
          />
        )}
        {ready ? (
          <SeriesEditor
            key={`${actorId}:${id}`}
            draftKey={`${actorId}:${id}`}
            initial={id === 'new' ? undefined : detail.data}
            candidates={candidates.data!}
            onDirtyChange={setDirty}
            onBusyChange={setBusy}
            onClose={requestClose}
            onLeave={onClose}
          />
        ) : (
          !error && (
            <div className="admin-series-dialog__loading">
              <Spinner />
            </div>
          )
        )}
      </RequestFeedback>
    </dialog>
  )
}

function SeriesEditor({
  draftKey,
  initial,
  candidates,
  onDirtyChange,
  onBusyChange,
  onClose,
  onLeave,
}: {
  draftKey: string
  initial?: CurriculumDetail
  candidates: AdminContent[]
  onDirtyChange: (dirty: boolean) => void
  onBusyChange: (busy: boolean) => void
  onClose: () => void
  onLeave: () => void
}) {
  const { actorId } = useSession()
  const cache = useQueryClient()
  const navigate = useNavigate()
  const { show, node } = useToast()
  const [restored] = useState(() => drafts.has(draftKey))
  const [session, setSession] = useState(() => drafts.get(draftKey) ?? initialSeries(initial))
  const { fields, savedId } = session
  const dirty = seriesDirty(session)
  const saveMutation = useMutation({
    mutationFn: persistSeries,
    onSettled: () => {
      saving.current = false
    },
  })
  const busy = saveMutation.isPending
  const saving = useRef(false)
  const titleInput = useRef<HTMLInputElement>(null)
  const [touched, setTouched] = useState(false)
  const nameError = seriesNameError(fields.name)
  const requestError = saveMutation.error
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'ALL' | 'PUBLISHED' | 'DRAFT'>('ALL')
  const [category, setCategory] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [mobileView, setMobileView] = useState<'candidates' | 'order'>('candidates')
  const [announcement, setAnnouncement] = useState('')
  const [dragged, setDragged] = useState<number | null>(null)
  const [dropTarget, setDropTarget] = useState<number | null>(null)
  const dragId = useRef<number | null>(null)
  const writeDraft = (next: SeriesSession) => {
    const keys = new Set([
      draftKey,
      ...(next.savedId === null ? [] : [`${actorId}:${next.savedId}`]),
    ])
    if (next.savedId !== null)
      for (const [key, value] of drafts) {
        if (key.startsWith(`${actorId}:`) && value.savedId === next.savedId) keys.add(key)
      }
    for (const key of keys) {
      if (seriesDirty(next)) drafts.set(key, next)
      else drafts.delete(key)
    }
  }
  useEffect(() => {
    onDirtyChange(dirty)
  }, [dirty, onDirtyChange])
  useEffect(() => {
    onBusyChange(busy)
  }, [busy, onBusyChange])
  useEffect(() => {
    if (!dirty && !busy) return
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', guard)
    return () => window.removeEventListener('beforeunload', guard)
  }, [dirty, busy])
  const update = (patch: Partial<SeriesFields>) => {
    if (saving.current) return
    const next = { ...session, fields: { ...fields, ...patch } }
    writeDraft(next)
    setSession(next)
  }
  const byId = new Map(candidates.map((content) => [content.content_id, content]))
  for (const step of initial?.steps ?? [])
    if (step.content && !byId.has(step.content_id)) byId.set(step.content_id, step.content)
  const availability = new Map(initial?.steps.map((step) => [step.content_id, step.available]))
  const warnings = (id: number) => stepWarnings(byId.get(id), availability.get(id))
  const attentionCount = fields.order.filter((id) => warnings(id).length).length
  const watchableCount = fields.order.filter((id) => {
    const content = byId.get(id)
    return content?.status === 'PUBLISHED' && content.video_url && availability.get(id) !== false
  }).length
  const categories = [
    ...new Map(
      candidates.flatMap((content) =>
        content.category ? [[content.category.category_id, content.category] as const] : [],
      ),
    ).values(),
  ]
  const filtered = candidates.filter(
    (content) =>
      (status === 'ALL' || status === content.status) &&
      (categoryId
        ? String(content.category?.category_id) === categoryId
        : (content.category?.name ?? '')
            .toLocaleLowerCase()
            .includes(category.trim().toLocaleLowerCase())) &&
      `${content.title ?? ''} ${content.content_id}`
        .toLocaleLowerCase()
        .includes(search.trim().toLocaleLowerCase()),
  )
  const pages = Math.max(1, Math.ceil(filtered.length / 10))
  const currentPage = Math.min(page, pages)
  const label = (id: number) => byId.get(id)?.title || `제목 없음 #${id}`
  const add = (id: number) => {
    update({ order: addSeriesStep(fields.order, id) })
    setAnnouncement(`${label(id)}: 학습 순서에 추가했어요.`)
  }
  const reorder = (source: number, target: number) => {
    if (busy) return
    const order = moveSeriesStep(fields.order, source, target)
    update({ order })
    setAnnouncement(`${label(source)}: ${order.indexOf(source) + 1}번째로 이동했어요.`)
  }
  async function persistSeries({ session, actorId }: { session: SeriesSession; actorId: number }) {
    let latest = session
    try {
      await saveSeries(session, actorId, api, (next) => {
        latest = next
        writeDraft(next)
        setSession(next)
      })
      show('시리즈 구성을 저장했어요.')
      await invalidateCurriculumChange(cache, { curriculumId: latest.savedId ?? undefined })
      return latest
    } catch (cause) {
      const infoSaved = latest.savedId !== null && latest.savedInfo === seriesInfo(latest.fields)
      const prefix =
        infoSaved && seriesDirty(latest)
          ? '기본 정보는 저장됐어요. 현재 순서를 유지한 채 단계 저장을 다시 시도할 수 있어요. '
          : ''
      if (latest !== session)
        await invalidateCurriculumChange(cache, { curriculumId: latest.savedId ?? undefined })
      throw new Error(`${prefix}${adminError(cause)}`, { cause })
    }
  }
  const save = () => {
    if (saving.current || actorId === null || !dirty) return
    setTouched(true)
    if (nameError) {
      titleInput.current?.focus()
      return
    }
    saving.current = true
    saveMutation.mutate({ session, actorId })
  }
  return (
    <>
      <div className="admin-series-dialog__body">
        <div className="admin-series__editor-status">
          <span className={dirty ? 'is-dirty' : ''}>
            {busy ? '저장 중…' : dirty ? '저장하지 않은 변경' : savedId ? '저장됨' : '새 시리즈'}
          </span>
          {restored && dirty && <span>작성 중이던 내용을 복원했어요.</span>}
          {savedId && <span>시리즈 #{savedId}</span>}
        </div>
        <fieldset disabled={busy} className="admin-series__fieldset">
          <section className="admin-series__info">
            <label className="admin-field">
              <span className="admin-series__field-label">
                <span>시리즈명</span>
                <span className={nameError ? 'is-required' : 'is-complete'}>
                  {nameError ? '입력 필요' : '입력 완료'}
                </span>
              </span>
              <input
                ref={titleInput}
                className="admin-input"
                value={fields.name}
                placeholder="예: 처음 시작하는 엑셀"
                aria-invalid={touched && !!nameError}
                aria-describedby="series-name-help"
                onBlur={() => setTouched(true)}
                onChange={(event) => update({ name: event.target.value })}
              />
              <span id="series-name-help" className="admin-series__field-help">
                <span className="admin-field-error">{touched && nameError ? nameError : ''}</span>
                <span>{[...fields.name.trim()].length} / 100</span>
              </span>
            </label>
            <label className="admin-field">
              <span className="admin-series__field-label">
                <span>설명</span>
                <span>선택</span>
              </span>
              <textarea
                className="admin-input admin-input--area"
                rows={3}
                placeholder="어떤 내용을 어떤 순서로 배우는지 소개해 주세요"
                value={fields.description}
                onChange={(event) => update({ description: event.target.value })}
              />
            </label>
          </section>
          <div className="admin-series__mobile-switch">
            <SegmentedControl
              label="시리즈 구성 영역"
              value={mobileView}
              options={[
                { id: 'candidates', label: '콘텐츠 선택' },
                { id: 'order', label: `학습 순서 ${fields.order.length}` },
              ]}
              onChange={setMobileView}
            />
          </div>
          <div className="admin-series__builder" data-mobile-view={mobileView}>
            <section
              className="admin-series__panel admin-series__candidates"
              aria-label="콘텐츠 선택"
            >
              <header className="admin-series__panel-head">
                <h3>
                  콘텐츠 선택 <span>{filtered.length}</span>
                </h3>
              </header>
              <div className="admin-series__filters">
                <label className="admin-series__search">
                  <Icon name="search" size={17} />
                  <input
                    type="search"
                    aria-label="추가할 콘텐츠 검색"
                    placeholder="제목 또는 콘텐츠 번호 검색"
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value)
                      setPage(1)
                    }}
                  />
                </label>
                <div className="admin-series__category">
                  <label htmlFor="series-category">분야</label>
                  <AutocompleteInput
                    id="series-category"
                    placeholder="전체 분야"
                    listLabel="분야 필터"
                    showAll
                    invalid={false}
                    value={category}
                    options={[
                      { id: '', label: '전체 분야' },
                      ...categories.map((item) => ({
                        id: String(item.category_id),
                        label: item.name,
                      })),
                    ]}
                    onChange={(value) => {
                      setCategory(value)
                      setCategoryId(null)
                      setPage(1)
                    }}
                    onSelect={(option) => {
                      setCategory(option.id ? option.label : '')
                      setCategoryId(option.id || null)
                      setPage(1)
                    }}
                  />
                </div>
                <SegmentedControl
                  label="후보 콘텐츠 상태"
                  value={status}
                  options={[
                    { id: 'ALL', label: '전체' },
                    { id: 'PUBLISHED', label: '공개' },
                    { id: 'DRAFT', label: '임시저장' },
                  ]}
                  onChange={(value) => {
                    setStatus(value)
                    setPage(1)
                  }}
                />
              </div>
              <ul className="admin-series__candidate-list">
                {filtered.slice((currentPage - 1) * 10, currentPage * 10).map((content) => {
                  const added = fields.order.includes(content.content_id)
                  return (
                    <li key={content.content_id} className={added ? 'is-added' : ''}>
                      <div>
                        <strong>{content.title || `제목 없음 #${content.content_id}`}</strong>
                        <p>
                          {content.category?.name ?? '분야 없음'}
                          <span>·</span>
                          {content.status === 'PUBLISHED' ? '공개' : '임시저장'}
                          <span>·</span>
                          {content.has_quiz ? '퀴즈 있음' : '퀴즈 없음'}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="admin-series__add"
                        aria-label={`${label(content.content_id)} ${added ? '추가됨' : '추가'}`}
                        disabled={added}
                        onClick={() => add(content.content_id)}
                      >
                        <Icon name={added ? 'check' : 'plus'} size={17} />
                        <span>{added ? '추가됨' : '추가'}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
              {!filtered.length && (
                <div className="admin-series__empty">
                  <Icon name="search" size={25} />
                  <strong>
                    {candidates.length ? '조건에 맞는 콘텐츠가 없어요.' : '등록된 콘텐츠가 없어요.'}
                  </strong>
                  <p>
                    {candidates.length
                      ? '검색어나 필터를 바꿔 보세요.'
                      : '콘텐츠를 먼저 등록해 주세요.'}
                  </p>
                  {candidates.length > 0 && (
                    <Button
                      size="sm"
                      onClick={() => {
                        setSearch('')
                        setCategory('')
                        setCategoryId(null)
                        setStatus('ALL')
                        setPage(1)
                      }}
                    >
                      필터 초기화
                    </Button>
                  )}
                </div>
              )}
              {pages > 1 && (
                <nav className="admin-series__pagination" aria-label="콘텐츠 후보 페이지">
                  <button
                    type="button"
                    aria-label="이전 후보 페이지"
                    disabled={currentPage === 1}
                    onClick={() => setPage(currentPage - 1)}
                  >
                    <Icon name="chevronLeft" size={17} />
                  </button>
                  <span>
                    {currentPage} / {pages}
                  </span>
                  <button
                    type="button"
                    aria-label="다음 후보 페이지"
                    disabled={currentPage === pages}
                    onClick={() => setPage(currentPage + 1)}
                  >
                    <Icon name="chevronRight" size={17} />
                  </button>
                </nav>
              )}
            </section>
            <section className="admin-series__panel admin-series__order" aria-label="학습 순서">
              <header className="admin-series__panel-head">
                <h3>
                  학습 순서 <span>{fields.order.length}</span>
                </h3>
                <span>
                  <span className="admin-series__pointer-hint">드래그로 순서 변경</span>
                  <span className="admin-series__touch-hint">이동 버튼으로 순서 변경</span>
                </span>
              </header>
              {attentionCount > 0 && (
                <p className="admin-series__attention">
                  학습 조건을 확인할 단계가 {attentionCount}개 있어요. 편성은 가능해요.
                </p>
              )}
              {!fields.order.length ? (
                <div className="admin-series__empty admin-series__empty--order">
                  <Icon name="series" size={32} />
                  <strong>첫 번째 콘텐츠를 추가해 보세요.</strong>
                  <p>선택한 콘텐츠가 이곳에 순서대로 쌓여요.</p>
                </div>
              ) : (
                <ol className="admin-series__steps">
                  {fields.order.map((id, index) => (
                    <li
                      key={id}
                      className={`${dragged === id ? 'is-dragging' : ''} ${dropTarget === id && dragged !== id ? 'is-drop-target' : ''}`}
                      onDragOver={(event) => {
                        if (dragId.current !== null && !busy) {
                          event.preventDefault()
                          event.dataTransfer.dropEffect = 'move'
                          setDropTarget(id)
                        }
                      }}
                      onDrop={(event) => {
                        event.preventDefault()
                        if (dragId.current !== null && !busy) reorder(dragId.current, id)
                        dragId.current = null
                        setDragged(null)
                        setDropTarget(null)
                      }}
                    >
                      <button
                        type="button"
                        className="admin-series__grip"
                        draggable={!busy}
                        aria-label={`${label(id)} 순서 이동`}
                        title="드래그하거나 위·아래 방향키로 이동"
                        onDragStart={(event) => {
                          if (busy) {
                            event.preventDefault()
                            return
                          }
                          dragId.current = id
                          setDragged(id)
                          event.dataTransfer.effectAllowed = 'move'
                          event.dataTransfer.setData('text/plain', String(id))
                        }}
                        onDragEnd={() => {
                          dragId.current = null
                          setDragged(null)
                          setDropTarget(null)
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                            event.preventDefault()
                            const target = fields.order[index + (event.key === 'ArrowUp' ? -1 : 1)]
                            if (target !== undefined) reorder(id, target)
                          }
                        }}
                      >
                        <span aria-hidden="true">⠿</span>
                      </button>
                      <span className="admin-series__step-number">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <div className="admin-series__step-content">
                        <strong>{label(id)}</strong>
                        <span>{byId.get(id)?.category?.name ?? '분야 없음'}</span>
                        {warnings(id).map((warning) => (
                          <p className="admin-series__step-warning" key={warning}>
                            {warning}
                          </p>
                        ))}
                      </div>
                      <div className="admin-series__step-actions">
                        <button
                          type="button"
                          className="admin-series__icon-button admin-series__move"
                          aria-label={`${label(id)} 위로 이동`}
                          disabled={index === 0}
                          onClick={() => reorder(id, fields.order[index - 1]!)}
                        >
                          <Icon name="chevronLeft" size={16} />
                        </button>
                        <button
                          type="button"
                          className="admin-series__icon-button admin-series__move"
                          aria-label={`${label(id)} 아래로 이동`}
                          disabled={index === fields.order.length - 1}
                          onClick={() => reorder(id, fields.order[index + 1]!)}
                        >
                          <Icon name="chevronRight" size={16} />
                        </button>
                        <button
                          type="button"
                          className="admin-series__icon-button admin-series__remove"
                          aria-label={`${label(id)} 시리즈에서 제외`}
                          title="시리즈에서 제외 · 원본 콘텐츠는 유지"
                          onClick={() => {
                            update({ order: fields.order.filter((item) => item !== id) })
                            setAnnouncement(`${label(id)}: 시리즈에서 제외했어요.`)
                          }}
                        >
                          <Icon name="close" size={16} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
              <p className="admin-series__criteria">단계 완료: 시청 90% 이상 + 퀴즈 정답</p>
            </section>
          </div>
        </fieldset>
        <p className="admin-series__announcement" role="status" aria-live="polite">
          {announcement}
        </p>
        {requestError && (
          <RequestError
            title="시리즈 저장 실패"
            error={requestError.cause ?? requestError}
            text={requestError.message}
          />
        )}
      </div>
      <footer className="admin-series-dialog__footer">
        <div>
          <strong>{fields.order.length}개 콘텐츠</strong>
          <span>
            {busy
              ? '저장하고 있어요'
              : dirty
                ? '변경사항을 저장해 주세요'
                : savedId
                  ? '모든 변경사항이 저장됐어요'
                  : '콘텐츠 없이도 저장할 수 있어요'}
          </span>
        </div>
        <div className="admin-row">
          <Button disabled={busy} onClick={onClose}>
            닫기
          </Button>
          {savedId !== null && (
            <Button
              disabled={busy || dirty || watchableCount === 0}
              title={
                dirty
                  ? '변경사항을 저장한 뒤 확인해 주세요'
                  : watchableCount === 0
                    ? '학습자가 시청할 수 있는 공개 영상이 필요해요'
                    : '저장된 구성을 학습자 화면에서 확인'
              }
              onClick={() => {
                onLeave()
                navigate(`/learner/series/${savedId}`)
              }}
            >
              학습자 화면
            </Button>
          )}
          <Button
            variant="primary"
            loading={busy}
            disabled={actorId === null || !dirty}
            onClick={() => void save()}
          >
            {savedId === null ? '시리즈 만들기' : '변경사항 저장'}
          </Button>
        </div>
      </footer>
      {node}
    </>
  )
}
