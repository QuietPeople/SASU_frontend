import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, WheelEvent as ReactWheelEvent } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import type { Content, QuizResult } from '../../types/sasu';
import { categoryName, quizOf, request, sampleSeries } from '../../state/sasuSample';
import { publicContents, useStore } from '../../state/store';
import { reviewCandidates } from '../../state/review';
import { readSession, writeSession, type ReviewSession } from '../../state/reviewSession';
import { QuizView } from '../../shared/QuizView';
import { Button, StateBlock } from '../../shared/ui';

/**
 * L02 피드·공통 영상 시청 + C02 피드 사이 복기 카드.
 * - mode 'feed' : 추천 피드. 다음으로 넘길 때 복기 조건을 평가함(C02)
 * - mode 'watch': 검색·보관함·시리즈·복습 원본에서 연 영상. 들어온 경로로 돌아가는 링크를 둠
 * - 조회: 실제 재생 합계 3초·최초 1회(공통기준 14·15)
 * - 시청 완료: 실제 본 고유 구간 90% 이상(공통기준 16). 영상 끝 도달과는 별개
 * - 영상 끝: 퀴즈가 있으면 학습 패널을 C01로 전환. 없으면 종료 상태와 다음 행동
 * - 재생 실패: C03. 실패한 시도는 조회·완료에 넣지 않음
 *
 * 실제 영상 파일이 아직 없어 재생 시간만 흉내 냄. <video>를 붙일 때 아래 판정(3초·90%·끝)을
 * timeupdate에서 그대로 쓰면 된다. 시연 배속은 확인을 빠르게 하려는 기능임.
 */

type LoadState = 'loading' | 'ready' | 'failed' | 'retrying';
type PanelTab = 'core' | 'quiz' | 'source';

const SPEEDS = [1, 4, 10];
const WHEEL_LOCK_MS = 700;

const fmt = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
const sentences = (text: string) => text.split(/(?<=[.!?])\s+/).filter(Boolean);

// from 값에 따른 복귀 링크(화면 설계서 L02-05)
const BACK: Record<string, { label: string; to: (q: URLSearchParams) => string }> = {
  search: { label: '← 검색으로', to: () => '/learner/search' },
  saved: { label: '← 보관함으로', to: () => '/learner/library?tab=saved' },
  wrong: { label: '← 오답 복습으로', to: (q) => `/learner/review/${q.get('back') ?? ''}` },
  card: { label: '← 플래시카드로', to: (q) => `/learner/cards?i=${q.get('back') ?? 0}` },
  series: { label: '← 시리즈로', to: (q) => `/learner/series/${q.get('series') ?? ''}` },
};

export function FeedPage({ mode }: { mode: 'feed' | 'watch' }) {
  const { state, dispatch } = useStore();
  const navigate = useNavigate();
  const params = useParams();
  const [query] = useSearchParams();

  const records = state.records;

  // 추천 피드 순서: 관심 분야 → 미시청 우선 → 최신 등록순(공통기준 12·13)
  const feedList = useMemo<Content[]>(() => {
    const pub = publicContents(state);
    const { interests, stats } = records;
    return [...pub].sort((a, b) => {
      const ai = interests.includes(a.categoryId) ? 0 : 1;
      const bi = interests.includes(b.categoryId) ? 0 : 1;
      if (ai !== bi) return ai - bi;
      const av = stats[a.id]?.viewed ? 1 : 0;
      const bv = stats[b.id]?.viewed ? 1 : 0;
      if (av !== bv) return av - bv;
      return b.id - a.id;
    });
    // interests/stats가 바뀌어도 피드 순서를 흔들지 않도록 콘텐츠 목록만 의존성에 둠
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.contents]);

  // watch 모드: list 쿼리(쉼표로 이은 id들)가 있으면 그 목록, 없으면 현재 콘텐츠 하나
  const watchList = useMemo<Content[]>(() => {
    const byId = (id: number) => state.contents.find((c) => c.id === id && c.status === 'PUBLISHED');
    const listParam = query.get('list');
    if (listParam) {
      const ids = listParam.split(',').map(Number).filter((id) => byId(id));
      if (ids.length) return ids.map((id) => byId(id)!);
    }
    const one = byId(Number(params.contentId));
    return one ? [one] : [];
  }, [state.contents, params.contentId, query]);

  const list = mode === 'feed' ? feedList : watchList;
  const startIdx = useMemo(() => {
    if (mode === 'watch') {
      const i = list.findIndex((c) => c.id === Number(params.contentId));
      return i >= 0 ? i : 0;
    }
    return 0;
  }, [mode, list, params.contentId]);

  const [idx, setIdx] = useState(startIdx);
  useEffect(() => setIdx(startIdx), [startIdx]);
  const current = list[idx];

  // 복기 세션(창 단위, sessionStorage). feed 모드에서만 사용
  const [session, setSession] = useState<ReviewSession>(() => readSession());
  useEffect(() => {
    if (mode === 'feed') writeSession(session);
  }, [session, mode]);
  const [reviewing, setReviewing] = useState<number | null>(null); // 지금 띄운 복기 대상 콘텐츠 id

  // 영상별 로컬 상태
  const [load, setLoad] = useState<LoadState>('loading');
  const [tries, setTries] = useState(0);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(80);
  const [speed, setSpeed] = useState(1);
  const [tab, setTab] = useState<PanelTab>('core');
  const [busy, setBusy] = useState<'like' | 'save' | null>(null);
  const [message, setMessage] = useState('');

  const tRef = useRef(0);
  const playedRef = useRef(0); // 실제 재생 합계(조회 판정)
  const watchedRef = useRef<Set<number>>(new Set()); // 본 고유 구간(완료 판정)
  const wheelAt = useRef(0);
  const autoPlayRef = useRef(false);

  const duration = current?.durationSec ?? 30;
  const quiz = current ? quizOf(current.id) : undefined;
  const seriesId = query.get('series');
  const series = seriesId ? sampleSeries.find((s) => String(s.id) === seriesId) : undefined;

  // 콘텐츠가 바뀌면 처음부터
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
    setMessage('');
    dispatch({ type: 'setLast', contentId: current.id });
    request('play', null, 300)
      .then(() => {
        if (!alive) return;
        setLoad('ready');
        if (autoPlayRef.current) setPlaying(true);
      })
      .catch(() => alive && setLoad('failed'));
    return () => {
      alive = false;
    };
  }, [current, dispatch]);

  // 재생 중에만 시간이 흐름. 조회(3초)·완료(90%)·끝 판정을 여기서 함
  useEffect(() => {
    if (!playing || load !== 'ready' || !current) return undefined;
    const timer = window.setInterval(() => {
      const from = tRef.current;
      const to = Math.min(duration, from + 0.25 * speed);
      for (let s = Math.floor(from); s < Math.ceil(to); s += 1) watchedRef.current.add(s);
      playedRef.current += to - from;
      tRef.current = to;
      setT(to);
      if (playedRef.current >= 3) dispatch({ type: 'view', contentId: current.id });
      if (watchedRef.current.size >= Math.ceil(duration * 0.9)) {
        dispatch({ type: 'complete', contentId: current.id, at: new Date().toISOString() });
      }
      if (to >= duration) {
        setPlaying(false);
        setEnded(true);
        if (quizOf(current.id)) setTab('quiz');
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [playing, load, speed, duration, current, dispatch]);

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

  // 피드에서 다음으로 넘길 때 복기 조건을 평가(C02)
  const goNext = useCallback(() => {
    if (mode === 'feed') {
      if (reviewing !== null) {
        // 복기 카드를 본 뒤 다음 일반 영상으로
        setReviewing(null);
        setIdx((i) => (i + 1) % list.length);
        return;
      }
      // 시청 완료한 서로 다른 영상만 카운트(공통기준 20·21)
      let next = session;
      if (current && records.stats[current.id]?.completed && !session.countedIds.includes(current.id)) {
        next = { ...session, counter: session.counter + 1, countedIds: [...session.countedIds, current.id] };
      }
      if (next.counter >= records.reviewInterval) {
        const cands = reviewCandidates(state, next);
        if (cands.length) {
          const pick = cands[0];
          setSession({ ...next, counter: 0, shownQuizIds: [...new Set([...next.shownQuizIds, pick])], retryQuizIds: next.retryQuizIds.filter((id) => id !== pick) });
          setReviewing(pick);
          dispatch({ type: 'exposeReview' });
          return;
        }
        // 대상 없으면 카운터만 비우고 일반 영상 계속(공통기준 C02 상태·예외)
        next = { ...next, counter: 0 };
      }
      setSession(next);
      setIdx((i) => (i + 1) % list.length);
      return;
    }
    setIdx((i) => (i + 1 >= list.length ? i : i + 1));
  }, [mode, reviewing, session, current, records, state, list.length, dispatch]);

  const goPrev = useCallback(() => {
    if (reviewing !== null) return;
    setIdx((i) => (mode === 'feed' ? (i - 1 + list.length) % list.length : Math.max(0, i - 1)));
  }, [mode, reviewing, list.length]);

  // ↑↓ 키 이동. 입력창·학습 패널 조작 중에는 가로채지 않음(화면 설계서 1-2)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el?.closest('input, textarea, select, button, .sasu-lp')) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        goPrev();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goNext, goPrev]);

  const onWheel = (e: ReactWheelEvent<HTMLDivElement>) => {
    const now = Date.now();
    if (now - wheelAt.current < WHEEL_LOCK_MS || Math.abs(e.deltaY) < 20) return;
    wheelAt.current = now;
    if (e.deltaY > 0) goNext();
    else goPrev();
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
    if (load === 'retrying') return;
    setLoad('retrying');
    try {
      await request('play', null, 700);
      setLoad('ready');
      setPlaying(true);
    } catch {
      setTries((n) => n + 1);
      setLoad('failed');
    }
  };

  // 좋아요·저장: 성공 응답 뒤에만 반영, 실패하면 이전 상태 유지(공통기준 SF03)
  const toggleReaction = async (kind: 'like' | 'save') => {
    if (!current || busy) return;
    setBusy(kind);
    const on = kind === 'like' ? !records.liked.includes(current.id) : !records.saved.includes(current.id);
    try {
      await request(kind === 'like' ? 'like' : 'bookmark', null, 350);
      dispatch({ type: kind, contentId: current.id, on });
      setMessage(kind === 'like' ? (on ? '좋아요를 눌렀어요.' : '좋아요를 취소했어요.') : on ? '보관함에 저장했어요.' : '보관함에서 뺐어요.');
    } catch {
      setMessage(`${kind === 'like' ? '좋아요' : '저장'}를 반영하지 못했어요. 다시 시도해 주세요.`);
    } finally {
      setBusy(null);
    }
  };

  const recordAnswer = (contentId: number, path: 'END' | 'REVIEW', picked: number | null, result: QuizResult) => {
    dispatch({ type: 'answer', contentId, path, picked, result, at: new Date().toISOString() });
  };

  if (!current && reviewing === null) {
    return (
      <div className="sasu-page">
        <StateBlock
          title="등록된 콘텐츠가 없어요."
          text="관리자 화면에서 콘텐츠를 공개하면 피드에 나와요."
          action={
            <>
              <Button onClick={() => navigate('/learner/search')}>검색</Button>
              <Button variant="primary" onClick={() => navigate('/admin/contents')}>
                관리자 화면
              </Button>
            </>
          }
        />
      </div>
    );
  }

  const failed = load === 'failed' || load === 'retrying';
  const from = query.get('from') ?? '';
  const back = mode === 'watch' && BACK[from] ? BACK[from] : null;

  // C02 복기 카드 표시(피드 중앙을 복기로 전환)
  if (mode === 'feed' && reviewing !== null) {
    const rc = state.contents.find((c) => c.id === reviewing);
    const rq = quizOf(reviewing);
    return (
      <div className="sasu-page sasu-feed sasu-feed--review">
        <div className="sasu-feed__main">
          <div className="sasu-feed__bar">
            <span className="sasu-eyebrow">피드 복기</span>
          </div>
          <div className="sasu-review-card">
            <p className="sasu-review-card__lead">이전에 본 내용을 확인해 보세요.</p>
            <p className="sasu-review-card__src">{rc?.title}</p>
            {rq ? (
              <QuizView
                quiz={rq}
                onSubmit={(picked, result) => {
                  recordAnswer(reviewing, 'REVIEW', picked, result);
                  // 복기에서 틀린 문제만 이후 복기에서 다시 낼 수 있음(공통기준 23)
                  if (result === 'WRONG') setSession((s) => ({ ...s, retryQuizIds: [...new Set([...s.retryQuizIds, reviewing])] }));
                }}
                onSkip={() => undefined}
                footer={() => (
                  <Button variant="primary" onClick={goNext}>
                    다음 일반 영상 →
                  </Button>
                )}
              />
            ) : null}
          </div>
          <p className="sasu-help">복기는 창을 닫으면 처음부터예요. 학습 기록은 그대로 남아요.</p>
        </div>
      </div>
    );
  }

  const points = sentences(current.summary).slice(0, 3);
  const liked = records.liked.includes(current.id);
  const saved = records.saved.includes(current.id);
  const stat = records.stats[current.id];

  return (
    <div className="sasu-page sasu-feed">
      <div className="sasu-feed__main">
        <div className="sasu-feed__bar">
          {back ? (
            <button type="button" className="sasu-link" onClick={() => navigate(back.to(query))}>
              {back.label}
            </button>
          ) : (
            <span className="sasu-eyebrow">{series ? `시리즈 · ${series.name}` : '추천 피드'}</span>
          )}
          <span className="sasu-chip">
            {idx + 1} / {list.length}
          </span>
        </div>

        <div className="sasu-feed__head">
          <h1 className="sasu-title sasu-title--sm">{current.title}</h1>
          <p className="sasu-sub">
            {categoryName(current.categoryId)}
            {current.tags.length ? ` · ${current.tags.map((tag) => `#${tag}`).join(' ')}` : ''}
          </p>
        </div>

        <div className="sasu-feed__stage" onWheel={onWheel}>
          <div className="sasu-player" tabIndex={0} onKeyDown={onPlayerKeyDown} aria-label={`${current.title} 영상. 초점이 있을 때 Space로 재생과 일시정지`}>
            <div className={`sasu-player__screen ${failed ? 'is-failed' : ''}`}>
              <div className="sasu-player__top">
                <span className="sasu-player__pill">{categoryName(current.categoryId)}</span>
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
                  <Button variant="light" size="sm" onClick={toggle}>
                    다시 보기
                  </Button>
                </div>
              ) : null}

              {failed ? (
                <div className="sasu-player__fail" role="alert">
                  <span className="sasu-player__fail-icon" aria-hidden="true">
                    !
                  </span>
                  <p className="sasu-player__fail-title">영상을 재생하지 못했어요</p>
                  <p className="sasu-player__fail-text">
                    {tries ? `다시 시도했지만 재생하지 못했어요(${tries}회). ` : '다시 시도하거나 다른 영상을 선택해 주세요. '}
                    실패한 시도는 조회수와 시청 완료에 넣지 않아요.
                  </p>
                  <div className="sasu-player__fail-btns">
                    <Button variant="light" size="sm" onClick={() => void retry()} disabled={load === 'retrying'} loading={load === 'retrying'}>
                      {load === 'retrying' ? '다시 불러오는 중' : '재시도'}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={goNext}>
                      다른 영상 선택
                    </Button>
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
            <button type="button" className={`sasu-react ${liked ? 'is-on' : ''}`} aria-pressed={liked} onClick={() => void toggleReaction('like')} disabled={busy !== null}>
              <span aria-hidden="true">{liked ? '♥' : '♡'}</span> 좋아요
            </button>
            <button type="button" className={`sasu-react ${saved ? 'is-on' : ''}`} aria-pressed={saved} onClick={() => void toggleReaction('save')} disabled={busy !== null}>
              <span aria-hidden="true">{saved ? '★' : '☆'}</span> {saved ? '저장됨' : '저장'}
            </button>
            <span className="sasu-muted">
              조회 {stat?.viewed ? 1 : 0}
              {stat?.completed ? ' · 시청 완료' : ''}
            </span>
          </div>
          <div className="sasu-row">
            <Button size="sm" onClick={goPrev} title="이전 영상(제안)">
              ↑ 이전
            </Button>
            <Button size="sm" variant="primary" onClick={goNext}>
              다음 ↓
            </Button>
          </div>
        </div>

        {message ? (
          <p className="sasu-feed__msg" role="status">
            {message}
          </p>
        ) : null}
        <p className="sasu-help">휠이나 ↑↓ 키로도 넘길 수 있어요. 이전 영상 이동은 제안이에요(P16).</p>
      </div>

      <aside className="sasu-lp" aria-label="학습 패널">
        <div className="sasu-lp__head">
          <p className="sasu-eyebrow">학습 패널</p>
          <h2 className="sasu-lp__title">{current.title}</h2>
        </div>

        {series ? (
          <div className="sasu-lp__series">
            <p className="sasu-lp__label">시리즈 단계</p>
            <ol className="sasu-lp__steps">
              {series.stepContentIds.map((id, i) => {
                const st = records.stats[id];
                const done = st?.completed && records.responses.some((r) => r.contentId === id && r.result === 'CORRECT');
                return (
                  <li key={id} className={id === current.id ? 'is-current' : ''}>
                    <span className="sasu-lp__no">{i + 1}</span>
                    <span>{state.contents.find((c) => c.id === id)?.title ?? '—'}</span>
                    {done ? <span className="sasu-lp__ok">완료</span> : null}
                  </li>
                );
              })}
            </ol>
          </div>
        ) : null}

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
              {item.id === 'quiz' && quiz && ended ? <span className="sasu-lp__dot" aria-label="풀 수 있는 퀴즈 있음" /> : null}
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
              {current.related ? (
                <>
                  <span className="sasu-lp__label">관련 학습 정보</span>
                  <p className="sasu-lp__related">{current.related}</p>
                </>
              ) : null}
              {current.cautionEnabled ? (
                <div className="sasu-lp__caution" role="note">
                  <p className="sasu-lp__caution-title">⚠ 실무 용어 해석 주의</p>
                  <p>회사·업계에 따라 의미가 다를 수 있어요. 일반적 의미를 기준으로 설명합니다.</p>
                </div>
              ) : null}
              {records.interests.includes(current.categoryId) ? <p className="sasu-lp__reason">관심 분야에 맞는 영상이에요.</p> : null}
            </>
          ) : null}

          {tab === 'quiz' ? (
            !quiz ? (
              <p className="sasu-muted">이 콘텐츠에는 등록된 퀴즈가 없어요. 영상 시청만으로 넘어갈 수 있어요.</p>
            ) : !ended ? (
              <p className="sasu-muted">영상을 끝까지 보면 퀴즈가 열려요. 끝 도달과 90% 시청 완료는 별개예요.</p>
            ) : (
              <QuizView
                quiz={quiz}
                onSubmit={(picked, result) => recordAnswer(current.id, 'END', picked, result)}
                onSkip={() => undefined}
                footer={(result) =>
                  result === 'WRONG' ? <span className="sasu-muted">보관함의 오답 복습에서 다시 풀 수 있어요.</span> : <Button size="sm" variant="primary" onClick={goNext}>다음 영상 →</Button>
                }
              />
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
