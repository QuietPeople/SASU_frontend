// 피드 복기 세션(화면 설계서 C02, 공통기준 19~24).
// 복기 간격 카운터와 같은 문제 노출 판정은 '같은 창'에서만 유지하고 창을 닫으면 초기화하므로
// DB 학습 기록(UserRecords)과 달리 sessionStorage에 담는다.
//   counter      : 시청 완료한 서로 다른 영상 수. 복기 간격에 닿으면 복기 카드를 띄움
//   countedIds   : 이미 센 콘텐츠. 같은 창에서 재시청해도 다시 세지 않음(공통기준 21)
//   shownQuizIds : 이 창에서 한 번 낸 복기 문제. 다시 뽑지 않음(공통기준 23)
//   retryQuizIds : 복기에서 틀려 다시 낼 수 있는 문제. shownQuizIds보다 우선함

export interface ReviewSession {
  counter: number;
  countedIds: number[];
  shownQuizIds: number[];
  retryQuizIds: number[];
}

const STORAGE_KEY = 'sasu.reviewSession';

export function emptySession(): ReviewSession {
  return { counter: 0, countedIds: [], shownQuizIds: [], retryQuizIds: [] };
}

export function readSession(): ReviewSession {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return emptySession();
    const saved = JSON.parse(raw) as Partial<ReviewSession>;
    const base = emptySession();
    return {
      counter: Number(saved.counter) || 0,
      countedIds: Array.isArray(saved.countedIds) ? saved.countedIds : base.countedIds,
      shownQuizIds: Array.isArray(saved.shownQuizIds) ? saved.shownQuizIds : base.shownQuizIds,
      retryQuizIds: Array.isArray(saved.retryQuizIds) ? saved.retryQuizIds : base.retryQuizIds,
    };
  } catch {
    return emptySession();
  }
}

// 시크릿 창 등 저장이 막힌 환경에서도 화면이 멈추지 않도록 실패를 무시함
export function writeSession(session: ReviewSession): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    /* 저장 실패는 현재 창 동작에 영향 없음 */
  }
}
