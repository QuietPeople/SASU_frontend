import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import {
  adminError,
  useAdminPages,
  useAdminQuery,
  type AdminContent,
  type AdminCurriculum,
  type CurriculumDetail,
} from '../../api/admin'
import { useSession } from '../../state/session'
import { Badge, Button, Spinner, StateBlock } from '../../shared/ui'
import { useToast } from '../../shared/useToast'

export function SeriesBuilderPage() {
  const { actorId } = useSession()
  const [selected, setSelected] = useState('')
  const list = useAdminPages<AdminCurriculum>('/curriculums?view=editor')
  const candidates = useAdminPages<AdminContent>('/contents?status=ALL')
  const detail = useAdminQuery<CurriculumDetail>(
    selected ? `/curriculums/${selected}?view=editor` : null,
  )
  const error = list.error ?? candidates.error ?? (selected ? detail.error : null)
  const pending = list.isPending || candidates.isPending || (!!selected && detail.isPending)
  const hasData =
    list.data !== undefined &&
    candidates.data !== undefined &&
    (!selected || detail.data !== undefined)
  return (
    <div className="sasu-page sasu-form">
      <header className="sasu-page__head">
        <p className="sasu-eyebrow">관리자 · 시리즈</p>
        <h1 className="sasu-title">시리즈 구성</h1>
      </header>
      <label className="sasu-field sasu-field--block">
        <span className="sasu-field__label">편집할 시리즈</span>
        <select
          className="sasu-input"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          <option value="">새 시리즈 만들기</option>
          {list.data?.map((c) => (
            <option key={c.curriculum_id} value={c.curriculum_id}>
              {c.title} · {c.total_steps}단계
            </option>
          ))}
        </select>
      </label>
      {error ? (
        <StateBlock
          title={
            hasData
              ? '최신 시리즈 정보를 불러오지 못했어요. 작성 중인 내용은 유지돼요.'
              : '시리즈를 불러오지 못했어요.'
          }
          text={error.message}
          action={
            <Button
              onClick={() => {
                void list.refetch()
                void candidates.refetch()
                if (selected) void detail.refetch()
              }}
            >
              다시 시도
            </Button>
          }
        />
      ) : null}
      {hasData ? (
        <SeriesEditor
          key={`${actorId}:${selected || 'new'}`}
          initial={selected ? detail.data : undefined}
          candidates={candidates.data ?? []}
          onCreated={(id) => setSelected(String(id))}
        />
      ) : pending && !error ? (
        <Spinner />
      ) : null}
    </div>
  )
}

function SeriesEditor({
  initial,
  candidates,
  onCreated,
}: {
  initial?: CurriculumDetail
  candidates: AdminContent[]
  onCreated: (id: number) => void
}) {
  const { actorId } = useSession()
  const navigate = useNavigate()
  const cache = useQueryClient()
  const { show, node } = useToast()
  const [savedId, setSavedId] = useState(initial?.summary.curriculum_id ?? null)
  const [name, setName] = useState(initial?.summary.title ?? '')
  const [description, setDescription] = useState(initial?.summary.description ?? '')
  const [order, setOrder] = useState<number[]>(initial?.steps.map((s) => s.content_id) ?? [])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const byId = new Map(candidates.map((c) => [c.content_id, c]))
  for (const step of initial?.steps ?? [])
    if (step.content && !byId.has(step.content_id)) byId.set(step.content_id, step.content)
  const move = (index: number, direction: number) =>
    setOrder((previous) => {
      const next = [...previous]
      ;[next[index], next[index + direction]] = [next[index + direction], next[index]]
      return next
    })
  const save = async () => {
    if (busy || actorId === null) return
    if (!name.trim()) {
      setError('시리즈명을 입력해 주세요.')
      return
    }
    setBusy(true)
    setError('')
    let id = savedId
    let infoSaved = false
    try {
      if (id === null) {
        const created = await api<CurriculumDetail>('/curriculums', {
          method: 'POST',
          actorId,
          body: { title: name.trim(), description: description.trim() || null },
        })
        id = created.summary.curriculum_id
        setSavedId(id)
      } else {
        await api(`/curriculums/${id}`, {
          method: 'PATCH',
          actorId,
          body: { title: name.trim(), description: description.trim() || null },
        })
      }
      infoSaved = true
      await api(`/curriculums/${id}/steps`, {
        method: 'PUT',
        actorId,
        body: { content_ids: order },
      })
      await cache.invalidateQueries()
      show('시리즈 구성을 저장했어요.')
      if (!initial) onCreated(id)
    } catch (cause) {
      setError(
        `${infoSaved ? '기본 정보는 저장됐어요. 단계 저장을 다시 시도해 주세요. ' : ''}${adminError(cause)}`,
      )
      if (infoSaved) await cache.invalidateQueries()
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      {error ? (
        <p className="sasu-field-error" role="alert">
          {error}
        </p>
      ) : null}
      <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0 }}>
        <section className="sasu-card">
          <label className="sasu-field sasu-field--block">
            <span className="sasu-field__label">시리즈명</span>
            <input
              className="sasu-input"
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="sasu-field sasu-field--block">
            <span className="sasu-field__label">설명</span>
            <input
              className="sasu-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
        </section>
        <div className="sasu-form__grid">
          <section className="sasu-card">
            <h2 className="sasu-card__title">저장된 콘텐츠 후보</h2>
            {!candidates.length ? (
              <p className="sasu-muted">먼저 콘텐츠를 등록해 주세요.</p>
            ) : (
              <ul className="sasu-pick-list">
                {candidates.map((c) => (
                  <li key={c.content_id}>
                    <span>
                      {c.title || '제목 없음'}
                      <span className="sasu-table__sub">
                        {c.category?.name ?? '분야 없음'} ·{' '}
                        {c.status === 'PUBLISHED' ? '공개' : '임시저장'} ·{' '}
                        {c.has_quiz ? '퀴즈 있음' : '퀴즈 없음'}
                      </span>
                    </span>
                    <Button
                      size="sm"
                      disabled={order.includes(c.content_id)}
                      onClick={() => setOrder((old) => [...old, c.content_id])}
                    >
                      {order.includes(c.content_id) ? '추가됨' : '추가'}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="sasu-card">
            <h2 className="sasu-card__title">학습 순서</h2>
            {!order.length ? (
              <p className="sasu-muted">후보에서 콘텐츠를 추가해 주세요.</p>
            ) : (
              <ol className="sasu-order-list">
                {order.map((id, index) => {
                  const c = byId.get(id)
                  return (
                    <li key={id}>
                      <span>
                        <strong>{index + 1}.</strong> {c?.title || '제목 없음'}{' '}
                        {!c?.has_quiz ? <Badge tone="amber">퀴즈 없음</Badge> : null}{' '}
                        {c?.status !== 'PUBLISHED' ? <Badge>비공개</Badge> : null}
                      </span>
                      <span className="sasu-order-list__btns">
                        <Button
                          size="sm"
                          title="위로 이동"
                          disabled={index === 0}
                          onClick={() => move(index, -1)}
                        >
                          ↑
                        </Button>
                        <Button
                          size="sm"
                          title="아래로 이동"
                          disabled={index === order.length - 1}
                          onClick={() => move(index, 1)}
                        >
                          ↓
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => setOrder((old) => old.filter((cid) => cid !== id))}
                        >
                          제외
                        </Button>
                      </span>
                    </li>
                  )
                })}
              </ol>
            )}
          </section>
        </div>
      </fieldset>
      <div className="sasu-card sasu-series__criteria">
        <h2 className="sasu-card__title">완료 기준</h2>
        <p>
          시청 90% 이상과 해당 문제의 정답이 모두 필요해요. 퀴즈가 없거나 비공개인 단계는 완료할 수
          없어요.
        </p>
      </div>
      <div className="sasu-row sasu-form__actions">
        <Button
          variant="primary"
          loading={busy}
          disabled={actorId === null}
          onClick={() => void save()}
        >
          구성 저장
        </Button>
        <Button disabled={!savedId || busy} onClick={() => navigate(`/learner/series/${savedId}`)}>
          학습자 화면에서 보기
        </Button>
      </div>
      {node}
    </>
  )
}
