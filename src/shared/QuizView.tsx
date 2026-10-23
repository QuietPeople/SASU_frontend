import { useState, type ReactNode } from 'react';
import type { Quiz, QuizResult } from '../types/sasu';
import { request } from '../state/sasuSample';
import { Button } from './ui';

// C01 공통 문제 풀이·정답 해설 상태.
// 영상 종료 퀴즈(L02)·오답 복습(L06)·피드 복기(C02)가 모두 이 컴포넌트를 쓴다.
// - 질문 → 보기 → 제출 → 결과·해설 순서. 한 보기를 골라야 제출 가능
// - 제출 성공 뒤 보기와 제출 버튼을 잠그고 재도전 버튼을 두지 않음(공통기준 18)
// - 해설은 사용자가 다음 행동을 고를 때까지 유지(타이머·자동 이동 없음)
// - 서버 확인 없이 정답 처리하지 않음. 저장 실패 시 고른 답을 유지하고 다시 시도 안내(공통기준 25 예외)

const LETTERS = ['A', 'B', 'C', 'D'];

interface QuizViewProps {
  quiz: Quiz;
  context?: string; // 원본 콘텐츠 문맥(예: 영상 제목)
  // 제출 성공 시 부모가 응답을 기록함. 실패하면 throw 해서 다시 시도 안내를 띄움
  onSubmit: (picked: number, result: QuizResult) => Promise<void> | void;
  onSkip?: () => void; // 제출 전 건너뛰기(부모가 건너뛴 사실을 기록)
  footer?: (result: QuizResult | null) => ReactNode; // 결과에 따른 다음 행동 버튼
}

export function QuizView({ quiz, context, onSubmit, onSkip, footer }: QuizViewProps) {
  const [picked, setPicked] = useState<number | null>(null);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const letters = quiz.format === 'OX' ? ['O', 'X'] : LETTERS;
  const locked = result === 'CORRECT' || result === 'WRONG';

  const submit = async () => {
    if (picked === null || submitting) return;
    setSubmitting(true);
    setError('');
    const judged: QuizResult = picked === quiz.answer ? 'CORRECT' : 'WRONG';
    try {
      await request('quizAnswer', null, 550);
      await onSubmit(picked, judged);
      setResult(judged); // 서버 성공 뒤에만 결과 확정
    } catch {
      setError('답을 저장하지 못했어요. 고른 답은 그대로 있으니 다시 확인을 눌러 주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  const skip = () => {
    if (locked) return;
    setResult('SKIPPED');
    onSkip?.();
  };

  return (
    <div className="sasu-quiz">
      {context ? <p className="sasu-quiz__context">{context}</p> : null}
      <p className="sasu-quiz__q">{quiz.question}</p>

      <ul className="sasu-quiz__choices" role="radiogroup" aria-label="보기">
        {quiz.choices.map((choice, i) => {
          const isPicked = picked === i;
          const isAnswer = locked && i === quiz.answer;
          const isWrongPick = result === 'WRONG' && isPicked;
          return (
            <li key={choice}>
              <button
                type="button"
                role="radio"
                aria-checked={isPicked}
                disabled={locked || result === 'SKIPPED'}
                className={`sasu-choice ${isPicked ? 'is-picked' : ''} ${isAnswer ? 'is-answer' : ''} ${isWrongPick ? 'is-wrong' : ''}`}
                onClick={() => setPicked(i)}
              >
                <span className="sasu-choice__letter" aria-hidden="true">
                  {letters[i]}
                </span>
                <span className="sasu-choice__text">{choice}</span>
                {isAnswer ? <span className="sasu-choice__mark">✓ 정답</span> : null}
                {isWrongPick ? <span className="sasu-choice__mark is-wrong">✕ 내 답</span> : null}
              </button>
            </li>
          );
        })}
      </ul>

      {error ? (
        <p className="sasu-quiz__error" role="alert">
          {error}
        </p>
      ) : null}

      {result === null ? (
        <div className="sasu-row">
          {onSkip ? (
            <Button onClick={skip} disabled={submitting}>
              건너뛰기
            </Button>
          ) : null}
          <Button variant="primary" onClick={() => void submit()} disabled={picked === null || submitting} loading={submitting}>
            {submitting ? '확인 중' : '제출'}
          </Button>
        </div>
      ) : result === 'SKIPPED' ? (
        <div className="sasu-result" role="status">
          <p className="sasu-result__title">건너뛰었어요</p>
          <p>건너뛴 사실만 기록하고 오답·복습 대기에는 넣지 않아요.</p>
          {footer ? <div className="sasu-result__foot">{footer(result)}</div> : null}
        </div>
      ) : (
        <div className={`sasu-result ${result === 'CORRECT' ? 'is-correct' : 'is-wrong'}`} role="status">
          <p className="sasu-result__title">
            <span aria-hidden="true">{result === 'CORRECT' ? '✓' : '✕'}</span> {result === 'CORRECT' ? '정답이에요' : '다시 확인해 보세요'}
          </p>
          <dl className="sasu-result__dl">
            <dt>내 답</dt>
            <dd>{picked !== null ? quiz.choices[picked] : '—'}</dd>
            <dt>정답</dt>
            <dd>{quiz.choices[quiz.answer]}</dd>
          </dl>
          <p className="sasu-result__exp">
            <strong>해설</strong> {quiz.explanation}
          </p>
          {footer ? <div className="sasu-result__foot">{footer(result)}</div> : null}
        </div>
      )}
    </div>
  );
}
