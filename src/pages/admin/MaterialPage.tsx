import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { invalidateQuestionChange } from '../../api/queryInvalidation'
import { api } from '../../api/client'
import {
  useAdminPages,
  useAdminQuery,
  type AdminContent,
  type AdminQuestion,
  type QuestionType,
  type QuestionVersion,
} from '../../api/admin'
import { useSession } from '../../state/session'
import type { ContentSubview } from '../../admin/contentSubview'
import { RequestError } from '../../admin/RequestFeedback'
import { AutocompleteInput } from '../../admin/AutocompleteInput'
import { Badge, Button, Spinner } from '../../admin/ui'
import { useToast } from '../../admin/useToast'
import {
  activeQuestion,
  initialQuestionDraft,
  questionBody,
  questionErrors,
  questionSignature,
  type QuestionDraft,
} from '../../admin/questionEditor'
import { SegmentedControl } from '../../admin/SegmentedControl'
import { QuestionHistory } from '../../admin/QuestionHistory'
import { FlashcardPreview } from '../../admin/FlashcardPreview'
import { useFlashcardStyle, type FlashcardStyle } from '../../admin/useFlashcardStyle'
import '../../admin/material.css'

const FORMATS: { id: QuestionType; label: string }[] = [
  { id: 'OX', label: 'O / X' },
  { id: 'MCQ_3', label: '3지 선다' },
  { id: 'MCQ_4', label: '4지 선다' },
]

// 단독 화면의 경로 이동에도 입력을 보존한다. 서버 저장이 아니며 탭을 새로고침하면 사라진다.
const drafts = new Map<string, QuestionDraft>()

export function MaterialPage({ embedded }: { embedded?: ContentSubview } = {}) {
  const { id: routeId } = useParams()
  const id = embedded ? String(embedded.contentId) : routeId
  const { actorId } = useSession()
  const navigate = useNavigate()
  const { show, node } = useToast()
  const [search, setSearch] = useState('')
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [destination, setDestination] = useState<string | null>(null)
  const confirmation = useRef<HTMLDialogElement>(null)
  const stayButton = useRef<HTMLButtonElement>(null)
  const contents = useAdminPages<AdminContent>('/contents?status=ALL', !embedded)
  const current = useAdminQuery<AdminQuestion | null>(
    id ? `/contents/${id}/question?view=editor` : null,
  )
  const version = useAdminQuery<QuestionVersion>(
    current.data
      ? `/questions/${current.data.question_id}/versions/${current.data.question_version_id}`
      : null,
  )
  const error = (embedded ? null : contents.error) ?? (id ? (current.error ?? version.error) : null)
  const pending =
    (!embedded && contents.isPending) ||
    (!!id && (current.isPending || (!!current.data && version.isPending)))
  const hasData =
    (embedded || contents.data !== undefined) &&
    (!id || (current.data !== undefined && (current.data === null || version.data !== undefined)))
  const selected = contents.data?.find((content) => String(content.content_id) === id)
  const contentOptions = (contents.data ?? []).map((content) => ({
    id: String(content.content_id),
    label: `${content.title || `제목 없음 #${content.content_id}`} · ${content.status === 'PUBLISHED' ? '공개' : '임시저장'} · 퀴즈 ${content.has_quiz ? '등록' : '미등록'}`,
  }))
  const move = (path: string) => {
    if (busy) return
    if (dirty) setDestination(path)
    else navigate(path)
  }
  useEffect(() => {
    if (!destination) return
    const dialog = confirmation.current!
    const previous = document.activeElement as HTMLElement | null
    dialog.showModal()
    stayButton.current?.focus()
    return () => {
      dialog.close()
      previous?.focus()
    }
  }, [destination])
  useEffect(() => {
    if (embedded || (!dirty && !busy)) return
    const guard = (event: MouseEvent) => {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)
        return
      const link = event.target instanceof Element ? event.target.closest('a[href]') : null
      if (
        !(link instanceof HTMLAnchorElement) ||
        link.target === '_blank' ||
        link.origin !== window.location.origin
      )
        return
      if (link.pathname === window.location.pathname && link.search === window.location.search)
        return
      event.preventDefault()
      if (!busy) setDestination(link.pathname + link.search + link.hash)
    }
    document.addEventListener('click', guard, true)
    return () => document.removeEventListener('click', guard, true)
  }, [embedded, dirty, busy])
  return (
    <div className="admin-page admin-form admin-material">
      {!embedded && (
        <>
          <header className="admin-page__head">
            <p className="admin-eyebrow">관리자 · 학습자료</p>
            <h1 className="admin-title">퀴즈·플래시카드</h1>
            <p className="admin-help">
              콘텐츠의 퀴즈를 작성하면 질문과 정답이 복습 카드로 연결돼요.
            </p>
          </header>
          <section className="admin-card admin-material__target">
            <label className="admin-field__label" htmlFor="material-content-search">
              대상 콘텐츠
            </label>
            <fieldset disabled={busy} className="admin-material__fieldset">
              <AutocompleteInput
                id="material-content-search"
                placeholder="콘텐츠 제목으로 검색"
                listLabel="콘텐츠 검색 결과"
                showAll
                value={search}
                onChange={setSearch}
                invalid={false}
                options={contentOptions}
                onSelect={(option) => {
                  if (option.id !== id) move(`/admin/materials/${option.id}`)
                  setSearch('')
                }}
              />
            </fieldset>
            {search.trim() &&
              contents.data &&
              !contentOptions.some((option) =>
                option.label.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
              ) && <p className="admin-help">검색 결과가 없어요.</p>}
            {selected && (
              <div className="admin-material__selected">
                <strong>{selected.title || `제목 없음 #${selected.content_id}`}</strong>
                <div className="admin-row">
                  <Badge>{selected.status === 'PUBLISHED' ? '공개' : '임시저장'}</Badge>
                  <Badge tone={selected.has_quiz ? 'green' : 'neutral'}>
                    퀴즈 {selected.has_quiz ? '등록' : '미등록'}
                  </Badge>
                </div>
              </div>
            )}
          </section>
        </>
      )}
      {error && (
        <RequestError
          title={
            hasData
              ? '최신 학습자료를 불러오지 못했어요. 작성 중인 내용은 유지돼요.'
              : '학습자료를 불러오지 못했어요.'
          }
          error={error}
          action={
            <Button
              onClick={() => {
                if (!embedded) void contents.refetch()
                if (id) void current.refetch()
                if (current.data) void version.refetch()
              }}
            >
              다시 시도
            </Button>
          }
        />
      )}
      {hasData && id ? (
        <QuestionEditor
          key={`${actorId}:${id}:${version.data?.question_version_id ?? 'new'}`}
          draftKey={`${actorId}:${id}:${version.data?.question_version_id ?? 'new'}`}
          contentId={Number(id)}
          initial={current.data ? version.data : undefined}
          embedded={embedded}
          onDirtyChange={setDirty}
          onBusyChange={setBusy}
          onSaved={show}
        />
      ) : pending && !error ? (
        <Spinner />
      ) : hasData ? (
        <div className="admin-empty">
          <p className="admin-empty__title">퀴즈를 작성할 콘텐츠를 선택해 주세요.</p>
          <p className="admin-help">콘텐츠마다 퀴즈 1개와 연결된 플래시카드를 관리해요.</p>
        </div>
      ) : null}
      <dialog
        ref={confirmation}
        className="admin-material-confirm"
        aria-labelledby="material-leave-title"
        onCancel={(event) => {
          event.preventDefault()
          setDestination(null)
        }}
      >
        <h2 id="material-leave-title">저장하지 않은 변경이 있어요.</h2>
        <p>이동할까요? 입력은 현재 탭에서 잠시 유지되며, 새로고침하면 사라져요.</p>
        <div className="admin-row">
          <button
            ref={stayButton}
            type="button"
            className="admin-btn admin-btn--primary"
            onClick={() => setDestination(null)}
          >
            계속 작성
          </button>
          <Button
            onClick={() => {
              if (destination) {
                navigate(destination)
                setDestination(null)
              }
            }}
          >
            이동
          </Button>
        </div>
      </dialog>
      {node}
    </div>
  )
}

function FieldLabel({ children, complete }: { children: ReactNode; complete: boolean }) {
  return (
    <span className="admin-material__label">
      <span>{children}</span>
      <span className={`admin-material__required ${complete ? 'is-complete' : ''}`}>
        {complete ? '입력 완료' : '입력 필요'}
      </span>
    </span>
  )
}

function QuestionEditor({
  contentId,
  draftKey,
  initial,
  embedded,
  onDirtyChange: parentDirty,
  onBusyChange: parentBusy,
  onSaved,
}: {
  contentId: number
  draftKey: string
  initial?: QuestionVersion
  embedded?: ContentSubview
  onDirtyChange: (dirty: boolean) => void
  onBusyChange: (busy: boolean) => void
  onSaved: (text: string) => void
}) {
  const { actorId } = useSession()
  const cache = useQueryClient()
  const form = useRef<HTMLFieldSetElement>(null)
  const [restored] = useState(() => !embedded && drafts.has(draftKey))
  const [draft, setDraft] = useState(
    () => (!embedded && drafts.get(draftKey)) || initialQuestionDraft(initial),
  )
  const { format, question, explanation } = draft
  const { choices, answer } = activeQuestion(draft)
  const signature = questionSignature(draft)
  const [baseline, setBaseline] = useState(() => questionSignature(initialQuestionDraft(initial)))
  const dirty = signature !== baseline
  const saveMutation = useMutation({
    mutationFn: persistQuestion,
    onSettled: () => {
      saving.current = false
    },
  })
  const busy = saveMutation.isPending
  const saving = useRef(false)
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [attempted, setAttempted] = useState(false)
  const [previewMode, setPreviewMode] = useState<'quiz' | 'card'>('quiz')
  const flashcardStyle = useFlashcardStyle()
  const errors = questionErrors(draft)
  const visibleError = (field: string) => (attempted || touched[field] ? errors[field] : undefined)
  const touch = (field: string) => setTouched((old) => ({ ...old, [field]: true }))
  const onDirtyChange = embedded?.onDirtyChange ?? parentDirty
  const onBusyChange = embedded?.onBusyChange ?? parentBusy
  useEffect(() => {
    onDirtyChange(dirty)
  }, [dirty, onDirtyChange])
  useEffect(() => {
    onBusyChange(busy)
  }, [busy, onBusyChange])
  useEffect(() => {
    if (embedded) return
    if (dirty) drafts.set(draftKey, draft)
    else drafts.delete(draftKey)
  }, [draftKey, draft, dirty, embedded])
  useEffect(() => {
    if (!dirty && !busy) return
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', guard)
    return () => window.removeEventListener('beforeunload', guard)
  }, [dirty, busy])
  const requestError = saveMutation.error
  async function persistQuestion({ actorId }: { actorId: number }) {
    const body = questionBody(draft)
    const savedQuestion = await api<QuestionVersion>(
      initial ? `/questions/${initial.question_id}/versions` : `/contents/${contentId}/question`,
      {
        method: 'POST',
        actorId,
        body: initial
          ? { ...body, expected_current_version_id: initial.question_version_id }
          : body,
      },
    )
    drafts.delete(draftKey)
    setBaseline(signature)
    onSaved(
      initial ? '변경사항을 저장했어요. 이전 응답은 보존돼요.' : '퀴즈와 플래시카드를 연결했어요.',
    )
    await invalidateQuestionChange(cache, { contentId, questionId: savedQuestion.question_id })
    return savedQuestion
  }
  const save = () => {
    if (saving.current || actorId === null || !dirty) return
    setAttempted(true)
    if (Object.keys(errors).length) {
      const field = Object.keys(errors)[0]
      form.current?.querySelector<HTMLElement>(`[data-field="${field}"]`)?.focus()
      return
    }
    saving.current = true
    saveMutation.mutate({ actorId })
  }
  return (
    <>
      <div className="admin-material__status">
        <div className="admin-row">
          <Badge tone={initial ? 'blue' : 'neutral'}>
            {initial ? `현재 문항 v${initial.version_no}` : '새 퀴즈'}
          </Badge>
          <span role="status">
            {busy ? '저장 중…' : dirty ? '저장하지 않은 변경' : initial ? '저장됨' : '작성 전'}
          </span>
        </div>
        {restored && dirty && <p className="admin-help">이 탭에서 작성하던 내용을 복원했어요.</p>}
      </div>
      {requestError && <RequestError title="학습자료 저장 실패" error={requestError} />}
      <div className="admin-material__grid">
        <fieldset ref={form} disabled={busy} className="admin-card admin-material__editor">
          <h2 className="admin-card__title">퀴즈 작성</h2>
          <div className="admin-field">
            <span className="admin-field__label">문항 형식</span>
            <SegmentedControl
              label="문항 형식"
              value={format}
              options={FORMATS}
              onChange={(next) => setDraft((old) => ({ ...old, format: next }))}
            />
          </div>
          <label className="admin-field" htmlFor="material-question">
            <FieldLabel complete={!errors.question}>질문</FieldLabel>
            <textarea
              id="material-question"
              data-field="question"
              className="admin-input admin-input--area"
              rows={3}
              placeholder="학습자에게 보여줄 질문을 입력해 주세요"
              value={question}
              aria-invalid={!!visibleError('question')}
              aria-describedby={visibleError('question') ? 'material-question-error' : undefined}
              onBlur={() => touch('question')}
              onChange={(event) => setDraft((old) => ({ ...old, question: event.target.value }))}
            />
            {visibleError('question') && (
              <span id="material-question-error" className="admin-field-error">
                {errors.question}
              </span>
            )}
          </label>
          <fieldset className="admin-material__choices">
            <legend>
              <FieldLabel
                complete={!errors.answer && !choices.some((_, index) => errors[`choice-${index}`])}
              >
                보기 · 정답 1개 선택
              </FieldLabel>
            </legend>
            {choices.map((choice, index) => (
              <div key={index} className="admin-material__choice-wrap">
                <div className={`admin-material__choice ${answer === index ? 'is-correct' : ''}`}>
                  <label className="admin-material__radio">
                    <input
                      type="radio"
                      name="material-answer"
                      data-field={index === 0 ? 'answer' : undefined}
                      checked={answer === index}
                      aria-label={`${index + 1}번을 정답으로`}
                      aria-invalid={!!visibleError('answer')}
                      aria-describedby={
                        visibleError('answer') ? 'material-answer-error' : undefined
                      }
                      onChange={() => {
                        setDraft((old) => ({
                          ...old,
                          [format === 'OX' ? 'oxAnswer' : 'mcqAnswer']: index,
                        }))
                        touch('answer')
                      }}
                    />
                    <span aria-hidden="true">{index + 1}</span>
                  </label>
                  <input
                    className="admin-input"
                    data-field={`choice-${index}`}
                    value={choice}
                    readOnly={format === 'OX'}
                    aria-label={`보기 ${index + 1}`}
                    aria-invalid={!!visibleError(`choice-${index}`)}
                    aria-describedby={
                      visibleError(`choice-${index}`) ? `material-choice-${index}-error` : undefined
                    }
                    placeholder={`보기 ${index + 1}`}
                    onBlur={() => touch(`choice-${index}`)}
                    onChange={(event) =>
                      setDraft((old) => ({
                        ...old,
                        mcqChoices: old.mcqChoices.map((text, at) =>
                          at === index ? event.target.value : text,
                        ),
                      }))
                    }
                  />
                  {answer === index && <span className="admin-material__correct">정답</span>}
                </div>
                {visibleError(`choice-${index}`) && (
                  <p id={`material-choice-${index}-error`} className="admin-field-error">
                    {errors[`choice-${index}`]}
                  </p>
                )}
              </div>
            ))}
            {visibleError('answer') && (
              <p id="material-answer-error" className="admin-field-error">
                {errors.answer}
              </p>
            )}
          </fieldset>
          <label className="admin-field" htmlFor="material-explanation">
            <FieldLabel complete={!errors.explanation}>해설</FieldLabel>
            <textarea
              id="material-explanation"
              data-field="explanation"
              className="admin-input admin-input--area"
              rows={4}
              placeholder="정답의 이유를 설명해 주세요"
              value={explanation}
              aria-invalid={!!visibleError('explanation')}
              aria-describedby={
                visibleError('explanation') ? 'material-explanation-error' : undefined
              }
              onBlur={() => touch('explanation')}
              onChange={(event) => setDraft((old) => ({ ...old, explanation: event.target.value }))}
            />
            {visibleError('explanation') && (
              <span id="material-explanation-error" className="admin-field-error">
                {errors.explanation}
              </span>
            )}
          </label>
        </fieldset>
        <MaterialPreview
          key={signature}
          draft={draft}
          cardStyle={flashcardStyle}
          mode={previewMode}
          setMode={setPreviewMode}
        />
      </div>
      <div className="admin-row admin-material__actions">
        <Button
          variant="primary"
          onClick={() => void save()}
          loading={busy}
          disabled={actorId === null || !dirty}
        >
          {initial ? '변경사항 저장' : '저장'}
        </Button>
        {embedded && (
          <Button onClick={embedded.onClose} disabled={busy}>
            닫기
          </Button>
        )}
      </div>
      {initial && <QuestionHistory current={initial} />}
    </>
  )
}

function MaterialPreview({
  draft,
  cardStyle,
  mode,
  setMode,
}: {
  draft: QuestionDraft
  cardStyle: FlashcardStyle
  mode: 'quiz' | 'card'
  setMode: (mode: 'quiz' | 'card') => void
}) {
  const [picked, setPicked] = useState<number | null>(null)
  const [checked, setChecked] = useState(false)
  const { choices, answer } = activeQuestion(draft)
  const ready = Object.keys(questionErrors(draft)).length === 0
  return (
    <section className="admin-card admin-material__preview" aria-label="학습자료 미리보기">
      <div className="admin-material__preview-head">
        <h2 className="admin-card__title">미리보기</h2>
        <span>저장 전 확인</span>
      </div>
      <SegmentedControl
        label="미리보기 종류"
        value={mode}
        options={[
          { id: 'quiz', label: '퀴즈' },
          { id: 'card', label: '플래시카드' },
        ]}
        onChange={setMode}
      />
      {mode === 'quiz' ? (
        <div className="admin-material__quiz">
          <p className="admin-material__preview-question">
            {draft.question.trim() || '질문을 입력해 주세요'}
          </p>
          <div
            className="admin-material__preview-options"
            role="group"
            aria-label="퀴즈 미리보기 답 선택"
          >
            {choices.map((choice, index) => (
              <button
                key={index}
                type="button"
                aria-pressed={picked === index}
                disabled={checked || !choice.trim()}
                className={`${picked === index ? 'is-picked' : ''} ${checked && answer === index ? 'is-answer' : ''}`}
                onClick={() => setPicked(index)}
              >
                <span>{index + 1}</span>
                <span>{choice.trim() || `${index + 1}번 보기`}</span>
                {checked && answer === index && <strong>정답</strong>}
              </button>
            ))}
          </div>
          {checked ? (
            <div className="admin-material__preview-result" role="status">
              <strong>{picked === answer ? '정답이에요' : '정답을 확인해 보세요'}</strong>
              <p>{draft.explanation}</p>
              <Button
                size="sm"
                onClick={() => {
                  setChecked(false)
                  setPicked(null)
                }}
              >
                다시 풀기
              </Button>
            </div>
          ) : (
            <Button disabled={!ready || picked === null} onClick={() => setChecked(true)}>
              정답 확인
            </Button>
          )}
        </div>
      ) : (
        <>
          <FlashcardPreview
            question={draft.question}
            answer={choices[answer] ?? ''}
            isOX={draft.format === 'OX'}
            style={cardStyle}
          />
          <p className="admin-help">퀴즈의 질문과 정답이 카드 앞뒤에 자동으로 반영돼요.</p>
        </>
      )}
    </section>
  )
}
