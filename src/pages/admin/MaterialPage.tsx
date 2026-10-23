import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { api, type ApiPage } from '../../api/client'
import {
  adminError,
  useAdminPages,
  useAdminQuery,
  type AdminContent,
  type AdminQuestion,
  type QuestionType,
  type QuestionVersion,
  type VersionSummary,
} from '../../api/admin'
import { useSession } from '../../state/session'
import { Badge, Button, Spinner, StateBlock } from '../../shared/ui'
import { useToast } from '../../shared/useToast'

const FORMATS: { id: QuestionType; label: string; count: number }[] = [
  { id: 'OX', label: 'O / X', count: 2 },
  { id: 'MCQ_3', label: '3지 선다', count: 3 },
  { id: 'MCQ_4', label: '4지 선다', count: 4 },
]

export function MaterialPage() {
  const { id } = useParams()
  const { actorId } = useSession()
  const navigate = useNavigate()
  const contents = useAdminPages<AdminContent>('/contents?status=ALL')
  const current = useAdminQuery<AdminQuestion | null>(
    id ? `/contents/${id}/question?view=editor` : null,
  )
  const version = useAdminQuery<QuestionVersion>(
    current.data
      ? `/questions/${current.data.question_id}/versions/${current.data.question_version_id}`
      : null,
  )
  const error = contents.error ?? (id ? (current.error ?? version.error) : null)
  const pending =
    contents.isPending || (!!id && (current.isPending || (!!current.data && version.isPending)))
  const hasData =
    contents.data !== undefined &&
    (!id || (current.data !== undefined && (current.data === null || version.data !== undefined)))
  return (
    <div className="sasu-page sasu-form">
      <div className="sasu-review__top">
        <button
          type="button"
          className="sasu-link"
          onClick={() => navigate(id ? `/admin/contents/${id}` : '/admin/contents')}
        >
          ← 원래 관리 화면으로
        </button>
      </div>
      <header className="sasu-page__head">
        <p className="sasu-eyebrow">관리자 · 학습자료</p>
        <h1 className="sasu-title">학습자료·문항 관리</h1>
      </header>
      <label className="sasu-field sasu-field--block">
        <span className="sasu-field__label">대상 영상</span>
        <select
          className="sasu-input"
          value={id ?? ''}
          onChange={(e) =>
            navigate(e.target.value ? `/admin/materials/${e.target.value}` : '/admin/materials')
          }
        >
          <option value="">저장된 콘텐츠 선택</option>
          {contents.data?.map((c) => (
            <option key={c.content_id} value={c.content_id}>
              {c.title || '제목 없음'} ({c.status === 'PUBLISHED' ? '공개' : '임시저장'})
            </option>
          ))}
        </select>
      </label>
      {error ? (
        <StateBlock
          title={
            hasData
              ? '최신 학습자료를 불러오지 못했어요. 작성 중인 내용은 유지돼요.'
              : '학습자료를 불러오지 못했어요.'
          }
          text={error.message}
          action={
            <Button
              onClick={() => {
                void contents.refetch()
                if (id) void current.refetch()
                if (current.data) void version.refetch()
              }}
            >
              다시 시도
            </Button>
          }
        />
      ) : null}
      {hasData && id ? (
        <QuestionEditor
          key={`${actorId}:${id}:${version.data?.question_version_id ?? 'new'}`}
          contentId={Number(id)}
          initial={current.data ? version.data : undefined}
        />
      ) : pending && !error ? (
        <Spinner />
      ) : hasData ? (
        <p className="sasu-help">먼저 대상 콘텐츠를 선택해 주세요.</p>
      ) : null}
    </div>
  )
}

function QuestionEditor({ contentId, initial }: { contentId: number; initial?: QuestionVersion }) {
  const { actorId } = useSession()
  const navigate = useNavigate()
  const cache = useQueryClient()
  const { show, node } = useToast()
  const [format, setFormat] = useState<QuestionType>(initial?.question_type ?? 'MCQ_3')
  const [question, setQuestion] = useState(initial?.question_text ?? '')
  const [choices, setChoices] = useState<string[]>(
    initial?.options.map((o) => o.option_text) ?? ['', '', ''],
  )
  const [answer, setAnswer] = useState(initial?.options.findIndex((o) => o.is_correct) ?? 0)
  const [explanation, setExplanation] = useState(initial?.explanation ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [historyPage, setHistoryPage] = useState(1)
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null)
  const history = useAdminQuery<ApiPage<VersionSummary>>(
    initial ? `/questions/${initial.question_id}/versions?page=${historyPage}&size=10` : null,
  )
  const historical = useAdminQuery<QuestionVersion>(
    initial && selectedVersion
      ? `/questions/${initial.question_id}/versions/${selectedVersion}`
      : null,
  )
  const changeFormat = (next: QuestionType) => {
    const count = FORMATS.find((f) => f.id === next)!.count
    if (next === format) return
    if (
      choices.slice(count).some((c) => c.trim()) &&
      !window.confirm('보기 수가 줄어 일부 입력이 지워져요. 계속할까요?')
    )
      return
    setFormat(next)
    setChoices(
      next === 'OX' ? ['O', 'X'] : Array.from({ length: count }, (_, i) => choices[i] ?? ''),
    )
    if (answer >= count) setAnswer(0)
  }
  const save = async () => {
    if (busy || actorId === null) return
    if (!question.trim() || choices.some((c) => !c.trim()) || !explanation.trim()) {
      setError('질문·보기·해설을 모두 입력해 주세요.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const body = {
        question_type: format,
        question_text: question.trim(),
        explanation: explanation.trim(),
        options: choices.map((text, i) => ({
          option_order: i + 1,
          option_text: text.trim(),
          is_correct: answer === i,
        })),
      }
      await api<QuestionVersion>(
        initial ? `/questions/${initial.question_id}/versions` : `/contents/${contentId}/question`,
        {
          method: 'POST',
          actorId,
          body: initial
            ? { ...body, expected_current_version_id: initial.question_version_id }
            : body,
        },
      )
      show(initial ? '새 버전으로 저장했어요. 기존 응답은 보존돼요.' : '문항을 연결했어요.')
      await cache.invalidateQueries()
    } catch (cause) {
      setError(adminError(cause))
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      {initial ? <Badge tone="blue">현재 문항 v{initial.version_no}</Badge> : null}
      {error ? (
        <p className="sasu-field-error" role="alert">
          {error}
        </p>
      ) : null}
      <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0 }}>
        <div className="sasu-form__grid">
          <section className="sasu-card">
            <div className="sasu-field sasu-field--block">
              <span className="sasu-field__label">문항 형식</span>
              <div className="sasu-tabs">
                {FORMATS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className={`sasu-tabs__tab ${format === f.id ? 'is-active' : ''}`}
                    aria-pressed={format === f.id}
                    onClick={() => changeFormat(f.id)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            <label className="sasu-field sasu-field--block">
              <span className="sasu-field__label">질문</span>
              <input
                className="sasu-input"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
              />
            </label>
            <fieldset className="sasu-choices-edit">
              <legend className="sasu-field__label">보기 · 정답 1개 선택</legend>
              {choices.map((choice, i) => (
                <div className="sasu-choice-edit" key={i}>
                  <label className="sasu-choice-edit__radio">
                    <input
                      type="radio"
                      name="answer"
                      checked={answer === i}
                      onChange={() => setAnswer(i)}
                    />
                    <span className="sasu-sr">{i + 1}번을 정답으로</span>
                  </label>
                  <input
                    className="sasu-input"
                    value={choice}
                    readOnly={format === 'OX'}
                    aria-label={`보기 ${i + 1}`}
                    onChange={(e) =>
                      setChoices((old) => old.map((c, index) => (index === i ? e.target.value : c)))
                    }
                    placeholder={`보기 ${i + 1}`}
                  />
                </div>
              ))}
            </fieldset>
            <label className="sasu-field sasu-field--block">
              <span className="sasu-field__label">해설</span>
              <textarea
                className="sasu-input sasu-input--area"
                rows={3}
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
              />
            </label>
          </section>
          <section className="sasu-card">
            <h2 className="sasu-card__title">카드 미리보기</h2>
            <div className="sasu-card-preview">
              <p className="sasu-lp__label">앞면</p>
              <p className="sasu-card-preview__q">{question || '질문이 여기에 보여요'}</p>
              <hr className="sasu-hr" />
              <p className="sasu-lp__label">뒷면</p>
              <p className="sasu-card-preview__a">
                {choices[answer]?.trim() || '정답 보기의 문장이 여기에 보여요'}
              </p>
            </div>
            <p className="sasu-help">카드는 질문과 정답 보기의 문장을 그대로 사용해요.</p>
          </section>
        </div>
      </fieldset>
      <div className="sasu-row sasu-form__actions">
        <Button
          variant="primary"
          onClick={() => void save()}
          loading={busy}
          disabled={actorId === null}
        >
          저장·연결
        </Button>
        <Button onClick={() => navigate(`/admin/contents/${contentId}`)}>원래 관리 화면으로</Button>
      </div>
      {initial ? (
        <section className="sasu-card">
          <h2 className="sasu-card__title">수정 이력</h2>
          <p className="sasu-help">
            과거 버전과 당시 응답을 보존해요. 수정한 정답으로 과거 응답을 다시 채점하지 않아요.
          </p>
          {history.isPending ? (
            <Spinner />
          ) : history.isError ? (
            <StateBlock
              title="이력을 불러오지 못했어요."
              action={<Button onClick={() => void history.refetch()}>다시 시도</Button>}
            />
          ) : (
            <>
              <ul className="sasu-pick-list">
                {history.data.items.map((v) => (
                  <li key={v.question_version_id}>
                    <span>
                      v{v.version_no} {v.is_current ? '· 현재' : ''} ·{' '}
                      {new Date(v.created_at).toLocaleString()} · 응답 {v.response_count}개
                    </span>
                    <Button size="sm" onClick={() => setSelectedVersion(v.question_version_id)}>
                      보기
                    </Button>
                  </li>
                ))}
              </ul>
              <div className="sasu-row">
                <Button
                  disabled={historyPage === 1}
                  onClick={() => setHistoryPage(historyPage - 1)}
                >
                  이전
                </Button>
                <span>{historyPage}페이지</span>
                <Button
                  disabled={!history.data.has_next}
                  onClick={() => setHistoryPage(historyPage + 1)}
                >
                  다음
                </Button>
              </div>
            </>
          )}
          {selectedVersion ? (
            historical.isPending ? (
              <Spinner />
            ) : historical.isError ? (
              <StateBlock
                title="버전을 불러오지 못했어요."
                text={historical.error.message}
                action={<Button onClick={() => void historical.refetch()}>다시 시도</Button>}
              />
            ) : (
              <div className="sasu-card-preview">
                <h3>
                  v{historical.data.version_no} · {historical.data.question_text}
                </h3>
                <ol>
                  {historical.data.options.map((o) => (
                    <li key={o.option_id}>
                      {o.option_text} {o.is_correct ? '✓ 정답' : ''}
                    </li>
                  ))}
                </ol>
                <p>{historical.data.explanation}</p>
              </div>
            )
          ) : null}
        </section>
      ) : null}
      {node}
    </>
  )
}
