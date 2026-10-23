import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { sampleCategories, request } from '../../state/sasuSample';
import { useStore } from '../../state/store';
import { Button, useToast } from '../../shared/ui';

/**
 * L09 설정(공통기준 11·19·24).
 * - 관심 분야 복수 선택, 복기 간격(기본 5) 설정
 * - 저장 성공 후 호출 화면으로 복귀(?back=경로). 취소 시 기존 설정 유지
 * - 복기 간격은 임의로 초기화하지 않음. 입력 범위는 1~20으로 둠(P07 확정 전 안전값)
 */
const MIN_INTERVAL = 1;
const MAX_INTERVAL = 20;

export function SettingsPage() {
  const { state, dispatch } = useStore();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { show, node } = useToast();

  const [interests, setInterests] = useState<number[]>(state.records.interests);
  const [interval, setInterval] = useState(String(state.records.reviewInterval));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const backTo = params.get('back') || '';
  const toggle = (id: number) => setInterests((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const save = async () => {
    const n = Number(interval);
    if (!Number.isInteger(n) || n < MIN_INTERVAL || n > MAX_INTERVAL) {
      setError(`복기 간격은 ${MIN_INTERVAL}~${MAX_INTERVAL} 사이 정수로 입력해 주세요.`);
      return;
    }
    setSaving(true);
    setError('');
    try {
      await request('settings', null, 450);
      dispatch({ type: 'setInterests', ids: interests });
      dispatch({ type: 'setInterval', value: n });
      show('설정을 저장했어요.');
      if (backTo) navigate(backTo);
    } catch {
      setError('설정을 저장하지 못했어요. 입력값은 그대로 있으니 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => navigate(backTo || '/learner/feed');

  return (
    <div className="sasu-page sasu-settings">
      <header className="sasu-page__head">
        <p className="sasu-eyebrow">학습자 · 설정</p>
        <h1 className="sasu-title">설정</h1>
      </header>

      <section className="sasu-card">
        <h2 className="sasu-card__title">관심 분야</h2>
        <p className="sasu-sub">여러 개를 고를 수 있어요. 추천 피드 순서에 쓰여요.</p>
        <div className="sasu-chips" role="group" aria-label="관심 분야">
          {sampleCategories.map((cat) => {
            const on = interests.includes(cat.id);
            return (
              <button key={cat.id} type="button" className={`sasu-chip sasu-chip--pick ${on ? 'is-on' : ''}`} aria-pressed={on} onClick={() => toggle(cat.id)}>
                {on ? '✓ ' : ''}
                {cat.name}
              </button>
            );
          })}
        </div>
      </section>

      <section className="sasu-card">
        <h2 className="sasu-card__title">복기 간격</h2>
        <label className="sasu-field sasu-field--inline">
          <span>시청 완료 영상</span>
          <input className="sasu-input sasu-input--num" type="number" min={MIN_INTERVAL} max={MAX_INTERVAL} value={interval} onChange={(e) => setInterval(e.target.value)} aria-describedby="interval-hint" />
          <span>개마다</span>
        </label>
        <p id="interval-hint" className="sasu-help">
          기본 5개. 같은 창의 페이지 이동·새로고침에도 진행이 유지돼요(창을 닫으면 초기화).
        </p>
        {error ? (
          <p className="sasu-field-error" role="alert">
            {error}
          </p>
        ) : null}
      </section>

      <div className="sasu-row">
        <Button variant="primary" onClick={() => void save()} loading={saving}>
          저장
        </Button>
        <Button onClick={cancel} disabled={saving}>
          취소
        </Button>
      </div>
      {node}
    </div>
  );
}
