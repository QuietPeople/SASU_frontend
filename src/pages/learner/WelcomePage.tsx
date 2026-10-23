import { useState } from 'react';
import { useNavigate } from 'react-router';
import { sampleCategories, request } from '../../state/sasuSample';
import { useStore } from '../../state/store';
import { Button, StateBlock } from '../../shared/ui';

/**
 * L01 첫 이용 관심 분야 안내(공통기준 11·12·13).
 * - 관리자가 등록한 분야를 칩으로 보여 주고 복수 선택
 * - 선택하고 시작: 저장 성공 후 L02로 이동. 건너뛰기: 선택 없이 L02로
 * - 선택한 분야가 없으면 선택하고 시작 비활성(건너뛰기는 항상 가능, P01)
 */
export function WelcomePage() {
  const { state, dispatch } = useStore();
  const navigate = useNavigate();
  const [picked, setPicked] = useState<number[]>(state.records.interests);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const toggle = (id: number) => {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  };

  const start = async () => {
    if (!picked.length || saving) return;
    setSaving(true);
    setError('');
    try {
      await request('interests', null, 500);
      dispatch({ type: 'setInterests', ids: picked });
      dispatch({ type: 'onboard' });
      navigate('/learner/feed');
    } catch {
      setError('관심 분야를 저장하지 못했어요. 고른 분야는 그대로 있으니 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  };

  const skip = () => {
    dispatch({ type: 'onboard' });
    navigate('/learner/feed');
  };

  return (
    <div className="sasu-page sasu-onboard">
      <div className="sasu-onboard__box">
        <p className="sasu-eyebrow">SASU 시작하기</p>
        <h1 className="sasu-title">관심 있는 분야를 알려주세요</h1>
        <p className="sasu-sub">나중에 설정에서 바꿀 수 있어요.</p>

        {sampleCategories.length === 0 ? (
          <StateBlock title="아직 등록된 분야가 없어요." text="건너뛰고 바로 시작할 수 있어요." />
        ) : (
          <div className="sasu-chips" role="group" aria-label="관심 분야">
            {sampleCategories.map((cat) => {
              const on = picked.includes(cat.id);
              return (
                <button key={cat.id} type="button" className={`sasu-chip sasu-chip--pick ${on ? 'is-on' : ''}`} aria-pressed={on} onClick={() => toggle(cat.id)}>
                  {on ? '✓ ' : ''}
                  {cat.name}
                </button>
              );
            })}
          </div>
        )}

        {error ? (
          <p className="sasu-field-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="sasu-row sasu-onboard__btns">
          <Button variant="primary" onClick={() => void start()} disabled={!picked.length || saving} loading={saving}>
            선택하고 시작
          </Button>
          <Button variant="ghost" onClick={skip} disabled={saving}>
            건너뛰기
          </Button>
        </div>
        <p className="sasu-help">건너뛰면 관심·시청 기록이 없을 때 최신 등록순으로 보여 줘요.</p>
      </div>
    </div>
  );
}
