import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { quizOf } from '../../state/sasuSample';
import { useStore } from '../../state/store';
import { Button, StateBlock } from '../../shared/ui';

/**
 * L07 플래시카드(공통기준 27).
 * - 앞면 질문 → 정답 확인 → 뒷면은 정답 보기의 실제 문장(번호만 표시하지 않음)
 * - 카드 열람·답 펼침은 응답 정오·복습 완료·시리즈 정답으로 기록하지 않음
 * - 열람과 펼침 횟수만 통계용으로 따로 센다(A06-05)
 */
export function FlashcardPage() {
  const { state, dispatch } = useStore();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  // list 쿼리가 있으면 그 순서, 없으면 퀴즈 있는 시청 콘텐츠 전체
  const ids = useMemo(() => {
    const listParam = params.get('list');
    if (listParam) return listParam.split(',').map(Number).filter((id) => quizOf(id));
    return Object.keys(state.records.stats).map(Number).filter((id) => quizOf(id));
  }, [params, state.records.stats]);

  const i = Math.min(Math.max(0, Number(params.get('i')) || 0), Math.max(0, ids.length - 1));
  const id = ids[i];
  const content = state.contents.find((c) => c.id === id);
  const quiz = id ? quizOf(id) : undefined;
  const [revealed, setRevealed] = useState(false);

  // 카드가 열릴 때 열람 1회 기록
  useEffect(() => {
    setRevealed(false);
    if (id) dispatch({ type: 'cardOpen', contentId: id });
  }, [id, dispatch]);

  if (ids.length === 0 || !content || !quiz) {
    return (
      <div className="sasu-page">
        <StateBlock title="이용할 수 있는 카드가 없어요." action={<Button variant="primary" onClick={() => navigate('/learner/library?tab=cards')}>목록으로</Button>} />
      </div>
    );
  }

  const go = (n: number) => navigate(`/learner/cards?${params.get('list') ? `list=${params.get('list')}&` : ''}i=${n}`);
  const reveal = () => {
    setRevealed(true);
    dispatch({ type: 'cardReveal', contentId: id });
  };

  return (
    <div className="sasu-page sasu-flash">
      <div className="sasu-review__top">
        <button type="button" className="sasu-link" onClick={() => navigate('/learner/library?tab=cards')}>
          ← 보관함으로
        </button>
        <span className="sasu-sub">
          {content.title} · {i + 1} / {ids.length}
        </span>
      </div>

      <section className="sasu-card sasu-flash__card">
        <p className="sasu-eyebrow">질문 카드</p>
        <p className="sasu-flash__q">{quiz.question}</p>
        {!revealed ? (
          <>
            <p className="sasu-muted">답을 떠올려 보세요.</p>
            <Button variant="primary" onClick={reveal}>
              정답 확인
            </Button>
          </>
        ) : (
          <div className="sasu-flash__answer" role="status">
            <span className="sasu-lp__label">정답</span>
            <p className="sasu-flash__a">{quiz.choices[quiz.answer]}</p>
            <p className="sasu-muted">{quiz.explanation}</p>
          </div>
        )}
      </section>

      <div className="sasu-row">
        <Button onClick={() => navigate(`/learner/watch/${id}?from=card&back=${i}`)}>원본 영상</Button>
        <Button onClick={() => go(Math.min(ids.length - 1, i + 1))} disabled={i >= ids.length - 1}>
          다음 카드
        </Button>
        <Button variant="ghost" onClick={() => navigate('/learner/library?tab=cards')}>
          복습 종료
        </Button>
      </div>
      <p className="sasu-help">카드 열람은 퀴즈 풀이가 아니라서 정답 제출로 기록되지 않아요.</p>
    </div>
  );
}
