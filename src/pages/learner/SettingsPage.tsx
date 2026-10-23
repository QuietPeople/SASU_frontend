import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { api } from '../../api/client'
import { useCategories, type Category, type LearnerSettings } from '../../api/learner'
import { useSession } from '../../state/session'
import { Button, StateBlock } from '../../shared/ui'
import { useToast } from '../../shared/useToast'

const MIN_INTERVAL = 1
const MAX_INTERVAL = 20

export function SettingsPage() {
  const session = useSession()
  const categories = useCategories(session.actorId, session.generation)
  if (session.isPending || (session.actorId !== null && categories.isPending))
    return (
      <div className="sasu-page">
        <StateBlock title="설정을 불러오는 중이에요." />
      </div>
    )
  if (session.error || categories.error)
    return (
      <div className="sasu-page">
        <StateBlock
          title="설정을 불러오지 못했어요."
          text={(session.error ?? categories.error)?.message}
          action={
            <Button
              onClick={() => {
                void session.refreshSettings()
                void categories.refetch()
              }}
            >
              다시 시도
            </Button>
          }
        />
      </div>
    )
  if (!session.settings || session.learnerId === null)
    return (
      <div className="sasu-page">
        <StateBlock title="학습자를 선택해 주세요." />
      </div>
    )
  return (
    <SettingsForm
      key={`${session.learnerId}:${session.generation}`}
      initial={session.settings}
      categories={categories.data?.items ?? []}
    />
  )
}

function SettingsForm({
  initial,
  categories,
}: {
  initial: LearnerSettings
  categories: Category[]
}) {
  const { actorId, learnerId, refreshSettings } = useSession()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { show, node } = useToast()
  const [interests, setInterests] = useState(initial.interest_category_ids)
  const [interval, setInterval] = useState(String(initial.review_interval))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const requestedBack = params.get('back')
  const backTo = requestedBack?.startsWith('/learner/') ? requestedBack : ''
  const toggle = (id: number) =>
    setInterests((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    )
  const save = async () => {
    const value = Number(interval)
    if (!Number.isInteger(value) || value < MIN_INTERVAL || value > MAX_INTERVAL) {
      setError(`복기 간격은 ${MIN_INTERVAL}~${MAX_INTERVAL} 사이 정수로 입력해 주세요.`)
      return
    }
    if (saving || actorId === null || learnerId === null) return
    setSaving(true)
    setError('')
    try {
      await api<LearnerSettings>(`/users/${learnerId}/settings`, {
        method: 'PATCH',
        actorId,
        body: { interest_category_ids: interests, review_interval: value },
      })
      await refreshSettings()
      show('설정을 저장했어요.')
      if (backTo) navigate(backTo)
    } catch (error) {
      setError(
        error instanceof Error ? error.message : '설정을 저장하지 못했어요. 다시 시도해 주세요.',
      )
    } finally {
      setSaving(false)
    }
  }
  return (
    <div className="sasu-page sasu-settings">
      <header className="sasu-page__head">
        <p className="sasu-eyebrow">학습자 · 설정</p>
        <h1 className="sasu-title">설정</h1>
      </header>
      <section className="sasu-card">
        <h2 className="sasu-card__title">관심 분야</h2>
        <p className="sasu-sub">관심 있는 분야를 여러 개 고를 수 있어요.</p>
        {categories.length === 0 ? (
          <StateBlock title="아직 등록된 분야가 없어요." />
        ) : (
          <div className="sasu-chips" role="group" aria-label="관심 분야">
            {categories.map((category) => (
              <button
                key={category.category_id}
                type="button"
                className={`sasu-chip sasu-chip--pick ${interests.includes(category.category_id) ? 'is-on' : ''}`}
                aria-pressed={interests.includes(category.category_id)}
                disabled={saving}
                onClick={() => toggle(category.category_id)}
              >
                {interests.includes(category.category_id) ? '✓ ' : ''}
                {category.name}
              </button>
            ))}
          </div>
        )}
      </section>
      <section className="sasu-card">
        <h2 className="sasu-card__title">복기 간격</h2>
        <label className="sasu-field sasu-field--inline">
          <span>시청 완료 영상</span>
          <input
            className="sasu-input sasu-input--num"
            type="number"
            min={MIN_INTERVAL}
            max={MAX_INTERVAL}
            value={interval}
            onChange={(event) => setInterval(event.target.value)}
            disabled={saving}
            aria-describedby="interval-hint"
          />
          <span>개마다</span>
        </label>
        <p id="interval-hint" className="sasu-help">
          1~20개 중 선택할 수 있어요. 저장한 간격은 다음 이용에도 유지돼요.
        </p>
        {error ? (
          <p className="sasu-field-error" role="alert">
            {error}
          </p>
        ) : null}
      </section>
      <div className="sasu-row">
        <Button variant="primary" onClick={() => void save()} loading={saving}>
          저장
        </Button>
        <Button onClick={() => navigate(backTo || '/learner/feed')} disabled={saving}>
          취소
        </Button>
      </div>
      {node}
    </div>
  )
}
