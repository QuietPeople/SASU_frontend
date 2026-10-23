import { useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { PATH_LABEL, type QuizResponse } from '../../types/sasu';
import { publicContents, useStore } from '../../state/store';
import { Badge, ratio } from '../../shared/ui';

/**
 * A06 콘텐츠 반응·학습 통계(공통기준 14·15·18·25·30·31).
 * - 대상: 전체 또는 특정 콘텐츠
 * - 최초 풀이(영상 종료)와 피드 복기를 나눠 정답률 집계. 복기는 모든 유효 제출 포함(공통기준 30)
 * - 분모 0은 — (응답 없음)으로 표시하고 0%로 표시하지 않음
 * - 건너뛰기·카드 답 펼침은 정답률 분모에서 제외. 반복 오답·카드·시리즈는 따로 표시
 * - 응답 상세는 제출 당시 버전으로 보여 줌(최신 정답으로 과거 결과를 덮지 않음)
 */
export function StatsPage() {
  const { state } = useStore();
  const { id } = useParams();
  const r = state.records;
  const [target, setTarget] = useState<string>(id ?? '');

  const targetId = target ? Number(target) : null;
  const inTarget = (contentId: number) => targetId === null || contentId === targetId;

  const targetContents = useMemo(() => publicContents(state).filter((c) => targetId === null || c.id === targetId), [state, targetId]);

  const viewed = targetContents.filter((c) => r.stats[c.id]?.viewed).length;
  const completed = targetContents.filter((c) => r.stats[c.id]?.completed).length;
  const likes = targetContents.filter((c) => r.liked.includes(c.id)).length;
  const completeRate = ratio(completed, viewed);

  const responses = r.responses.filter((x) => inTarget(x.contentId));
  const endValid = responses.filter((x) => x.path === 'END' && x.result !== 'SKIPPED');
  const endCorrect = endValid.filter((x) => x.result === 'CORRECT').length;
  const reviewValid = responses.filter((x) => x.path === 'REVIEW' && x.result !== 'SKIPPED');
  const reviewCorrect = reviewValid.filter((x) => x.result === 'CORRECT').length;
  const skipped = responses.filter((x) => x.result === 'SKIPPED').length;

  const endRate = ratio(endCorrect, endValid.length);
  const reviewRate = ratio(reviewCorrect, reviewValid.length);

  // 종료 퀴즈 참여율·복기 응답률(분모는 노출 수)
  const endExposure = targetContents.reduce((sum, c) => sum + (r.seriesQuizExposure[c.id] ?? 0), 0);
  const endAllSubmits = responses.filter((x) => x.path === 'END').length;
  const participation = ratio(endAllSubmits, endExposure);
  const reviewAllSubmits = responses.filter((x) => x.path === 'REVIEW').length;
  const reviewResponse = ratio(reviewAllSubmits, targetId === null ? r.reviewExposure : reviewAllSubmits);

  // 정답률 변화: 한쪽 응답이 없으면 비교 불가(—)
  const deltaText = endRate.pct !== null && reviewRate.pct !== null ? `${reviewRate.pct - endRate.pct > 0 ? '+' : ''}${reviewRate.pct - endRate.pct}%p` : '— (비교 불가)';

  // 복습·시리즈 기록
  const repeatWrong = Object.entries(
    responses.filter((x) => x.result === 'WRONG').reduce<Record<number, number>>((acc, x) => {
      acc[x.contentId] = (acc[x.contentId] ?? 0) + 1;
      return acc;
    }, {}),
  ).filter(([, n]) => n >= 1);
  const cardLogs = Object.entries(r.cardLogs).filter(([cid]) => inTarget(Number(cid)));

  return (
    <div className="sasu-page sasu-stats">
      <header className="sasu-page__head">
        <p className="sasu-eyebrow">관리자 · 통계</p>
        <h1 className="sasu-title">콘텐츠 반응·학습 통계</h1>
      </header>

      <label className="sasu-field sasu-field--block">
        <span className="sasu-field__label">대상 콘텐츠</span>
        <select className="sasu-input" value={target} onChange={(e) => setTarget(e.target.value)}>
          <option value="">전체 콘텐츠</option>
          {publicContents(state).map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </label>

      <ul className="sasu-stat-row" aria-label="시청·이용 반응">
        <li className="sasu-stat">
          <span className="sasu-stat__label">조회수</span>
          <strong className="sasu-stat__value">{viewed}</strong>
          <span className="sasu-stat__sub">user1·콘텐츠 최초 1회</span>
        </li>
        <li className="sasu-stat">
          <span className="sasu-stat__label">좋아요</span>
          <strong className="sasu-stat__value">{likes}</strong>
        </li>
        <li className="sasu-stat">
          <span className="sasu-stat__label">시청 완료율</span>
          <strong className="sasu-stat__value">{completeRate.text}</strong>
          <span className="sasu-stat__sub">
            완료 {completed} / 대상 {viewed}
          </span>
        </li>
      </ul>

      <div className="sasu-form__grid">
        <section className="sasu-card">
          <h2 className="sasu-card__title">최초 풀이(영상 종료)</h2>
          <p className="sasu-stat__big">{endRate.text}</p>
          <p className="sasu-muted">
            정답 {endCorrect} / 제출 {endValid.length}
          </p>
        </section>
        <section className="sasu-card">
          <h2 className="sasu-card__title">피드 복기 · 모든 응답</h2>
          <p className="sasu-stat__big">{reviewRate.text}</p>
          <p className="sasu-muted">
            정답 {reviewCorrect} / 제출 {reviewValid.length} · 건너뜀 {skipped}
          </p>
        </section>
      </div>

      <table className="sasu-table">
        <thead>
          <tr>
            <th>학습 지표</th>
            <th>표시</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>영상 종료 퀴즈 참여율</td>
            <td>
              {participation.text} <span className="sasu-muted">(제출 {endAllSubmits} / 노출 {endExposure})</span>
            </td>
          </tr>
          <tr>
            <td>피드 복기 응답률</td>
            <td>
              {reviewResponse.text} <span className="sasu-muted">(제출 {reviewAllSubmits} / 복기 노출 {targetId === null ? r.reviewExposure : reviewAllSubmits})</span>
            </td>
          </tr>
          <tr>
            <td>정답률 변화(복기 − 최초)</td>
            <td>{deltaText}</td>
          </tr>
        </tbody>
      </table>
      <p className="sasu-help">분모가 0이면 — (응답 없음)으로 표시해요. 표본·분모가 다른 정답률 차이를 학습 효과로 단정하지 않아요.</p>

      <section className="sasu-card">
        <h2 className="sasu-card__title">응답 상세</h2>
        {responses.length === 0 ? (
          <p className="sasu-muted">아직 응답이 없어요. (불러오기 실패와는 다른 상태예요.)</p>
        ) : (
          <table className="sasu-table">
            <thead>
              <tr>
                <th>문항(콘텐츠)</th>
                <th>버전</th>
                <th>풀이 경로</th>
                <th>정오</th>
                <th>제출 시각</th>
              </tr>
            </thead>
            <tbody>
              {responses.map((x: QuizResponse) => (
                <tr key={x.id}>
                  <td>{state.contents.find((c) => c.id === x.contentId)?.title ?? '—'}</td>
                  <td>v{x.version}</td>
                  <td>{PATH_LABEL[x.path]}</td>
                  <td>
                    {x.result === 'CORRECT' ? <Badge tone="green">정답</Badge> : x.result === 'WRONG' ? <Badge tone="red">오답</Badge> : <Badge tone="neutral">건너뜀</Badge>}
                  </td>
                  <td>{x.at.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="sasu-card">
        <h2 className="sasu-card__title">복습·시리즈 기록</h2>
        <ul className="sasu-stats__misc">
          <li>
            반복 오답 문항:{' '}
            {repeatWrong.length ? repeatWrong.map(([cid, n]) => `${state.contents.find((c) => c.id === Number(cid))?.title ?? cid}(${n}회)`).join(', ') : '없음'}
          </li>
          <li>
            카드 열람·답 펼침:{' '}
            {cardLogs.length ? cardLogs.map(([cid, log]) => `${state.contents.find((c) => c.id === Number(cid))?.title ?? cid}(열람 ${log.opened}·펼침 ${log.revealed})`).join(', ') : '없음'}
          </li>
        </ul>
        <p className="sasu-help">카드 답 펼침은 정답 제출·문항 해결로 계산하지 않아요.</p>
      </section>
    </div>
  );
}
