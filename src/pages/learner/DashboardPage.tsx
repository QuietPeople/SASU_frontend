import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { api } from '../../api/client'
import type { LearnerDashboard } from '../../api/learner'
import { useSession } from '../../state/session'
import { Badge, Button, StateBlock } from '../../shared/ui'

export function DashboardPage() {
  const { actorId, learnerId, generation, isPending, error } = useSession()
  const navigate = useNavigate()
  const dashboard = useQuery({
    queryKey: ['learner', 'dashboard', actorId, learnerId, generation],
    queryFn: ({ signal }) =>
      api<LearnerDashboard>(`/users/${learnerId}/dashboard`, { actorId, signal }),
    enabled: actorId !== null && learnerId !== null,
  })
  const data = dashboard.data
  return (
    <div className="sasu-page sasu-dash">
      <header className="sasu-page__head">
        <p className="sasu-eyebrow">학습자 · 대시보드</p>
        <h1 className="sasu-title">학습 대시보드</h1>
      </header>
      {isPending ? (
        <StateBlock title="사용자를 불러오는 중이에요." />
      ) : error ? (
        <StateBlock title="사용자 정보를 불러오지 못했어요." text={error.message} />
      ) : learnerId === null ? (
        <StateBlock title="학습자를 선택해 주세요." />
      ) : dashboard.isPending ? (
        <StateBlock title="학습 현황을 불러오는 중이에요." />
      ) : dashboard.error ? (
        <StateBlock
          title="학습 현황을 불러오지 못했어요."
          text={dashboard.error.message}
          action={<Button onClick={() => void dashboard.refetch()}>다시 시도</Button>}
        />
      ) : data ? (
        <>
          {data.watched_content_count === 0 &&
          data.answered_count === 0 &&
          data.pending_question_count === 0 ? (
            <StateBlock
              title="아직 학습 기록이 없어요."
              text="영상을 보고 퀴즈를 풀면 여기에 학습 현황이 쌓여요."
              action={
                <Button variant="primary" onClick={() => navigate('/learner/search')}>
                  콘텐츠 검색
                </Button>
              }
            />
          ) : null}
          <ul className="sasu-stat-row" aria-label="학습 요약">
            <li className="sasu-stat">
              <span className="sasu-stat__label">시청 완료</span>
              <strong className="sasu-stat__value">{data.completed_content_count}</strong>
            </li>
            <li className="sasu-stat">
              <span className="sasu-stat__label">미해결 오답</span>
              <strong className="sasu-stat__value">{data.pending_question_count}</strong>
            </li>
            <li className="sasu-stat">
              <span className="sasu-stat__label">최초 퀴즈 정답률</span>
              <strong className="sasu-stat__value">
                {data.first_quiz_accuracy.percent === null
                  ? '—'
                  : `${data.first_quiz_accuracy.percent}%`}
              </strong>
              <span className="sasu-stat__sub">
                정답 {data.first_quiz_accuracy.numerator} / 제출{' '}
                {data.first_quiz_accuracy.denominator}
              </span>
            </li>
          </ul>
          <p className="sasu-help">
            정답률은 최초 퀴즈의 유효 제출 기준이에요. 응답이 없으면 —로 표시해요.
          </p>
          <section className="sasu-card">
            <h2 className="sasu-card__title">개념별 상태</h2>
            {data.category_states.length === 0 ? (
              <StateBlock title="표시할 개념별 현황이 없어요." />
            ) : (
              <table className="sasu-table">
                <thead>
                  <tr>
                    <th>개념</th>
                    <th>상태</th>
                    <th aria-label="동작" />
                  </tr>
                </thead>
                <tbody>
                  {data.category_states.map((item) => (
                    <tr key={item.category.category_id}>
                      <td>{item.category.name}</td>
                      <td>
                        <Badge tone={item.state === 'NEEDS_REVIEW' ? 'amber' : 'green'}>
                          {item.state === 'NEEDS_REVIEW'
                            ? `복습 필요 · ${item.pending_question_count}문항`
                            : '미해결 오답 없음'}
                        </Badge>
                      </td>
                      <td className="sasu-table__right">
                        {item.state === 'NEEDS_REVIEW' ? (
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() =>
                              navigate(
                                `/learner/library?tab=wrong&concept=${item.category.category_id}`,
                              )
                            }
                          >
                            복습하기
                          </Button>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="sasu-help">
              미해결 오답이 없다고 해당 개념을 모두 익혔다는 뜻은 아니에요.
            </p>
          </section>
          <section className="sasu-card">
            <h2 className="sasu-card__title">시리즈 학습 현황</h2>
            {data.curriculums.length === 0 ? (
              <StateBlock title="표시할 시리즈가 없어요." />
            ) : (
              <ul className="sasu-dash__series">
                {data.curriculums.map((series) => (
                  <li key={series.curriculum_id}>
                    <span>
                      {series.title} · 완료 {series.completed_steps ?? '—'}/{series.total_steps}
                    </span>
                    <Button
                      size="sm"
                      onClick={() => navigate(`/learner/series/${series.curriculum_id}`)}
                    >
                      단계 보기
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </div>
  )
}
