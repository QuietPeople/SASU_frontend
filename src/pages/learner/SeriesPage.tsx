import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { api, queryString, type ApiPage } from '../../api/client'
import { pageNumber, type CurriculumDetail, type CurriculumSummary } from '../../api/learner'
import { useSession } from '../../state/session'
import { Badge, Button } from '../../shared/ui'
import { LearnerState as StateBlock } from '../../features/learner-navigation/LearnerState'
import { useListMemory } from '../../features/learner-navigation/useListMemory'
import '../../features/learner-navigation/learner-uiux.css'

export function SeriesPage() {
  const { actorId, learnerId, generation, isPending, error } = useSession()
  const navigate = useNavigate()
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const page = pageNumber(params.get('page'))
  const enabled = actorId !== null && learnerId !== null
  const list = useQuery({
    queryKey: ['learner', 'curriculums', actorId, learnerId, generation, page],
    queryFn: ({ signal }) =>
      api<ApiPage<CurriculumSummary>>(
        `/curriculums${queryString({ view: 'learner', user_id: learnerId, page, size: 20 })}`,
        { actorId, signal },
      ),
    enabled,
  })
  const selectedId = id ? Number(id) : list.data?.items[0]?.curriculum_id
  const validId = Number.isSafeInteger(selectedId) && Number(selectedId) > 0
  const detail = useQuery({
    queryKey: ['learner', 'curriculum', actorId, learnerId, generation, selectedId],
    queryFn: ({ signal }) =>
      api<CurriculumDetail>(
        `/curriculums/${selectedId}${queryString({ view: 'learner', user_id: learnerId })}`,
        { actorId, signal },
      ),
    enabled: enabled && validId,
  })
  const memory = useListMemory(
    `${actorId}:${learnerId}:${generation}`,
    'series',
    `${id ?? ''}:${params}`,
    list.isSuccess && detail.isSuccess,
  )
  const selected = detail.data
  const resumeStep =
    selected?.steps.find((step) => step.available && !step.completed) ??
    selected?.steps.find((step) => step.available)
  const openStep = (contentId: number) => {
    if (!selected) return
    memory.remember(selected.summary.curriculum_id)
    navigate(`/learner/watch/${contentId}`, {
      state: {
        context: 'CURRICULUM',
        curriculumId: selected.summary.curriculum_id,
        returnTo: `/learner/series/${selected.summary.curriculum_id}?${params}`,
        contentIds: selected.steps.filter((step) => step.available).map((step) => step.content_id),
      },
    })
  }
  const goPage = (next: number) => {
    const query = new URLSearchParams(params)
    query.set('page', String(next))
    setParams(query)
  }
  return (
    <div className="sasu-page sasu-series">
      <header className="sasu-page__head">
        <p className="sasu-eyebrow">학습자 · 시리즈</p>
        <h1 className="sasu-title">시리즈</h1>
        <p className="sasu-sub">단계별로 묶인 영상을 순서대로 학습해요.</p>
      </header>
      {isPending ? (
        <StateBlock title="사용자를 불러오는 중이에요." />
      ) : error ? (
        <StateBlock title="사용자 정보를 불러오지 못했어요." error={error} />
      ) : !enabled ? (
        <StateBlock title="학습자를 선택해 주세요." />
      ) : list.isPending ? (
        <StateBlock title="시리즈를 불러오는 중이에요." />
      ) : list.error ? (
        <StateBlock
          title="시리즈를 불러오지 못했어요."
          error={list.error}
          action={<Button onClick={() => void list.refetch()}>다시 시도</Button>}
        />
      ) : (
        <>
          <ul className="sasu-series-list" aria-label="학습 시리즈 목록">
            {list.data?.items.map((series) => (
              <li key={series.curriculum_id}>
                <button
                  data-list-item={series.curriculum_id}
                  type="button"
                  className={`sasu-series-choice ${selectedId === series.curriculum_id ? 'is-on' : ''}`}
                  aria-pressed={selectedId === series.curriculum_id}
                  onClick={() => navigate(`/learner/series/${series.curriculum_id}?${params}`)}
                >
                  <strong>{series.title}</strong>
                  <p className="sasu-sub">
                    {series.description || '이 시리즈의 영상을 함께 학습해 보세요.'}
                  </p>
                  <span>
                    영상 {series.total_steps}개 · 완료 {series.completed_steps ?? '—'}개 · 진행률{' '}
                    {series.progress_percent ?? 0}%
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {list.data && (page > 1 || list.data.has_next) ? (
            <div className="sasu-row" aria-label="시리즈 페이지">
              <Button disabled={page === 1 || list.isFetching} onClick={() => goPage(page - 1)}>
                이전
              </Button>
              <span>{list.data.page} 페이지</span>
              <Button
                disabled={!list.data.has_next || list.isFetching}
                onClick={() => goPage(page + 1)}
              >
                다음
              </Button>
            </div>
          ) : null}
          {id && !validId ? (
            <StateBlock title="올바른 시리즈를 선택해 주세요." />
          ) : !selectedId ? (
            <StateBlock
              title="아직 시리즈가 없어요."
              text="관리자가 시리즈를 구성하면 단계별로 학습할 수 있어요. 먼저 공개된 영상부터 둘러보세요."
              action={
                <Button variant="primary" onClick={() => navigate('/learner/search')}>
                  영상 검색하러 가기
                </Button>
              }
            />
          ) : detail.isPending ? (
            <StateBlock title="단계를 불러오는 중이에요." />
          ) : detail.error ? (
            <StateBlock
              title="단계를 불러오지 못했어요."
              error={detail.error}
              action={<Button onClick={() => void detail.refetch()}>다시 시도</Button>}
            />
          ) : selected ? (
            <section className="sasu-card">
              <div className="sasu-series__head">
                <div>
                  <h2 className="sasu-card__title">{selected.summary.title}</h2>
                  <p className="sasu-sub">{selected.summary.description}</p>
                </div>
                <span className="sasu-chip">
                  완료 {selected.summary.completed_steps ?? '—'} / {selected.summary.total_steps}
                </span>
              </div>
              <div className="sasu-progress" aria-hidden="true">
                <span style={{ width: `${selected.summary.progress_percent ?? 0}%` }} />
              </div>
              <div className="sasu-row">
                <p className="sasu-help">
                  {resumeStep && !resumeStep.completed
                    ? `다음 미완료 단계: ${resumeStep.step_order}. ${resumeStep.content?.title ?? ''}`
                    : '이용 가능한 단계는 순서와 관계없이 선택할 수 있어요.'}
                </p>
                {resumeStep ? (
                  <Button variant="primary" onClick={() => openStep(resumeStep.content_id)}>
                    {resumeStep.completed ? '다시 학습하기' : '이어서 학습하기'}
                  </Button>
                ) : null}
              </div>
              {selected.steps.length === 0 ? (
                <StateBlock title="등록된 단계가 없어요." />
              ) : (
                <table className="sasu-table">
                  <thead>
                    <tr>
                      <th>단계</th>
                      <th>시청</th>
                      <th>정답</th>
                      <th>상태</th>
                      <th aria-label="동작" />
                    </tr>
                  </thead>
                  <tbody>
                    {selected.steps.map((step) => (
                      <tr key={step.curriculum_content_id}>
                        <td>
                          <strong>{step.step_order}.</strong>{' '}
                          {step.content?.title ?? '이용할 수 없는 영상'}
                          <span className="sasu-table__sub">{step.content?.category?.name}</span>
                        </td>
                        <td>
                          <span className="sasu-series-step__mobile-label">시청</span>
                          {step.watch_completed === null
                            ? '—'
                            : step.watch_completed
                              ? '✓ 완료'
                              : '— 미완료'}
                        </td>
                        <td>
                          <span className="sasu-series-step__mobile-label">퀴즈</span>
                          {!step.content?.has_quiz
                            ? '퀴즈 없음'
                            : step.question_correct === null
                              ? '—'
                              : step.question_correct
                                ? '✓ 정답'
                                : '— 미충족'}
                        </td>
                        <td>
                          <span className="sasu-series-step__mobile-label">단계 상태</span>
                          <Badge tone={step.completed ? 'green' : 'neutral'}>
                            {!step.available
                              ? '이용 불가'
                              : step.completed === null
                                ? '—'
                                : step.completed
                                  ? '완료'
                                  : '미완료'}
                          </Badge>
                        </td>
                        <td className="sasu-table__right">
                          <Button
                            size="sm"
                            variant="primary"
                            disabled={!step.available}
                            onClick={() => openStep(step.content_id)}
                          >
                            보기
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <p className="sasu-help">
                단계 완료는 시청 90% 이상과 해당 문항 정답을 함께 충족해야 해요.
              </p>
            </section>
          ) : null}
        </>
      )}
    </div>
  )
}
