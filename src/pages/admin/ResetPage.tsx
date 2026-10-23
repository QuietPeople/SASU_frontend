import { useState } from 'react';
import { request } from '../../state/sasuSample';
import { useStore } from '../../state/store';
import { Button, ConfirmDialog, useToast } from '../../shared/ui';

/**
 * A07 테스트 기록 초기화(공통기준 33).
 * - 삭제: user1 시청·응답·오답·복습·시리즈 진행·좋아요·저장
 * - 유지: 관리자 등록 영상·퀴즈·시리즈 자료
 * - 범위가 보이는 확인창. 되돌리기를 약속하지 않음. 진행 중 중복 클릭 금지
 */
export function ResetPage() {
  const { dispatch } = useStore();
  const { show, node } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await request('reset', null, 700);
      dispatch({ type: 'resetRecords' });
      setOpen(false);
      show('테스트 기록을 초기화했어요.');
    } catch {
      show('초기화하지 못했어요. 다시 시도해 주세요.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sasu-page sasu-reset">
      <header className="sasu-page__head">
        <p className="sasu-eyebrow">관리자 · 테스트 초기화</p>
        <h1 className="sasu-title">테스트 기록 초기화</h1>
      </header>

      <section className="sasu-card">
        <h2 className="sasu-card__title">삭제할 user1 기록</h2>
        <p>시청 · 응답 · 오답 · 복습 · 시리즈 진행 · 좋아요 · 저장 목록</p>
      </section>
      <section className="sasu-card">
        <h2 className="sasu-card__title">유지할 자료</h2>
        <p>관리자가 등록한 영상 · 퀴즈 · 시리즈 자료</p>
      </section>

      <Button variant="danger" onClick={() => setOpen(true)}>
        기록 초기화
      </Button>
      <p className="sasu-help">관심 분야·복기 설정의 초기화 여부는 공통기준에 없어 이 데모에서는 유지해요(P12).</p>

      <ConfirmDialog
        open={open}
        title="user1 테스트 기록을 초기화할까요?"
        confirmLabel="기록 초기화"
        danger
        busy={busy}
        onCancel={() => !busy && setOpen(false)}
        onConfirm={() => void run()}
      >
        <p>삭제: 시청·응답·오답·복습·시리즈 진행·좋아요·저장</p>
        <p>유지: 영상·퀴즈·시리즈</p>
        <p className="sasu-muted">초기화 후 되돌리기는 제공하지 않아요.</p>
      </ConfirmDialog>
      {node}
    </div>
  );
}
