import type { AppState } from './store';
import { publicContents } from './store';
import type { ReviewSession } from './reviewSession';
import { quizOf } from './sasuSample';

// 피드 복기 대상 선정(화면 설계서 C02 / 공통기준 22·23).
// - 대상: 시청 완료했고 등록 퀴즈가 있는 공개 콘텐츠
// - 이번 창에서 이미 낸 문제는 제외, 단 복기에서 틀린 문제(retry)는 다시 낼 수 있음
// - 정렬: 미해결 오답 우선, 그다음 오래전에 본 것 우선
export function reviewCandidates(state: AppState, session: ReviewSession): number[] {
  const r = state.records;
  return publicContents(state)
    .filter((c) => r.stats[c.id]?.completed && quizOf(c.id))
    .filter((c) => !session.shownQuizIds.includes(c.id) || session.retryQuizIds.includes(c.id))
    .map((c) => ({
      id: c.id,
      pending: r.wrongNotes[c.id] === 'PENDING',
      watchedAt: r.stats[c.id]?.watchedAt ?? '',
    }))
    .sort((a, b) => (a.pending === b.pending ? a.watchedAt.localeCompare(b.watchedAt) : a.pending ? -1 : 1))
    .map((x) => x.id);
}
