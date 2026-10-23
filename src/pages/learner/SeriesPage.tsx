import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router';
import { categoryName, quizOf, sampleSeries } from '../../state/sasuSample';
import { useStore } from '../../state/store';
import type { AppState } from '../../state/store';
import { Badge, Button, StateBlock } from '../../shared/ui';

/**
 * L04 시리즈 목록·단계 상세(공통기준 16·28·29).
 * - 단계는 지정 순서로 표시하며 잠금 없음. 어느 단계든 열 수 있음
 * - 단계 완료 = 시청 90% 이상 AND 해당 문항 정답 이력(어느 경로의 정답이든 반영)
 * - 퀴즈 없는 단계는 시청은 되지만 완료 조건 미충족으로 표시
 */

// 단계 상태 계산. 시청 완료와 정답 이력을 따로 본 뒤 둘 다 충족해야 완료
function stepState(state: AppState, contentId: number) {
  const watched = Boolean(state.records.stats[contentId]?.completed);
  const hasQuiz = Boolean(quizOf(contentId));
  const answered = state.records.responses.some((r) => r.contentId === contentId && r.result === 'CORRECT');
  const done = watched && hasQuiz && answered;
  return { watched, hasQuiz, answered, done };
}

export function SeriesPage() {
  const { state } = useStore();
  const navigate = useNavigate();
  const { id } = useParams();

  const selected = useMemo(() => {
    if (id) return sampleSeries.find((s) => String(s.id) === id);
    return sampleSeries[0];
  }, [id]);

  if (sampleSeries.length === 0) {
    return (
      <div className="sasu-page">
        <StateBlock title="아직 시리즈가 없어요." action={<Button variant="primary" onClick={() => navigate('/learner/feed')}>피드 보기</Button>} />
      </div>
    );
  }

  return (
    <div className="sasu-page sasu-series">
      <header className="sasu-page__head">
        <p className="sasu-eyebrow">학습자 · 시리즈</p>
        <h1 className="sasu-title">시리즈</h1>
      </header>

      <div className="sasu-chips">
        {sampleSeries.map((s) => {
          const done = s.stepContentIds.filter((c) => stepState(state, c).done).length;
          return (
            <button key={s.id} type="button" className={`sasu-chip sasu-chip--pick ${selected?.id === s.id ? 'is-on' : ''}`} onClick={() => navigate(`/learner/series/${s.id}`)}>
              {s.name} {done}/{s.stepContentIds.length}
            </button>
          );
        })}
      </div>

      {selected ? (
        <section className="sasu-card">
          {(() => {
            const done = selected.stepContentIds.filter((c) => stepState(state, c).done).length;
            const total = selected.stepContentIds.length;
            return (
              <>
                <div className="sasu-series__head">
                  <div>
                    <h2 className="sasu-card__title">{selected.name}</h2>
                    <p className="sasu-sub">{selected.description}</p>
                  </div>
                  <span className="sasu-chip">
                    완료 {done} / {total}
                  </span>
                </div>
                <div className="sasu-progress" aria-hidden="true">
                  <span style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
                </div>
                <p className="sasu-help">어느 단계든 선택해 볼 수 있어요. 미완료 단계도 열려요.</p>

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
                    {selected.stepContentIds.map((cid, i) => {
                      const content = state.contents.find((c) => c.id === cid);
                      const st = stepState(state, cid);
                      const status = st.done ? '완료' : st.watched || st.answered ? '진행 중' : '미완료';
                      return (
                        <tr key={cid}>
                          <td>
                            <strong>{i + 1}.</strong> {content?.title ?? '—'}
                            <span className="sasu-table__sub">{content ? categoryName(content.categoryId) : ''}</span>
                          </td>
                          <td>{st.watched ? '✓ 완료' : '— 미완료'}</td>
                          <td>{!st.hasQuiz ? '퀴즈 없음' : st.answered ? '✓ 정답' : '— 미충족'}</td>
                          <td>
                            <Badge tone={st.done ? 'green' : status === '진행 중' ? 'blue' : 'neutral'}>{status}</Badge>
                          </td>
                          <td className="sasu-table__right">
                            <Button size="sm" variant="primary" onClick={() => navigate(`/learner/watch/${cid}?from=series&series=${selected.id}`)}>
                              보기
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p className="sasu-help">단계 완료는 영상 끝 도달이 아니라 시청 90% 이상과 해당 문항 정답을 함께 충족해야 해요.</p>
              </>
            );
          })()}
        </section>
      ) : null}
    </div>
  );
}
