import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, WheelEvent as ReactWheelEvent } from 'react';
import type { Content, QuizResult } from '../../types/sasu';
import { categoryName, quizOf, request, sampleCategories, sampleContents } from '../../state/sasuSample';
import '../../styles/sasu-pages.css';

/**
 * 학습자 피드·영상 시청(화면 설계서 L02)
 * - 공개 콘텐츠만 세로로 넘겨 보기: 다음·이전 버튼, ↑↓ 키, 마우스 휠
 * - 재생 조작: 재생·일시정지, 재생바, 음량. 플레이어에 초점이 있으면 Space
 * - 조회: 실제 재생 3초, 사용자·콘텐츠당 최초 1회(최종 공통기준 14·15)
 * - 시청 완료: 실제로 본 서로 다른 구간 90% 이상(16). 영상 끝 도달과는 별개
 * - 영상 끝: 퀴즈가 있으면 학습 패널에 문제를 띄움(02). 없으면 다음 행동만 보여 줌
 * - 재생 실패: 다시 시도·다른 영상. 실패한 시도는 조회수와 시청 완료에 넣지 않음(C03)
 * - 학습 패널: 한 줄 정리·핵심 정리·실무 용어 해석 주의·출처·검토일
 * - 좋아요·저장은 성공 응답을 받은 뒤에만 화면에 반영함
 *
 * 실제 영상 파일이 아직 없어 재생 시간만 흉내 냄. 영상을 붙일 때는 화면 안쪽을 <video>로 바꾸고
 * 아래 판정(3초·90%·끝)을 timeupdate 이벤트에서 그대로 쓰면 됨. 시연 배속은 확인을 빠르게 하려는 기능임.
 */

type LoadState = 'loading' | 'ready' | 'failed' | 'retrying';
type PanelTab = 'core' | 'quiz' | 'source';

const SPEEDS = [1, 4, 10];
const WHEEL_LOCK_MS = 700;
const LETTERS = ['A', 'B', 'C', 'D'];

const fmt = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
const sentences = (text: string) => text.split(/(?<=[.!?])\s+/).filter(Boolean);

export function FeedPage() {
  const list = useMemo<Content[]>(() => sampleContents.filter((c) => c.status === 'PUBLISHED').sort((a, b) => b.id - a.id), []);
  const [idx, setIdx] = useState(0);
  const current = list[idx];

  // 영상별 상태
  const [load, setLoad] = useState<LoadState>('loading');
  const [tries, setTries] = useState(0);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(80);
  const [speed, setSpeed] = useState(1);
  const [tab, setTab] = useState<PanelTab>('core');

  // 기록
  const [views, setViews] = useState<Record<number, boolean>>({});
  const [completed, setCompleted] = useState<Record<number, boolean>>({});
  const [liked, setLiked] = useState<Record<number, boolean>>({});
  const [saved, setSaved] = useState<Record<number, boolean>>({});
  const [busy, setBusy] = useState<'like' | 'save' | null>(null);
  const [message, setMessage] = useState('');

  // 퀴즈
  const [picked, setPicked] = useState<number | null>(null);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [quizError, setQuizError] = useState('');

  const tRef = useRef(0);
  const playedRef = useRef(0); // 실제 재생 시간 합계(조회 판정용)
  const watchedRef = useRef<Set<number>>(new Set()); // 실제로 본 구간(시청 완료 판정용)
  const wheelAt = useRef(0);
  const autoPlayRef = useRef(false); // 사용자가 한 번 재생을 누른 뒤에는 다음 영상부터 바로 재생

  const duration = current?.durationSec ?? 30;
  const quiz = current ? quizOf(current.id) : undefined;

  // 영상이 바뀌면 처음부터 불러옴
  useEffect(() => {
    if (!current) return undefined;
    let alive = true;
    setLoad('loading');
    setTries(0);
    setT(0);
    tRef.current = 0;
    playedRef.current = 0;
    watchedRef.current = new Set();
    setPlaying(false);
    setEnded(false);
    setTab('core');
    setPicked(null);
    setResult(null);
    setQuizError('');
    setMessage('');
    request('play', null, 350)
      .then(() => {
        if (!alive) return;
        setLoad('ready');
        if (autoPlayRef.current) setPlaying(true);
      })
      .catch(() => {
        if (alive) setLoad('failed');
      });
    return () => {
      alive = false;
    };
  }, [current]);

  // 재생 중일 때만 시간이 흐름
  useEffect(() => {
    if (!playing || load !== 'ready' || !current) return undefined;
    const timer = window.setInterval(() => {
      const from = tRef.current;
      const to = Math.min(duration, from + 0.25 * speed);
      for (let s = Math.floor(from); s < Math.ceil(to); s += 1) watchedRef.current.add(s);
      playedRef.current += to - from;
      tRef.current = to;
      setT(to);

      if (playedRef.current >= 3) {
        setViews((v) => (v[current.id] ? v : { ...v, [current.id]: true }));
      }
      if (watchedRef.current.size >= Math.ceil(duration * 0.9)) {
        setCompleted((c) => (c[current.id] ? c : { ...c, [current.id]: true }));
      }
      if (to >= duration) {
        setPlaying(false);
        setEnded(true);
        if (quizOf(current.id)) setTab('quiz');
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [playing, load, speed, duration, current]);

  const toggle = useCallback(() => {
    if (load !== 'ready') return;
    autoPlayRef.current = true;
    if (ended) {
      tRef.current = 0;
      setT(0);
      setEnded(false);
      setPlaying(true);
      return;
    }
    setPlaying((p) => !p);
  }, [load, ended]);

  const move = useCallback(
    (step: number) => {
      setIdx((i) => {
        const next = i + step;
        if (next < 0) return list.length - 1;
        if (next >= list.length) return 0;
        return next;
      });
    },
    [list.length],
  );

  // ↑↓ 키로 영상 이동. 입력창·학습 패널을 조작할 때는 가로채지 않음(화면 설계서 1-2)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el?.closest('input, textarea, select, .sasu-lp, [role="radiogroup"]')) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        move(1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        move(-1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [move]);

  // 기기마다 휠 이벤트 양이 달라 한 번 넘긴 뒤 잠깐 잠금
  const onWheel = (e: ReactWheelEvent<HTMLDivElement>) => {
    const now = Date.now();
    if (now - wheelAt.current < WHEEL_LOCK_MS || Math.abs(e.deltaY) < 20) return;
    wheelAt.current = now;
    move(e.deltaY > 0 ? 1 : -1);
  };

  const onPlayerKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      toggle();
    }
  };

  const seek = (e: ReactMouseEvent<HTMLButtonElement>) => {
    if (load !== 'ready') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    tRef.current = ratio * duration;
    setT(tRef.current);
    if (tRef.current < duration) setEnded(false);
  };

  const retry = async () => {
    if (load === 'retrying') return; // 중복 클릭 방지
    setLoad('retrying');
    try {
      await request('play', null, 800);
      setLoad('ready');
      setPlaying(true);
    } catch {
      setTries((n) => n + 1);
      setLoad('failed');
    }
  };

  // 좋아요·저장: 성공 응답 뒤에만 반영하고, 실패하면 이전 상태를 유지함
  const toggleReaction = async (kind: 'like' | 'save') => {
    if (!current || busy) return;
    setBusy(kind);
    const on = kind === 'like' ? !liked[current.id] : !saved[current.id];
    try {
      await request(kind === 'like' ? 'like' : 'bookmark', null, 400);
      if (kind === 'like') setLiked((m) => ({ ...m, [current.id]: on }));
      else setSaved((m) => ({ ...m, [current.id]: on }));
      setMessage(kind === 'like' ? (on ? '좋아요를 눌렀어요.' : '좋아요를 취소했어요.') : on ? '보관함에 저장했어요.' : '보관함에서 뺐어요.');
    } catch {
      setMessage(`${kind === 'like' ? '좋아요' : '저장'}를 반영하지 못했어요. 다시 시도해 주세요.`);
    } finally {
      setBusy(null);
    }
  };

  const submitQuiz = async () => {
    if (picked === null || submitting || !quiz) return;
    setSubmitting(true);
    setQuizError('');
    try {
      await request('quizAnswer', null, 600);
      setResult(picked === quiz.answer ? 'CORRECT' : 'WRONG');
    } catch {
      // 서버 확인 없이 정답 처리하지 않음. 고른 답은 그대로 둠
      setQuizError('답을 저장하지 못했어요. 고른 답은 그대로 있으니 다시 확인을 눌러 주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!current) {
    return (
      <div className="sasu-page">
        <div className="sasu-empty">
          <p className="sasu-empty__title">등록된 콘텐츠가 없어요.</p>
          <p className="sasu-empty__text">관리자 화면에서 콘텐츠를 공개하면 피드에 나와요.</p>
        </div>
      </div>
    );
  }

  const failed = load === 'failed' || load === 'retrying';
  const points = sentences(current.summary).slice(0, 3);
  const letters = quiz?.format === 'OX' ? ['O', 'X'] : LETTERS;

  return (
    <div className="sasu-page sasu-feed">
      <div className="sasu-feed__main">
        <div className="sasu-feed__bar">
          <span className="sasu-eyebrow">추천 피드</span>
          <span className="sasu-chip">
            {idx + 1} / {list.length}
          </span>
        </div>

        <div className="sasu-feed__head">
          <h1 className="sasu-title sasu-title--sm">{current.title}</h1>
          <p className="sasu-sub">
            {categoryName(sampleCategories, current.categoryId)}
            {current.tags.length ? ` · ${current.tags.map((t2) => `#${t2}`).join(' ')}` : ''}
          </p>
        </div>

        <div className="sasu-feed__stage" onWheel={onWheel}>
          <div className="sasu-player" tabIndex={0} onKeyDown={onPlayerKeyDown} aria-label={`${current.title} 영상. 초점이 있을 때 Space로 재생과 일시정지`}>
            <div className={`sasu-player__screen ${failed ? 'is-failed' : ''}`}>
              <div className="sasu-player__top">
                <span className="sasu-player__pill">{categoryName(sampleCategories, current.categoryId)}</span>
                <span className="sasu-player__pill">{fmt(duration)}</span>
              </div>

              {!failed && !ended && load !== 'loading' ? (
                <div className="sasu-player__art" aria-hidden="true">
                  <span className="sasu-player__word">{current.tags[0] ?? current.title.slice(0, 6)}</span>
                  <span className="sasu-player__line" />
                  <span className="sasu-player__line sasu-player__line--short" />
                </div>
              ) : null}

              {load === 'loading' ? (
                <div className="sasu-player__center" role="status">
                  <span className="sasu-spinner sasu-spinner--light" aria-hidden="true" />
                  <span className="sasu-sr">영상을 불러오는 중</span>
                </div>
              ) : null}

              {load === 'ready' && !playing && !ended ? (
                <button type="button" className="sasu-player__big" onClick={toggle} aria-label="재생">
                  <span aria-hidden="true">▶</span>
                </button>
              ) : null}

              {load === 'ready' && ended ? (
                <div className="sasu-player__center">
                  <p className="sasu-player__end">영상이 끝났어요</p>
                  <button type="button" className="sasu-btn sasu-btn--light sasu-btn--sm" onClick={toggle}>
                    다시 보기
                  </button>
                </div>
              ) : null}

              {failed ? (
                <div className="sasu-player__fail" role="alert">
                  <span className="sasu-player__fail-icon" aria-hidden="true">
                    !
                  </span>
                  <p className="sasu-player__fail-title">영상을 재생할 수 없어요</p>
                  <p className="sasu-player__fail-text">
                    {tries ? `다시 시도했지만 재생하지 못했어요(${tries}회). ` : ''}
                    실패한 시도는 조회수와 시청 완료에 넣지 않아요.
                  </p>
                  <div className="sasu-player__fail-btns">
                    <button type="button" className="sasu-btn sasu-btn--light sasu-btn--sm" onClick={() => void retry()} disabled={load === 'retrying'}>
                      {load === 'retrying' ? '다시 불러오는 중' : '다시 시도'}
                    </button>
                    <button type="button" className="sasu-btn sasu-btn--ghost-light sasu-btn--sm" onClick={() => move(1)}>
                      다른 영상
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="sasu-player__controls">
              <button type="button" className="sasu-ctl" onClick={toggle} disabled={load !== 'ready'} aria-label={playing ? '일시정지' : '재생'}>
                {playing ? '❚❚' : '▶'}
              </button>
              <span className="sasu-ctl__time">
                {fmt(t)} / {fmt(duration)}
              </span>
              <button type="button" className="sasu-ctl__bar" onClick={seek} disabled={load !== 'ready'} aria-label={`재생 위치 ${Math.round((t / duration) * 100)}%. 누른 위치로 이동`}>
                <span className="sasu-ctl__fill" style={{ width: `${(t / duration) * 100}%` }} />
              </button>
              <button type="button" className="sasu-ctl" onClick={() => setMuted((m) => !m)} aria-label={muted ? '소리 켜기' : '음소거'}>
                {muted || volume === 0 ? '🔇' : '🔊'}
              </button>
              <input
                className="sasu-ctl__volume"
                type="range"
                min="0"
                max="100"
                value={muted ? 0 : volume}
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  setVolume(Number(e.target.value));
                  setMuted(false);
                }}
                aria-label="음량"
              />
              <label className="sasu-ctl__speed">
                <span className="sasu-sr">시연 배속</span>
                <select value={speed} onChange={(e: ChangeEvent<HTMLSelectElement>) => setSpeed(Number(e.target.value))} title="확인을 빠르게 하려는 시연용 배속">
                  {SPEEDS.map((s) => (
                    <option key={s} value={s}>
                      {s === 1 ? '1배속' : `시연 ${s}배속`}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </div>

        <div className="sasu-feed__actions">
          <div className="sasu-row">
            <button type="button" className={`sasu-react ${liked[current.id] ? 'is-on' : ''}`} aria-pressed={Boolean(liked[current.id])} onClick={() => void toggleReaction('like')} disabled={busy !== null}>
              <span aria-hidden="true">{liked[current.id] ? '♥' : '♡'}</span> 좋아요
            </button>
            <button type="button" className={`sasu-react ${saved[current.id] ? 'is-on' : ''}`} aria-pressed={Boolean(saved[current.id])} onClick={() => void toggleReaction('save')} disabled={busy !== null}>
              <span aria-hidden="true">{saved[current.id] ? '★' : '☆'}</span> {saved[current.id] ? '저장됨' : '저장'}
            </button>
            <span className="sasu-muted">
              조회 {views[current.id] ? 1 : 0}
              {completed[current.id] ? ' · 시청 완료' : ''}
            </span>
          </div>
          <div className="sasu-row">
            <button type="button" className="sasu-btn sasu-btn--sm" onClick={() => move(-1)}>
              ↑ 이전
            </button>
            <button type="button" className="sasu-btn sasu-btn--sm sasu-btn--primary" onClick={() => move(1)}>
              다음 ↓
            </button>
          </div>
        </div>

        {message ? (
          <p className="sasu-feed__msg" role="status">
            {message}
          </p>
        ) : null}
        <p className="sasu-help">휠이나 ↑↓ 키로도 넘길 수 있어요. 플레이어를 누른 뒤 Space로 재생과 일시정지를 해요.</p>
      </div>

      <aside className="sasu-lp" aria-label="학습 패널">
        <div className="sasu-lp__head">
          <p className="sasu-eyebrow">학습 패널</p>
          <h2 className="sasu-lp__title">{current.title}</h2>
        </div>

        <div className="sasu-lp__tabs" role="tablist" aria-label="학습 자료">
          {([
            { id: 'core', label: '핵심' },
            { id: 'quiz', label: '퀴즈' },
            { id: 'source', label: '출처' },
          ] as const).map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`sasu-lp-tab-${item.id}`}
              aria-selected={tab === item.id}
              aria-controls="sasu-lp-panel"
              className={`sasu-lp__tab ${tab === item.id ? 'is-active' : ''}`}
              onClick={() => setTab(item.id)}
            >
              {item.label}
              {item.id === 'quiz' && quiz && ended && result === null ? <span className="sasu-lp__dot" aria-label="풀 수 있는 퀴즈 있음" /> : null}
            </button>
          ))}
        </div>

        <div className="sasu-lp__body" id="sasu-lp-panel" role="tabpanel" aria-labelledby={`sasu-lp-tab-${tab}`}>
          {tab === 'core' ? (
            <>
              <div className="sasu-lp__oneline">
                <span className="sasu-lp__label">한 줄 정리</span>
                <p>{sentences(current.summary)[0] ?? '등록된 핵심 내용이 없어요.'}</p>
              </div>
              {points.length ? (
                <>
                  <span className="sasu-lp__label">핵심 정리</span>
                  <ol className="sasu-lp__points">
                    {points.map((p, i) => (
                      <li key={p}>
                        <span className="sasu-lp__no">{i + 1}</span>
                        {p}
                      </li>
                    ))}
                  </ol>
                </>
              ) : null}
              {current.cautionEnabled ? (
                <div className="sasu-lp__caution" role="note">
                  <p className="sasu-lp__caution-title">⚠ 실무 용어 해석 주의</p>
                  <p>회사·업계에 따라 의미가 다를 수 있어요. 일반적 의미를 기준으로 설명합니다.</p>
                </div>
              ) : null}
            </>
          ) : null}

          {tab === 'quiz' ? (
            !quiz ? (
              <p className="sasu-muted">이 콘텐츠에는 등록된 퀴즈가 없어요.</p>
            ) : !ended ? (
              <p className="sasu-muted">영상을 끝까지 보면 퀴즈가 열려요.</p>
            ) : (
              <div className="sasu-quiz">
                <p className="sasu-quiz__q">{quiz.question}</p>
                <ul className="sasu-quiz__choices" role="radiogroup" aria-label="보기">
                  {quiz.choices.map((choice, i) => {
                    const isPicked = picked === i;
                    const isAnswer = result !== null && i === quiz.answer;
                    const isWrongPick = result === 'WRONG' && isPicked;
                    return (
                      <li key={choice}>
                        <button
                          type="button"
                          role="radio"
                          aria-checked={isPicked}
                          disabled={result !== null}
                          className={`sasu-choice ${isPicked ? 'is-picked' : ''} ${isAnswer ? 'is-answer' : ''} ${isWrongPick ? 'is-wrong' : ''}`}
                          onClick={() => setPicked(i)}
                        >
                          <span className="sasu-choice__letter" aria-hidden="true">
                            {letters[i]}
                          </span>
                          <span>{choice}</span>
                          {isAnswer ? <span className="sasu-choice__mark">✓ 정답</span> : null}
                          {isWrongPick ? <span className="sasu-choice__mark is-wrong">✕ 내 답</span> : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>

                {quizError ? (
                  <p className="sasu-quiz__error" role="alert">
                    {quizError}
                  </p>
                ) : null}

                {result === null ? (
                  <div className="sasu-row">
                    <button type="button" className="sasu-btn" onClick={() => setResult('SKIPPED')} disabled={submitting}>
                      건너뛰기
                    </button>
                    <button type="button" className="sasu-btn sasu-btn--primary" onClick={() => void submitQuiz()} disabled={picked === null || submitting}>
                      {submitting ? '확인 중' : '답 확인'}
                    </button>
                  </div>
                ) : result === 'SKIPPED' ? (
                  <div className="sasu-result" role="status">
                    <p className="sasu-result__title">건너뛰었어요</p>
                    <p>오답이나 복습 대기에는 넣지 않아요.</p>
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
                    <p>
                      <strong>해설</strong> {quiz.explanation}
                    </p>
                    {result === 'WRONG' ? <p className="sasu-muted">보관함의 오답 복습에서 다시 풀 수 있어요.</p> : null}
                  </div>
                )}
              </div>
            )
          ) : null}

          {tab === 'source' ? (
            <dl className="sasu-lp__dl">
              <dt>출처</dt>
              <dd>{current.source || '—'}</dd>
              <dt>검토일</dt>
              <dd>{current.reviewedAt || '—'}</dd>
            </dl>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
