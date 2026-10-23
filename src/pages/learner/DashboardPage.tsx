import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { quizOf, sampleCategories, sampleSeries } from '../../state/sasuSample';
import { publicContents, useStore } from '../../state/store';
import { Badge, Button, StateBlock, ratio } from '../../shared/ui';

/**
 * L08 학습 대시보드(공통기준 26·28·34).
 * - 요약: 시청 완료 수, 미해결 오답 수, 퀴즈 정답률(정답 n / 제출 m)
 * - 정답률은 건너뛰기를 뺀 유효 제출만. 제출이 없으면 — (응답 없음)
 * - 개념별 상태: 미해결 오답 유무로 복습 필요 / 미해결 없음 / 학습 기록 없음
 * - 진행 중 시리즈: 완료 n/m
 */
export function DashboardPage() {
  const { state } = useStore();
  const navigate = useNavigate();
  const r = state.records;

  const completedCount = Object.values(r.stats).filter((s) => s.completed).length;
  const pendingCount = Object.values(r.wrongNotes).filter((s) => s === 'PENDING').length;

  // 유효 제출(건너뛰기 제외)에서 정답 비율
  const valid = r.responses.filter((x) => x.result !== 'SKIPPED');
  const correct = valid.filter((x) => x.result === 'CORRECT').length;
  const accuracy = ratio(correct, valid.length);
  const reviewSubmits = valid.filter((x) => x.path === 'REVIEW').length;

  // 개념(분야)별 상태. 공개 콘텐츠가 있는 분야만 보여 줌(P06은 분야 단위로 처리)
  const conceptRows = useMemo(() => {
    const pub = publicContents(state);
    return sampleCategories
      .map((cat) => {
        const items = pub.filter((c) => c.categoryId === cat.id);
        if (!items.length) return null;
        const pending = items.some((c) => r.wrongNotes[c.id] === 'PENDING' && quizOf(c.id));
        const touched = items.some((c) => r.stats[c.id]?.completed || r.responses.some((x) => x.contentId === c.id));
        const status = pending ? '복습 필요' : touched ? '미해결 오답 없음' : '학습 기록 없음';
        return { cat, status, pending };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x));
  }, [state, r]);

  const seriesRows = sampleSeries.map((s) => {
    const done = s.stepContentIds.filter((cid) => r.stats[cid]?.completed && r.responses.some((x) => x.contentId === cid && x.result === 'CORRECT')).length;
    return { s, done, total: s.stepContentIds.length };
  });

  const hasHistory = completedCount > 0 || valid.length > 0 || pendingCount > 0;

  if (!hasHistory) {
    return (
      <div className="sasu-page">
        <header className="sasu-page__head">
          <p className="sasu-eyebrow">학습자 · 대시보드</p>
          <h1 className="sasu-title">학습 대시보드</h1>
        </header>
        <StateBlock title="아직 학습 기록이 없어요." text="피드에서 영상을 보면 여기에 요약이 쌓여요." action={<Button variant="primary" onClick={() => navigate('/learner/feed')}>피드 보기</Button>} />
      </div>
    );
  }

  return (
    <div className="sasu-page sasu-dash">
      <header className="sasu-page__head">
        <p className="sasu-eyebrow">학습자 · 대시보드</p>
        <h1 className="sasu-title">학습 대시보드</h1>
      </header>

      <ul className="sasu-stat-row" aria-label="학습 요약">
        <li className="sasu-stat">
          <span className="sasu-stat__label">시청 완료</span>
          <strong className="sasu-stat__value">{completedCount}</strong>
        </li>
        <li className="sasu-stat">
          <span className="sasu-stat__label">미해결 오답</span>
          <strong className="sasu-stat__value">{pendingCount}</strong>
        </li>
        <li className="sasu-stat">
          <span className="sasu-stat__label">퀴즈 정답률</span>
          <strong className="sasu-stat__value">{accuracy.text}</strong>
          <span className="sasu-stat__sub">
            정답 {correct} / 제출 {valid.length}
          </span>
        </li>
      </ul>
      <p className="sasu-help">정답률은 건너뛰기를 뺀 유효 제출 기준이에요. 그중 피드 복기 제출은 {reviewSubmits}건이에요.</p>

      <section className="sasu-card">
        <h2 className="sasu-card__title">개념별 상태</h2>
        <table className="sasu-table">
          <thead>
            <tr>
              <th>개념</th>
              <th>상태</th>
              <th aria-label="동작" />
            </tr>
          </thead>
          <tbody>
            {conceptRows.map(({ cat, status, pending }) => (
              <tr key={cat.id}>
                <td>{cat.name}</td>
                <td>
                  <Badge tone={pending ? 'amber' : status === '미해결 오답 없음' ? 'green' : 'neutral'}>{status}</Badge>
                </td>
                <td className="sasu-table__right">
                  {pending ? (
                    <Button size="sm" variant="primary" onClick={() => navigate(`/learner/library?tab=wrong&concept=${cat.id}`)}>
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
        <p className="sasu-help">미해결 오답이 없다고 해당 개념을 모두 익혔다는 뜻은 아니에요.</p>
      </section>

      <section className="sasu-card">
        <h2 className="sasu-card__title">진행 중 시리즈</h2>
        <ul className="sasu-dash__series">
          {seriesRows.map(({ s, done, total }) => (
            <li key={s.id}>
              <span>
                {s.name} · 완료 {done}/{total}
              </span>
              <Button size="sm" onClick={() => navigate(`/learner/series/${s.id}`)}>
                단계 보기
              </Button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
