import { useState } from 'react';
import { useNavigate } from 'react-router';
import { categoryName, quizOf, request, sampleSeries } from '../../state/sasuSample';
import { publicContents, useStore } from '../../state/store';
import { Badge, Button, useToast } from '../../shared/ui';

/**
 * A04 시리즈 구성(공통기준 06·28·29).
 * - 왼쪽 저장 영상 후보 / 오른쪽 지정 순서. 위·아래 이동과 제외
 * - 완료 기준은 '시청 90% AND 해당 문항 정답'으로 고정 표시(변경 옵션 없음)
 * - 퀴즈 없는 단계는 완료 조건 미충족 경고. 이전 단계 잠금 없음
 *
 * 데모 범위: 구성·순서 편집 흐름만 보여 주며 공유 데이터에는 되쓰지 않음.
 */
export function SeriesBuilderPage() {
  const { state } = useStore();
  const navigate = useNavigate();
  const { show, node } = useToast();

  const candidates = publicContents(state);
  const [name, setName] = useState(sampleSeries[0]?.name ?? '');
  const [description, setDescription] = useState(sampleSeries[0]?.description ?? '');
  const [order, setOrder] = useState<number[]>(sampleSeries[0]?.stepContentIds ?? []);
  const [busy, setBusy] = useState(false);

  const add = (id: number) => setOrder((o) => (o.includes(id) ? o : [...o, id]));
  const removeAt = (i: number) => setOrder((o) => o.filter((_, idx) => idx !== i));
  const moveUp = (i: number) => setOrder((o) => (i === 0 ? o : swap(o, i, i - 1)));
  const moveDown = (i: number) => setOrder((o) => (i === o.length - 1 ? o : swap(o, i, i + 1)));

  const save = async () => {
    if (busy) return;
    if (!name.trim() || order.length === 0) {
      show('시리즈명과 한 개 이상의 단계가 필요해요.', 'error');
      return;
    }
    setBusy(true);
    try {
      await request('seriesSave', null, 550);
      const noQuiz = order.filter((id) => !quizOf(id)).length;
      show(noQuiz ? `저장했어요. 퀴즈 없는 단계 ${noQuiz}개는 완료 조건을 못 채워요.` : '시리즈를 저장했어요.');
    } catch {
      show('저장하지 못했어요. 순서·선택은 그대로 있어요.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sasu-page sasu-form">
      <header className="sasu-page__head">
        <p className="sasu-eyebrow">관리자 · 시리즈</p>
        <h1 className="sasu-title">시리즈 구성</h1>
      </header>

      <section className="sasu-card">
        <div className="sasu-field sasu-field--block">
          <label className="sasu-field__label">시리즈명</label>
          <input className="sasu-input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="sasu-field sasu-field--block">
          <label className="sasu-field__label">설명</label>
          <input className="sasu-input" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
      </section>

      <div className="sasu-form__grid">
        <section className="sasu-card">
          <h2 className="sasu-card__title">저장된 영상 후보</h2>
          {candidates.length === 0 ? (
            <p className="sasu-muted">먼저 콘텐츠를 등록해 주세요.</p>
          ) : (
            <ul className="sasu-pick-list">
              {candidates.map((c) => (
                <li key={c.id}>
                  <span>
                    {c.title}
                    <span className="sasu-table__sub">
                      {categoryName(c.categoryId)} · {quizOf(c.id) ? '퀴즈 있음' : '퀴즈 없음'}
                    </span>
                  </span>
                  <Button size="sm" onClick={() => add(c.id)} disabled={order.includes(c.id)}>
                    {order.includes(c.id) ? '추가됨' : '추가'}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="sasu-card">
          <h2 className="sasu-card__title">학습 순서</h2>
          {order.length === 0 ? (
            <p className="sasu-muted">후보에서 영상을 추가해 순서를 만드세요.</p>
          ) : (
            <ol className="sasu-order-list">
              {order.map((id, i) => {
                const c = state.contents.find((x) => x.id === id);
                return (
                  <li key={id}>
                    <span>
                      <strong>{i + 1}.</strong> {c?.title ?? '—'} {!quizOf(id) ? <Badge tone="amber">퀴즈 없음</Badge> : null}
                    </span>
                    <span className="sasu-order-list__btns">
                      <Button size="sm" onClick={() => moveUp(i)} disabled={i === 0}>
                        ↑
                      </Button>
                      <Button size="sm" onClick={() => moveDown(i)} disabled={i === order.length - 1}>
                        ↓
                      </Button>
                      <Button size="sm" onClick={() => removeAt(i)}>
                        제외
                      </Button>
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>

      <div className="sasu-card sasu-series__criteria">
        <h2 className="sasu-card__title">완료 기준(고정)</h2>
        <p>시청 90% 이상 AND 해당 문제 정답. 콘텐츠 기본정보와 따로 시리즈에 저장돼요. 모든 단계는 잠금 없이 열려요.</p>
      </div>

      <div className="sasu-row sasu-form__actions">
        <Button variant="primary" onClick={() => void save()} loading={busy}>
          구성 저장
        </Button>
        <Button onClick={() => navigate('/learner/series')}>학습자 화면에서 보기</Button>
      </div>
      {node}
    </div>
  );
}

function swap<T>(arr: T[], a: number, b: number): T[] {
  const next = [...arr];
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}
