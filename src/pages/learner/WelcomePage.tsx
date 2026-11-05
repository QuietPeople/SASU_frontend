import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { api } from '../../api/client'
import { useCategories, type Category, type LearnerSettings } from '../../api/learner'
import { invalidateLearnerSettings } from '../../api/queryInvalidation'
import { useSession } from '../../state/session'
import { Button } from '../../shared/ui'
import { LearnerState as StateBlock } from '../../features/learner-navigation/LearnerState'
import './onboarding.css'

export function WelcomePage() {
  const session = useSession()
  const categories = useCategories(session.actorId, session.generation)
  if (session.isPending || (session.actorId !== null && categories.isPending))
    return (
      <div className="sasu-page">
        <StateBlock title="관심 분야를 불러오는 중이에요." />
      </div>
    )
  if (session.error || categories.error)
    return (
      <div className="sasu-page">
        <StateBlock
          title="관심 분야를 불러오지 못했어요."
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
    <WelcomeForm
      key={`${session.learnerId}:${session.generation}`}
      initial={session.settings}
      categories={categories.data?.items ?? []}
    />
  )
}

function WelcomeForm({
  initial,
  categories,
}: {
  initial: LearnerSettings
  categories: Category[]
}) {
  const { actorId, learnerId } = useSession()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [picked, setPicked] = useState(initial.interest_category_ids)
  const savingRef = useRef(false)
  const toggle = (id: number) =>
    setPicked((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    )
  const update = useMutation({
    mutationFn: ({
      actorId,
      learnerId,
      picked,
      skip,
    }: {
      actorId: number
      learnerId: number
      picked: number[]
      skip: boolean
    }) =>
      api<LearnerSettings>(`/users/${learnerId}/settings`, {
        method: 'PATCH',
        actorId,
        body: skip
          ? { interest_guide_completed: true }
          : { interest_category_ids: picked, interest_guide_completed: true },
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
      navigate('/learner/feed')
    },
    onSettled: () => {
      savingRef.current = false
    },
  })
  const saving = update.isPending ? (update.variables.skip ? 'skip' : 'start') : null
  const start = (skip: boolean) => {
    if (savingRef.current || actorId === null || learnerId === null || (!skip && !picked.length))
      return
    savingRef.current = true
    update.mutate({ actorId, learnerId, picked: [...picked], skip })
  }
  return (
    <div className="sasu-page sasu-onboard sasu-ob">
      <div className="sasu-onboard__box">
        {/* 안내 */}
        <header className="sasu-ob__head">
          <p className="sasu-eyebrow">SASU 시작하기</p>
          <h1 className="sasu-title">관심 있는 분야를 알려주세요</h1>
          <p className="sasu-sub">
            여러 개를 고를 수 있어요. 나중에 설정에서 언제든 바꿀 수 있어요.
          </p>
        </header>

        {/* 관심 분야 선택 */}
        {categories.length === 0 ? (
          <div className="sasu-ob__pick">
            <StateBlock title="아직 등록된 분야가 없어요." text="건너뛰고 바로 시작할 수 있어요." />
          </div>
        ) : (
          <section className="sasu-ob__pick">
            <div className="sasu-ob__pickhead">
              <span className="sasu-ob__picklabel">관심 분야</span>
              <span className={`sasu-ob__count ${picked.length ? 'is-on' : ''}`} aria-live="polite">
                {picked.length}개 선택됨
              </span>
            </div>
            <div className="sasu-chips" role="group" aria-label="관심 분야">
              {categories.map((category) => (
                <button
                  key={category.category_id}
                  type="button"
                  className={`sasu-chip sasu-chip--pick ${picked.includes(category.category_id) ? 'is-on' : ''}`}
                  aria-pressed={picked.includes(category.category_id)}
                  disabled={saving !== null}
                  onClick={() => toggle(category.category_id)}
                >
                  {picked.includes(category.category_id) ? '✓ ' : ''}
                  {category.name}
                </button>
              ))}
            </div>
          </section>
        )}

        {update.isError ? (
          <StateBlock title="관심 분야를 저장하지 못했어요." error={update.error} />
        ) : null}

        {/* 시작 */}
        <div className="sasu-ob__actions">
          <Button
            variant="primary"
            onClick={() => void start(false)}
            disabled={!picked.length || saving !== null}
            loading={saving === 'start'}
          >
            선택하고 시작
          </Button>
          <Button
            variant="ghost"
            onClick={() => void start(true)}
            disabled={saving !== null}
            loading={saving === 'skip'}
          >
            건너뛰기
          </Button>
        </div>

        <p className="sasu-help sasu-ob__foot">
          선택한 관심 분야와 안내 완료 여부를 계정에 저장해요.
        </p>
      </div>
    </div>
  )
}
