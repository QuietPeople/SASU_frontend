import { Skeleton } from '../../shared/Skeleton'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { invalidateQuestionChange } from '../../api/queryInvalidation'
import { api } from '../../api/client'
import {
  useAdminQuery,
  type AdminQuestion,
  type AdminContent,
  type EditableContent,
  type QuestionType,
  type QuestionVersion,
} from '../../api/admin'
import { useSession } from '../../state/session'
import type { ContentSubview } from '../../admin/contentSubview'
import { RequestError } from '../../admin/RequestFeedback'
import { ContentTargetPicker } from '../../admin/ContentTargetPicker'
import { ContentDialog } from '../../admin/ContentDialog'
import { adminId } from '../../admin/navigation'
import { Badge, Button } from '../../admin/ui'
import { useToast } from '../../admin/useToast'
import {
  activeQuestion,
  initialQuestionDraft,
  questionBody,
  questionErrors,
  questionServerErrors,
  questionSignature,
  type QuestionDraft,
} from '../../admin/questionEditor'
import { SegmentedControl } from '../../admin/SegmentedControl'
import { QuestionHistory } from '../../admin/QuestionHistory'
import { QuestionPreview } from '../../admin/QuestionPreview'
import { ResultBadge } from '../../admin/ResultBadge'
import { FlashcardPreview } from '../../shared/FlashcardPreview'
import { useFlashcardStyle, type FlashcardStyle } from '../../shared/useFlashcardStyle'
import '../../admin/material.css'

const FORMATS: { id: QuestionType; label: string }[] = [
  { id: 'OX', label: 'O / X' },
  { id: 'MCQ_3', label: '3지 선다' },
  { id: 'MCQ_4', label: '4지 선다' },
]

export function MaterialPage({ embedded }: { embedded?: ContentSubview } = {}) {
  const { actorId, generation } = useSession()
  return embedded ? (
    <MaterialEditor embedded={embedded} />
  ) : (
    <MaterialWorkspace key={`${actorId}:${generation}`} />
  )
}

function MaterialWorkspace() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [selection, setSelection] = useState<AdminContent | null>(null)
  const routeTarget = adminId(id ?? null)
  const detail = useAdminQuery<EditableContent>(
    routeTarget ? `/contents/${routeTarget}?view=editor` : null,
  )
  const selected = selection ?? (routeTarget ? detail.data?.detail.content : null)
  const close = () => {
    setSelection(null)
    if (id) navigate(`/admin/materials${params.size ? `?${params}` : ''}`, { replace: true })
  }
  return (
    <>
      <div className="admin-page admin-material admin-material--workspace">
        <header className="admin-page__head">
          <p className="admin-eyebrow">관리자 · 학습자료</p>
          <h1 className="admin-title">퀴즈·플래시카드</h1>
          <p className="admin-sub">콘텐츠별 퀴즈와 연결된 플래시카드를 관리해요.</p>
        </header>
        <ContentTargetPicker onSelect={setSelection} />
        {routeTarget && detail.isPending && (
          <Skeleton variant="form" label="학습자료를 불러오는 중" />
        )}
        {id && (!routeTarget || detail.isError) && (
          <RequestError
            variant={selected ? 'toast' : 'screen'}
            title="선택한 콘텐츠를 불러오지 못했어요."
            error={detail.error}
            action={
              <>
                {routeTarget && <Button onClick={() => void detail.refetch()}>다시 시도</Button>}
                <Button onClick={close}>목록으로</Button>
              </>
            }
          />
        )}
      </div>
      {selected && (
        <ContentDialog
          key={selected.content_id}
          content={selected}
          initialView="materials"
          onClose={close}
        />
      )}
    </>
  )
}

function MaterialEditor({ embedded }: { embedded: ContentSubview }) {
  const { actorId, generation } = useSession()
  const { show, node } = useToast()
  const id = embedded.contentId
  const current = useAdminQuery<AdminQuestion | null>(`/contents/${id}/question?view=editor`)
  const version = useAdminQuery<QuestionVersion>(
    current.data
      ? `/questions/${current.data.question_id}/versions/${current.data.question_version_id}`
      : null,
  )
  const error = current.error ?? version.error
  const hasData =
    current.data !== undefined && (current.data === null || version.data !== undefined)
  return (
    <div className="admin-page admin-form admin-material">
      {error && (
        <RequestError
          title={
            hasData
              ? '최신 학습자료를 불러오지 못했어요. 작성 중인 내용은 유지돼요.'
              : '학습자료를 불러오지 못했어요.'
          }
          variant={hasData ? 'toast' : 'screen'}
          error={error}
          action={
            <Button
              onClick={() => {
                void current.refetch()
                if (current.data) void version.refetch()
              }}
            >
              다시 시도
            </Button>
          }
        />
      )}
      {hasData ? (
        <QuestionEditor
          key={`${actorId}:${generation}:${id}:${version.data?.question_version_id ?? 'new'}`}
          contentId={id}
          initial={current.data ? version.data : undefined}
          embedded={embedded}
          onSaved={show}
        />
      ) : !error ? (
        <Skeleton variant="form" />
      ) : null}
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
  initial,
  embedded,
  onSaved,
}: {
  contentId: number
  initial?: QuestionVersion
  embedded: ContentSubview
  onSaved: (text: string) => void
}) {
  const { actorId } = useSession()
  const cache = useQueryClient()
  const form = useRef<HTMLFieldSetElement>(null)
  const [draft, setDraft] = useState(() => initialQuestionDraft(initial))
  const { format, question, explanation } = draft
  const { choices, answer } = activeQuestion(draft)
  const signature = questionSignature(draft)
  const [baseline, setBaseline] = useState(() => questionSignature(initialQuestionDraft(initial)))
  const dirty = signature !== baseline
  const saveMutation = useMutation({
    mutationFn: persistQuestion,
    onError: (error) => {
      const field = Object.keys(questionServerErrors(error))[0]
      if (field) form.current?.querySelector<HTMLElement>(`[data-field="${field}"]`)?.focus()
    },
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
  const serverErrors =
    saveMutation.variables?.signature === signature ? questionServerErrors(saveMutation.error) : {}
  const errors = { ...serverErrors, ...questionErrors(draft) }
  const visibleError = (field: string) =>
    attempted || touched[field] || serverErrors[field] ? errors[field] : undefined
  const touch = (field: string) => setTouched((old) => ({ ...old, [field]: true }))
  const { onDirtyChange, onBusyChange } = embedded
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
  const requestError = saveMutation.error
  async function persistQuestion({ actorId }: { actorId: number; signature: string }) {
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
    saveMutation.mutate({ actorId, signature })
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
                  {answer === index && <ResultBadge result="CORRECT" />}
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
      {initial && <QuestionHistory current={initial} />}
      <div className="admin-row admin-material__actions">
        <Button
          variant="primary"
          onClick={() => void save()}
          loading={busy}
          disabled={actorId === null || !dirty}
        >
          {initial ? '변경사항 저장' : '저장'}
        </Button>
        <Button onClick={embedded.onClose} disabled={busy}>
          닫기
        </Button>
      </div>
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
          <QuestionPreview
            question={draft.question}
            options={choices.map((choice, index) => ({
              option_id: index,
              option_order: index + 1,
              option_text: choice,
            }))}
            selectedOptionId={picked}
            correctOptionId={checked ? answer : null}
            disabled={checked}
            onSelect={setPicked}
          />
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
