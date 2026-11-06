import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router'
import { api } from '../../api/client'
import { useCategories, type Category, type LearnerSettings } from '../../api/learner'
import { invalidateLearnerSettings } from '../../api/queryInvalidation'
import { useSession } from '../../state/session'
import { Button } from '../../learner/ui'
import { LearnerState as StateBlock } from '../../learner/LearnerState'
import { useToast } from '../../shared/useToast'

import { clearView, readView, writeView } from '../../features/learner-navigation/state'
import '../../learner/navigation.css'

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
          error={session.error ?? categories.error}
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
      key={`${session.actorId}:${session.learnerId}:${session.generation}`}
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
  const { actorId, learnerId, generation } = useSession()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { show, node } = useToast()
  const draftKey = `${actorId}:${learnerId}:${generation}:settings-draft`
  const [draft] = useState(() => {
    const saved = readView<{ interests: number[]; interval: string }>(draftKey)
    return saved &&
      Array.isArray(saved.interests) &&
      saved.interests.every((id) => Number.isSafeInteger(id) && id > 0) &&
      typeof saved.interval === 'string'
      ? saved
      : undefined
  })
  const [interests, setInterests] = useState(draft?.interests ?? initial.interest_category_ids)
  const [interval, setInterval] = useState(draft?.interval ?? String(initial.review_interval))
  const [baseline, setBaseline] = useState({
    interests: initial.interest_category_ids,
    interval: String(initial.review_interval),
  })
  const dirty =
    [...interests].sort((a, b) => a - b).join(',') !==
      [...baseline.interests].sort((a, b) => a - b).join(',') || interval !== baseline.interval
  useEffect(() => {
    if (dirty) writeView(draftKey, { interests, interval })
    else clearView(draftKey)
  }, [dirty, draftKey, interests, interval])
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
  const savingRef = useRef(false)
  const [validationError, setValidationError] = useState('')
  const requestedBack = params.get('back')
  const backTo = requestedBack?.startsWith('/learner/') ? requestedBack : ''
  const toggle = (id: number) =>
    setInterests((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    )
  const update = useMutation({
    mutationFn: ({
      actorId,
      learnerId,
      interests,
      interval,
    }: {
      actorId: number
      learnerId: number
      interests: number[]
      interval: number
    }) =>
      api<LearnerSettings>(`/users/${learnerId}/settings`, {
        method: 'PATCH',
        actorId,
        body: { interest_category_ids: interests, review_interval: interval },
      }),
    onSuccess: async (settings, { actorId, learnerId }) => {
      queryClient.setQueryData<LearnerSettings>(['session', 'settings', learnerId], (current) => {
        if (current && current.record_generation > settings.record_generation) return current
        return settings
      })
      await invalidateLearnerSettings(queryClient, {
        actorId,
        learnerId,
        generation: settings.record_generation,
      })
      clearView(draftKey)
      setInterests(settings.interest_category_ids)
      setInterval(String(settings.review_interval))
      setBaseline({
        interests: settings.interest_category_ids,
        interval: String(settings.review_interval),
      })
      show('설정을 저장했어요.')
      if (backTo) navigate(backTo)
    },
    onSettled: () => {
      savingRef.current = false
    },
  })
  const saving = update.isPending
  const save = () => {
    if (savingRef.current || actorId === null || learnerId === null) return
    const value = Number(interval)
    if (!Number.isInteger(value) || value < MIN_INTERVAL || value > MAX_INTERVAL) {
      setValidationError(
        `피드 복습 간격은 ${MIN_INTERVAL}~${MAX_INTERVAL} 사이 정수로 입력해 주세요.`,
      )
      return
    }
    savingRef.current = true
    setValidationError('')
    update.mutate({ actorId, learnerId, interests: [...interests], interval: value })
  }
  return (
    <div className="sasu-page sasu-settings">
      <header className="sasu-page__head">
        <p className="sasu-eyebrow">학습자 · 설정</p>
        <h1 className="sasu-title">설정</h1>
        <p className="sasu-sub">추천과 피드 복습 방식을 내 학습 습관에 맞게 바꿔요.</p>
      </header>
      {dirty ? (
        <p className="sasu-draft-notice" role="status">
          아직 저장하지 않은 변경사항이 있어요. 같은 브라우저 탭에서 다른 메뉴에 다녀와도 입력을
          복원해요. 추천에 적용하려면 저장해 주세요.
        </p>
      ) : null}
      <section className="sasu-card">
        <h2 className="sasu-card__title">관심 분야</h2>
        <p className="sasu-sub">관심 있는 분야를 여러 개 고를 수 있어요.</p>
        {interests.length === 0 && categories.length > 0 ? (
          <p className="sasu-feed__msg">관심 분야를 고르면 추천 영상이 더 정확해져요.</p>
        ) : null}
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
        <h2 className="sasu-card__title">피드 복습 간격</h2>
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
          {Number.isInteger(Number(interval)) &&
          Number(interval) >= MIN_INTERVAL &&
          Number(interval) <= MAX_INTERVAL
            ? `영상 ${Number(interval)}개를 시청 완료하면 복습 문항을 제안해요. 복습할 문항이 없으면 영상 시청을 계속해요. `
            : ''}
          1~20개 중 선택할 수 있어요. 저장한 간격은 다음 이용에도 유지돼요.
        </p>
        {validationError ? (
          <p className="sasu-field-error" role="alert">
            {validationError}
          </p>
        ) : null}
        {update.isError && !validationError ? (
          <StateBlock title="설정을 저장하지 못했어요." error={update.error} />
        ) : null}
      </section>
      <div className="sasu-row">
        <Button variant="primary" onClick={() => void save()} loading={saving}>
          저장
        </Button>
        <Button
          onClick={() => {
            clearView(draftKey)
            navigate(backTo || '/learner/feed')
          }}
          disabled={saving}
        >
          취소
        </Button>
      </div>
      {node}
    </div>
  )
}
