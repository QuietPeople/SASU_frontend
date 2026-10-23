import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { api, queryString, type ApiPage } from '../../api/client'
import { pageNumber, type CurriculumDetail, type CurriculumSummary } from '../../api/learner'
import { useSession } from '../../state/session'
import { Badge, Button, StateBlock } from '../../shared/ui'

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
  const selected = detail.data
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
      </header>
      {isPending ? (
        <StateBlock title="사용자를 불러오는 중이에요." />
      ) : error ? (
        <StateBlock title="사용자 정보를 불러오지 못했어요." text={error.message} />
      ) : !enabled ? (
        <StateBlock title="학습자를 선택해 주세요." />
      ) : list.isPending ? (
        <StateBlock title="시리즈를 불러오는 중이에요." />
      ) : list.error ? (
        <StateBlock
          title="시리즈를 불러오지 못했어요."
          text={list.error.message}
          action={<Button onClick={() => void list.refetch()}>다시 시도</Button>}
        />
      ) : (
        <>
          <div className="sasu-chips">
            {list.data?.items.map((series) => (
              <button
                key={series.curriculum_id}
                type="button"
                className={`sasu-chip sasu-chip--pick ${selectedId === series.curriculum_id ? 'is-on' : ''}`}
                onClick={() => navigate(`/learner/series/${series.curriculum_id}?${params}`)}
              >
                {series.title} {series.completed_steps ?? '—'}/{series.total_steps}
              </button>
            ))}
          </div>
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
            <StateBlock title="아직 시리즈가 없어요." />
          ) : detail.isPending ? (
            <StateBlock title="단계를 불러오는 중이에요." />
          ) : detail.error ? (
            <StateBlock
              title="단계를 불러오지 못했어요."
              text={detail.error.message}
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
              <p className="sasu-help">이용 가능한 단계는 순서와 관계없이 선택할 수 있어요.</p>
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
                          {step.content?.title ?? '이용할 수 없는 콘텐츠'}
                          <span className="sasu-table__sub">{step.content?.category?.name}</span>
                        </td>
                        <td>
                          {step.watch_completed === null
                            ? '—'
                            : step.watch_completed
                              ? '✓ 완료'
                              : '— 미완료'}
                        </td>
                        <td>
                          {!step.content?.has_quiz
                            ? '퀴즈 없음'
                            : step.question_correct === null
                              ? '—'
                              : step.question_correct
                                ? '✓ 정답'
                                : '— 미충족'}
                        </td>
                        <td>
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
                            onClick={() =>
                              navigate(`/learner/watch/${step.content_id}`, {
                                state: {
                                  context: 'CURRICULUM',
                                  curriculumId: selected.summary.curriculum_id,
                                  returnTo: `/learner/series/${selected.summary.curriculum_id}?${params}`,
                                  contentIds: selected.steps
                                    .filter((item) => item.available)
                                    .map((item) => item.content_id),
                                },
                              })
                            }
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
