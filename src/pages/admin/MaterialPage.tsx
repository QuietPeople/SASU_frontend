import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import type { QuizFormat } from '../../types/sasu';
import { CHOICE_COUNT } from '../../types/sasu';
import { quizOf, request } from '../../state/sasuSample';
import { useStore } from '../../state/store';
import { Badge, Button, useToast } from '../../shared/ui';

/**
 * A03 학습자료·문항 관리(공통기준 06·17·27·31).
 * - 저장된 콘텐츠 하나에 문항 1개 연결. O/X·3지·4지, 기본 3지, 정답 1개
 * - 카드 미리보기: 앞면 질문 / 뒷면 정답 보기의 실제 문장
 * - 형식을 바꾸면 보기 수가 달라짐. 줄어드는 보기 데이터를 확인 후 전환하도록 안내
 * - 기존 문항 수정은 새 버전으로 저장(과거 버전·응답 보존은 고정, 재채점 자동 적용 안 함)
 *
 * 데모 범위: 입력·검증·버전 안내 흐름만 보여 주며 공유 데이터에는 되쓰지 않음.
 */
const FORMATS: { id: QuizFormat; label: string }[] = [
  { id: 'OX', label: 'O / X' },
  { id: 'THREE', label: '3지 선다' },
  { id: 'FOUR', label: '4지 선다' },
];

export function MaterialPage() {
  const { state } = useStore();
  const navigate = useNavigate();
  const { id } = useParams();
  const { show, node } = useToast();

  const saved = state.contents.filter((c) => c.status === 'PUBLISHED' || c.status === 'DRAFT');
  const [targetId, setTargetId] = useState<string>(id ?? '');
  const target = state.contents.find((c) => String(c.id) === targetId);
  const existing = target ? quizOf(target.id) : undefined;

  const [format, setFormat] = useState<QuizFormat>(existing?.format ?? 'THREE');
  const [question, setQuestion] = useState(existing?.question ?? '');
  const [choices, setChoices] = useState<string[]>(() => normalizeChoices(existing?.choices ?? [], existing?.format ?? 'THREE'));
  const [answer, setAnswer] = useState(existing?.answer ?? 0);
  const [explanation, setExplanation] = useState(existing?.explanation ?? '');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const count = CHOICE_COUNT[format];
  const shown = useMemo(() => choices.slice(0, count), [choices, count]);

  const changeFormat = (next: QuizFormat) => {
    const nextCount = CHOICE_COUNT[next];
    if (nextCount < count && choices.slice(nextCount).some((c) => c.trim())) {
      if (!window.confirm('보기 수가 줄어 입력한 보기가 지워져요. 계속할까요?')) return;
    }
    setFormat(next);
    setChoices((prev) => normalizeChoices(prev, next));
    if (answer >= nextCount) setAnswer(0);
  };

  const setChoice = (i: number, value: string) => setChoices((prev) => prev.map((c, idx) => (idx === i ? value : c)));

  const save = async () => {
    if (busy || !target) return;
    const e: Record<string, string> = {};
    if (!question.trim()) e.question = '질문을 입력해 주세요.';
    shown.forEach((c, i) => {
      if (!c.trim()) e[`choice-${i}`] = '보기를 입력해 주세요.';
    });
    if (!explanation.trim()) e.explanation = '해설을 입력해 주세요.';
    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }
    setBusy(true);
    setErrors({});
    try {
      await request('quizSave', null, 550);
      show(existing ? '새 버전으로 저장했어요. 과거 버전과 응답은 보존돼요.' : '문항을 연결했어요.');
    } catch {
      show('저장하지 못했어요. 입력은 그대로 있어요.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sasu-page sasu-form">
      <div className="sasu-review__top">
        <button type="button" className="sasu-link" onClick={() => navigate(target ? `/admin/contents/${target.id}` : '/admin/contents')}>
          ← 원래 관리 화면으로
        </button>
        {existing ? <Badge tone="blue">문항 버전 v{existing.version}</Badge> : null}
      </div>

      <header className="sasu-page__head">
        <p className="sasu-eyebrow">관리자 · 학습자료</p>
        <h1 className="sasu-title">학습자료·문항 관리</h1>
      </header>

      <label className="sasu-field sasu-field--block">
        <span className="sasu-field__label">대상 영상</span>
        <select className="sasu-input" value={targetId} onChange={(e) => setTargetId(e.target.value)}>
          <option value="">저장된 콘텐츠 선택</option>
          {saved.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title} ({c.status === 'PUBLISHED' ? '공개' : '임시저장'})
            </option>
          ))}
        </select>
      </label>

      {!target ? (
        <p className="sasu-help">먼저 대상 콘텐츠를 선택해 주세요. 저장되지 않은 영상은 선택할 수 없어요.</p>
      ) : (
        <div className="sasu-form__grid">
          <section className="sasu-card">
            <div className="sasu-field sasu-field--block">
              <span className="sasu-field__label">문항 형식</span>
              <div className="sasu-tabs">
                {FORMATS.map((f) => (
                  <button key={f.id} type="button" className={`sasu-tabs__tab ${format === f.id ? 'is-active' : ''}`} aria-pressed={format === f.id} onClick={() => changeFormat(f.id)}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className={`sasu-field sasu-field--block ${errors.question ? 'is-error' : ''}`}>
              <label className="sasu-field__label">질문</label>
              <input className="sasu-input" value={question} onChange={(e) => setQuestion(e.target.value)} />
              {errors.question ? <p className="sasu-field-error" role="alert">{errors.question}</p> : null}
            </div>

            <fieldset className="sasu-choices-edit">
              <legend className="sasu-field__label">보기 · 정답 1개 선택</legend>
              {shown.map((c, i) => (
                <div key={i} className={`sasu-choice-edit ${errors[`choice-${i}`] ? 'is-error' : ''}`}>
                  <label className="sasu-choice-edit__radio">
                    <input type="radio" name="answer" checked={answer === i} onChange={() => setAnswer(i)} />
                    <span className="sasu-sr">{i + 1}번을 정답으로</span>
                  </label>
                  <input className="sasu-input" value={c} onChange={(e) => setChoice(i, e.target.value)} placeholder={format === 'OX' ? (i === 0 ? 'O' : 'X') : `보기 ${i + 1}`} />
                </div>
              ))}
            </fieldset>

            <div className={`sasu-field sasu-field--block ${errors.explanation ? 'is-error' : ''}`}>
              <label className="sasu-field__label">해설</label>
              <textarea className="sasu-input sasu-input--area" rows={2} value={explanation} onChange={(e) => setExplanation(e.target.value)} />
              {errors.explanation ? <p className="sasu-field-error" role="alert">{errors.explanation}</p> : null}
            </div>
          </section>

          <section className="sasu-card">
            <h2 className="sasu-card__title">카드 미리보기</h2>
            <div className="sasu-card-preview">
              <p className="sasu-lp__label">앞면</p>
              <p className="sasu-card-preview__q">{question || '질문이 여기에 보여요'}</p>
              <hr className="sasu-hr" />
              <p className="sasu-lp__label">뒷면</p>
              <p className="sasu-card-preview__a">{shown[answer]?.trim() || '정답 보기의 문장이 여기에 보여요'}</p>
            </div>
            <p className="sasu-help">카드는 질문과 정답 보기의 문장을 그대로 재사용해요(공통기준 27). 정답 번호만 보여 주지 않아요.</p>
            {existing ? (
              <div className="sasu-card-preview__ver">
                <p className="sasu-lp__label">수정 이력</p>
                <p className="sasu-muted">현재 v{existing.version} · 과거 버전과 당시 응답을 보존해요. 수정해도 과거 응답을 새 정답으로 다시 채점하지 않아요.</p>
              </div>
            ) : null}
          </section>
        </div>
      )}

      {target ? (
        <div className="sasu-row sasu-form__actions">
          <Button variant="primary" onClick={() => void save()} loading={busy}>
            저장·연결
          </Button>
          <Button onClick={() => navigate(`/admin/contents/${target.id}`)}>원래 관리 화면으로</Button>
        </div>
      ) : null}
      {node}
    </div>
  );
}

// 형식에 맞는 보기 수로 맞춤. OX는 O/X 고정, 나머지는 빈 칸을 채워 둠
function normalizeChoices(prev: string[], format: QuizFormat): string[] {
  const count = CHOICE_COUNT[format];
  if (format === 'OX') return ['O', 'X'];
  const next = [...prev];
  while (next.length < count) next.push('');
  return next.slice(0, count);
}
