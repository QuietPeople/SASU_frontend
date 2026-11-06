import { Skeleton } from '../../shared/Skeleton'
import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { api } from '../../api/client'
import { useCategories, type Category, type LearnerSettings } from '../../api/learner'
import { invalidateLearnerSettings } from '../../api/queryInvalidation'
import { useSession } from '../../state/session'
import { Button } from '../../learner/ui'
import { InterestCategoryPicker } from '../../learner/InterestCategoryPicker'
import { LearnerState as StateBlock } from '../../learner/LearnerState'
import '../../learner/learning-preferences.css'

export function WelcomePage() {
  const session = useSession()
  const categories = useCategories(session.actorId, session.generation)
  if (session.isPending || (session.actorId !== null && categories.isPending))
    return (
      <div className="sasu-page learner-welcome learner-preferences__loading">
        <Skeleton variant="form" label="관심 분야를 불러오는 중" />
      </div>
    )
  if (session.error || categories.error)
    return (
      <div className="sasu-page learner-welcome">
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
      <div className="sasu-page learner-welcome">
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
    <div className="sasu-page learner-welcome">
      <div className="learner-welcome__card">
        <header className="learner-welcome__head">
          <span className="learner-welcome__mark" aria-hidden="true">
            S
          </span>
          <p className="sasu-eyebrow">SASU 시작하기</p>
          <h1 className="sasu-title">어떤 분야에 관심이 있나요?</h1>
          <p className="sasu-sub">관심 분야를 골라주시면, 나에게 맞는 학습 영상을 추천해 드려요.</p>
        </header>
        <section className="learner-welcome__interests">
          <InterestCategoryPicker
            categories={categories}
            value={picked}
            onToggle={toggle}
            disabled={saving !== null}
          />
        </section>

        {update.isError ? (
          <StateBlock variant="toast" title="관심 분야를 저장하지 못했어요." error={update.error} />
        ) : null}

        <div className="learner-welcome__actions">
          <Button
            variant="primary"
            onClick={() => void start(false)}
            disabled={!picked.length || saving !== null}
            loading={saving === 'start'}
          >
            선택하고 시작하기
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

        <p className="learner-welcome__foot">
          {categories.length
            ? '관심 분야는 설정에서 언제든 바꿀 수 있어요.'
            : '분야 선택을 건너뛰고 바로 시작할 수 있어요.'}
        </p>
      </div>
    </div>
  )
}
