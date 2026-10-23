import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router';
import { categoryName, quizOf } from '../../state/sasuSample';
import { useStore } from '../../state/store';
import { QuizView } from '../../shared/QuizView';
import { Button, StateBlock } from '../../shared/ui';

/**
 * L06 오답 복습(공통기준 03·17·18·25·26·28).
 * - 보관함·대시보드에서 고른 미해결 문항을 C01 규칙으로 풀이
 * - 정답이면 미해결 오답 해소(이력은 유지). 오답·건너뛰기는 미해결 유지
 * - 원본 영상 보기는 L02로 이동하며 같은 문항으로 복귀할 수 있게 함
 */
export function ReviewPage() {
  const { state, dispatch } = useStore();
  const navigate = useNavigate();
  const { contentId } = useParams();
  const id = Number(contentId);

  const content = state.contents.find((c) => c.id === id);
  const quiz = quizOf(id);

  // 다음 미해결 오답(현재 문항 제외)
  const nextWrong = useMemo(
    () => Object.entries(state.records.wrongNotes).find(([cid, status]) => Number(cid) !== id && status === 'PENDING')?.[0],
    [state.records.wrongNotes, id],
  );

  const status = state.records.wrongNotes[id];

  if (!content || !quiz) {
    return (
      <div className="sasu-page">
        <StateBlock title="복습할 문항을 찾지 못했어요." action={<Button variant="primary" onClick={() => navigate('/learner/library?tab=wrong')}>보관함으로</Button>} />
      </div>
    );
  }

  if (status !== 'PENDING') {
    // 다른 화면에서 이미 해결된 경우(공통기준 26)
    return (
      <div className="sasu-page sasu-review">
        <button type="button" className="sasu-link" onClick={() => navigate('/learner/library?tab=wrong')}>
          ← 보관함으로
        </button>
        <StateBlock
          title="이미 해결된 문항이에요."
          text="다른 화면에서 정답을 맞혀 미해결 상태가 풀렸어요."
          action={nextWrong ? <Button variant="primary" onClick={() => navigate(`/learner/review/${nextWrong}`)}>다음 복습</Button> : <Button variant="primary" onClick={() => navigate('/learner/library?tab=wrong')}>보관함으로</Button>}
        />
      </div>
    );
  }

  return (
    <div className="sasu-page sasu-review">
      <div className="sasu-review__top">
        <button type="button" className="sasu-link" onClick={() => navigate('/learner/library?tab=wrong')}>
          ← 보관함으로
        </button>
        <span className="sasu-sub">
          미해결 오답 · {content.title} · {categoryName(content.categoryId)}
        </span>
      </div>

      <section className="sasu-card">
        <QuizView
          quiz={quiz}
          context={`원본 영상: ${content.title}`}
          onSubmit={(picked, result) => {
            dispatch({ type: 'answer', contentId: id, path: 'WRONG', picked, result, at: new Date().toISOString() });
          }}
          footer={(result) => (
            <div className="sasu-row">
              <Button onClick={() => navigate(`/learner/watch/${id}?from=wrong&back=${id}`)}>원본 영상 보기</Button>
              {result === 'CORRECT' ? (
                nextWrong ? (
                  <Button variant="primary" onClick={() => navigate(`/learner/review/${nextWrong}`)}>
                    다음 복습 →
                  </Button>
                ) : (
                  <Button variant="primary" onClick={() => navigate('/learner/library?tab=wrong')}>
                    모두 확인했어요
                  </Button>
                )
              ) : (
                <Button onClick={() => navigate('/learner/library?tab=wrong')}>보관함으로</Button>
              )}
            </div>
          )}
        />
        {status === 'PENDING' ? <p className="sasu-help">정답을 맞히면 미해결 오답이 풀려요. 건너뛰기는 추가 오답으로 기록하지 않아요.</p> : null}
      </section>
    </div>
  );
}
