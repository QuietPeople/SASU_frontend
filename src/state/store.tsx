import { createContext, useContext, useMemo, useReducer, type Dispatch, type PropsWithChildren } from 'react';
import type { Content, Quiz, QuizResult, SolvePath, UserRecords } from '../types/sasu';
import { sampleContents, sampleQuizzes, sampleSeries } from './sasuSample';

// 화면 확인용 상태 저장소. 화면 설계서 1-3의 'DB user1 기록'에 해당함.
// 실제 구현에서는 각 동작을 FastAPI 요청으로 바꾸고, 성공 응답을 받은 뒤에만 여기 상태를 갱신한다.
// 지금은 화면 흐름 확인을 위해 메모리에만 두며 새로고침하면 초기 예시로 돌아간다.

interface AppState {
  contents: Content[];
  quizzes: Quiz[];
  records: UserRecords;
  responseSeq: number; // 응답 id 발급용
}

const initialRecords: UserRecords = {
  // 예시: 1·2·5·6번은 시청 완료, 1·5는 미해결 오답(피드에서 틀린 적 있음)
  stats: {
    1: { viewed: true, completed: true, watchedAt: '2026-10-18T09:00:00' },
    2: { viewed: true, completed: true, watchedAt: '2026-10-19T09:00:00' },
    5: { viewed: true, completed: true, watchedAt: '2026-10-15T09:00:00' },
    6: { viewed: true, completed: true, watchedAt: '2026-10-20T09:00:00' },
    7: { viewed: true, completed: false, watchedAt: '2026-10-20T10:00:00' },
  },
  liked: [2],
  saved: [1, 4, 5],
  wrongNotes: { 1: 'PENDING', 5: 'PENDING' },
  responses: [
    { id: 1, contentId: 1, version: 2, path: 'END', picked: 0, result: 'WRONG', at: '2026-10-18T09:03:00' },
    { id: 2, contentId: 2, version: 1, path: 'END', picked: 0, result: 'CORRECT', at: '2026-10-19T09:03:00' },
    { id: 3, contentId: 5, version: 1, path: 'END', picked: 1, result: 'WRONG', at: '2026-10-15T09:03:00' },
    { id: 4, contentId: 6, version: 1, path: 'END', picked: 0, result: 'CORRECT', at: '2026-10-20T09:03:00' },
  ],
  cardLogs: {},
  seriesQuizExposure: { 1: 1, 2: 1, 5: 1, 6: 1 },
  reviewExposure: 0,
  interests: [1, 4],
  reviewInterval: 5,
  onboarded: false,
  lastContentId: null,
};

type Action =
  | { type: 'view'; contentId: number }
  | { type: 'complete'; contentId: number; at: string }
  | { type: 'setLast'; contentId: number }
  | { type: 'like'; contentId: number; on: boolean }
  | { type: 'save'; contentId: number; on: boolean }
  | { type: 'exposeEndQuiz'; contentId: number }
  | { type: 'exposeReview' }
  | { type: 'answer'; contentId: number; path: SolvePath; picked: number | null; result: QuizResult; at: string }
  | { type: 'cardOpen'; contentId: number }
  | { type: 'cardReveal'; contentId: number }
  | { type: 'setInterests'; ids: number[] }
  | { type: 'setInterval'; value: number }
  | { type: 'onboard' }
  | { type: 'resetRecords' };

function quizOf(state: AppState, contentId: number): Quiz | undefined {
  return state.quizzes.find((q) => q.contentId === contentId);
}

// 어느 풀이 경로의 정답이든 해당 콘텐츠의 미해결 오답을 해결로 바꾼다(공통기준 26)
function applyWrongNote(records: UserRecords, contentId: number, result: QuizResult): UserRecords['wrongNotes'] {
  const notes = { ...records.wrongNotes };
  if (result === 'CORRECT') {
    if (notes[contentId]) notes[contentId] = 'RESOLVED';
  } else if (result === 'WRONG') {
    // 이미 해결된 오답을 복습에서 다시 틀렸다고 미해결로 되돌리지는 않음
    if (notes[contentId] !== 'RESOLVED') notes[contentId] = 'PENDING';
  }
  return notes;
}

function reducer(state: AppState, action: Action): AppState {
  const r = state.records;
  switch (action.type) {
    case 'view': {
      const prev = r.stats[action.contentId];
      if (prev?.viewed) return state;
      return { ...state, records: { ...r, stats: { ...r.stats, [action.contentId]: { viewed: true, completed: prev?.completed ?? false, watchedAt: prev?.watchedAt ?? '' } } } };
    }
    case 'complete': {
      const prev = r.stats[action.contentId] ?? { viewed: true, completed: false, watchedAt: '' };
      return { ...state, records: { ...r, stats: { ...r.stats, [action.contentId]: { ...prev, viewed: true, completed: true, watchedAt: action.at } } } };
    }
    case 'setLast':
      return { ...state, records: { ...r, lastContentId: action.contentId } };
    case 'like':
      return { ...state, records: { ...r, liked: action.on ? [...new Set([...r.liked, action.contentId])] : r.liked.filter((id) => id !== action.contentId) } };
    case 'save':
      return { ...state, records: { ...r, saved: action.on ? [...new Set([...r.saved, action.contentId])] : r.saved.filter((id) => id !== action.contentId) } };
    case 'exposeEndQuiz':
      return { ...state, records: { ...r, seriesQuizExposure: { ...r.seriesQuizExposure, [action.contentId]: (r.seriesQuizExposure[action.contentId] ?? 0) + 1 } } };
    case 'exposeReview':
      return { ...state, records: { ...r, reviewExposure: r.reviewExposure + 1 } };
    case 'answer': {
      const quiz = quizOf(state, action.contentId);
      const version = quiz?.version ?? 1;
      const response = { id: state.responseSeq, contentId: action.contentId, version, path: action.path, picked: action.picked, result: action.result, at: action.at };
      return {
        ...state,
        responseSeq: state.responseSeq + 1,
        records: { ...r, responses: [...r.responses, response], wrongNotes: applyWrongNote(r, action.contentId, action.result) },
      };
    }
    case 'cardOpen': {
      const log = r.cardLogs[action.contentId] ?? { opened: 0, revealed: 0 };
      return { ...state, records: { ...r, cardLogs: { ...r.cardLogs, [action.contentId]: { ...log, opened: log.opened + 1 } } } };
    }
    case 'cardReveal': {
      const log = r.cardLogs[action.contentId] ?? { opened: 0, revealed: 0 };
      return { ...state, records: { ...r, cardLogs: { ...r.cardLogs, [action.contentId]: { ...log, revealed: log.revealed + 1 } } } };
    }
    case 'setInterests':
      return { ...state, records: { ...r, interests: action.ids } };
    case 'setInterval':
      return { ...state, records: { ...r, reviewInterval: action.value } };
    case 'onboard':
      return { ...state, records: { ...r, onboarded: true } };
    case 'resetRecords':
      // user1 테스트 기록만 비우고 콘텐츠·퀴즈·시리즈 자료는 그대로 둠(공통기준 33)
      return {
        ...state,
        records: {
          stats: {}, liked: [], saved: [], wrongNotes: {}, responses: [], cardLogs: {},
          seriesQuizExposure: {}, reviewExposure: 0,
          interests: r.interests, reviewInterval: r.reviewInterval, onboarded: r.onboarded, lastContentId: null,
        },
      };
    default:
      return state;
  }
}

interface Store {
  state: AppState;
  dispatch: Dispatch<Action>;
}

const StoreContext = createContext<Store | null>(null);

export function AppStoreProvider({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(reducer, {
    contents: sampleContents,
    quizzes: sampleQuizzes,
    records: initialRecords,
    responseSeq: 100,
  });
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const value = useContext(StoreContext);
  if (!value) throw new Error('useStore는 AppStoreProvider 안에서만 쓸 수 있음');
  return value;
}

export type { AppState };
export { sampleContents, sampleQuizzes, sampleSeries };

export function publicContents(state: AppState): Content[] {
  return state.contents.filter((c) => c.status === 'PUBLISHED');
}
