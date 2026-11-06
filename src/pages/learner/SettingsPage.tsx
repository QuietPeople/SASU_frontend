import { Skeleton } from '../../shared/Skeleton'
import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router'
import { api } from '../../api/client'
import { useCategories, type Category, type LearnerSettings } from '../../api/learner'
import { invalidateLearnerSettings } from '../../api/queryInvalidation'
import { useSession } from '../../state/session'
import { Button } from '../../learner/ui'
import { InterestCategoryPicker } from '../../learner/InterestCategoryPicker'
import { LearnerState as StateBlock } from '../../learner/LearnerState'
import { useToast } from '../../learner/useToast'

import { clearView, readView, writeView } from '../../features/learner-navigation/state'
import '../../learner/learning-preferences.css'

const MIN_INTERVAL = 1
const MAX_INTERVAL = 20

export function SettingsPage() {
  const session = useSession()
  const categories = useCategories(session.actorId, session.generation)
  if (session.isPending || (session.actorId !== null && categories.isPending))
    return (
      <div className="sasu-page learner-settings learner-preferences__loading">
        <Skeleton variant="form" label="설정을 불러오는 중" />
      </div>
    )
  if (session.error || categories.error)
    return (
      <div className="sasu-page learner-settings">
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
      <div className="sasu-page learner-settings">
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
  const intervalValue = Number(interval)
  const validInterval =
    interval.trim() !== '' &&
    Number.isInteger(intervalValue) &&
    intervalValue >= MIN_INTERVAL &&
    intervalValue <= MAX_INTERVAL
  const intervalMessage = `${MIN_INTERVAL}~${MAX_INTERVAL} 사이의 정수를 입력해 주세요.`
  const changeInterval = (value: string) => {
    setInterval(value)
    setValidationError('')
  }
  const stepInterval = (step: number) => {
    const current =
      interval.trim() && Number.isFinite(intervalValue)
        ? Math.trunc(intervalValue)
        : Number(baseline.interval)
    changeInterval(String(Math.min(MAX_INTERVAL, Math.max(MIN_INTERVAL, current + step))))
  }
  const save = () => {
    if (savingRef.current || actorId === null || learnerId === null || !dirty) return
    if (!validInterval) {
      setValidationError(intervalMessage)
      document.getElementById('review-interval')?.focus()
      return
    }
    savingRef.current = true
    setValidationError('')
    update.mutate({ actorId, learnerId, interests: [...interests], interval: intervalValue })
  }
  return (
    <form
      className="sasu-page learner-settings"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        save()
      }}
    >
      <header className="sasu-page__head">
        <p className="sasu-eyebrow">학습자 · 설정</p>
        <h1 className="sasu-title">설정</h1>
        <p className="sasu-sub">추천과 피드 복습 방식을 내 학습 습관에 맞게 바꿔요.</p>
      </header>
      <section className="learner-preferences__section">
        <InterestCategoryPicker
          categories={categories}
          value={interests}
          onToggle={toggle}
          disabled={saving}
        />
      </section>
      <section className="learner-preferences__section" aria-labelledby="review-interval-title">
        <div className="learner-preferences__heading">
          <div>
            <h2 id="review-interval-title">피드 복습 간격</h2>
            <p>영상을 보고 배운 내용을 얼마나 자주 돌아볼까요?</p>
          </div>
          <span className="learner-preferences__range">1~20개</span>
        </div>
        <div className="learner-interval">
          <div className="learner-interval__preview">
            <strong>{validInterval ? `영상 ${intervalValue}개` : '간격을 입력해 주세요'}</strong>
            <span>{validInterval ? '시청 완료마다 복습 카드' : '1~20개 중 선택할 수 있어요'}</span>
          </div>
          <div className="learner-interval__control">
            <label htmlFor="review-interval">시청 완료 영상 수</label>
            <div
              className="learner-interval__stepper"
              data-invalid={!!validationError || undefined}
            >
              <button
                type="button"
                aria-label="복습 간격 1개 줄이기"
                disabled={saving || (validInterval && intervalValue === MIN_INTERVAL)}
                onClick={() => stepInterval(-1)}
              >
                <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" focusable="false">
                  <path
                    d="M5 10h10"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
              <div className="learner-interval__value">
                <input
                  id="review-interval"
                  type="number"
                  inputMode="numeric"
                  min={MIN_INTERVAL}
                  max={MAX_INTERVAL}
                  step={1}
                  value={interval}
                  onChange={(event) => changeInterval(event.target.value)}
                  onBlur={() => setValidationError(validInterval ? '' : intervalMessage)}
                  disabled={saving}
                  aria-invalid={!!validationError}
                  aria-describedby={`interval-hint${validationError ? ' interval-error' : ''}`}
                />
                <span aria-hidden="true">개</span>
              </div>
              <button
                type="button"
                aria-label="복습 간격 1개 늘리기"
                disabled={saving || (validInterval && intervalValue === MAX_INTERVAL)}
                onClick={() => stepInterval(1)}
              >
                <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" focusable="false">
                  <path
                    d="M5 10h10M10 5v10"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
        <div className="learner-interval__help">
          <p id="interval-hint">
            시청 완료 기록을 기준으로 하며, 복습할 카드가 없으면 다음 영상으로 이어져요.
          </p>
          {validationError && (
            <p id="interval-error" className="learner-preferences__error" role="alert">
              {validationError}
            </p>
          )}
        </div>
      </section>
      {update.isError && (
        <StateBlock variant="toast" title="설정을 저장하지 못했어요." error={update.error} />
      )}
      <footer className="learner-settings__footer">
        <div className="learner-settings__status" data-dirty={dirty || undefined} role="status">
          <strong>
            {saving
              ? '설정을 저장하고 있어요'
              : dirty
                ? '변경사항 있음'
                : '현재 설정이 저장되어 있어요'}
          </strong>
          <span>
            {dirty
              ? '변경한 설정을 적용하려면 저장해 주세요.'
              : '원하는 학습 방식으로 조정해 보세요.'}
          </span>
        </div>
        <div className="learner-settings__actions">
          <Button
            onClick={() => {
              clearView(draftKey)
              navigate(backTo || '/learner/feed')
            }}
            disabled={saving}
          >
            취소
          </Button>
          <Button variant="primary" type="submit" loading={saving} disabled={!dirty}>
            설정 저장
          </Button>
        </div>
      </footer>
      {node}
    </form>
  )
}
