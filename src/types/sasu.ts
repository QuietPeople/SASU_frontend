// SASU 화면에서 쓰는 타입(통합 DB 설계서의 contents, quizzes 기준으로 화면에 필요한 값만)
// 화면 설계서 1-3의 'DB의 user1 기록'에 해당하는 값은 UserRecords로 묶음

export type ContentStatus = 'DRAFT' | 'PUBLISHED';

// 영상당 문항 1개. OX·3지·4지 중 하나(최종 공통기준 17)
export type QuizFormat = 'OX' | 'THREE' | 'FOUR';

// 보기 수는 형식에서 바로 나옴(A03에서 형식을 바꾸면 이 수만큼만 입력받음)
export const CHOICE_COUNT: Record<QuizFormat, number> = { OX: 2, THREE: 3, FOUR: 4 };

export interface Category {
  id: number;
  name: string;
}

export interface Content {
  id: number;
  title: string;
  categoryId: number;
  tags: string[];
  summary: string; // 핵심 내용. 첫 문장을 한 줄 정리로 씀(기능 정의서 C17 / P18)
  related: string; // 관련 학습 정보(화면 설계서 L02-04)
  source: string;
  reviewedAt: string;
  status: ContentStatus;
  durationSec: number | null;
  hasVideo: boolean; // 영상 파일 등록 여부. 공개 필수 7종의 하나(공통기준 04)
  cautionEnabled: boolean; // 실무 용어 해석 주의 표시 여부(P14)
}

export interface Quiz {
  contentId: number;
  version: number;
  format: QuizFormat;
  question: string;
  choices: string[];
  answer: number; // 정답 보기 번호(0부터)
  explanation: string;
}

// 시리즈 순서와 완료 기준은 콘텐츠 기본정보와 따로 저장함(화면 설계서 A04-04)
// 완료 기준은 '시청 90% AND 해당 문항 정답'으로 고정이라 변경 필드를 두지 않음
export interface Series {
  id: number;
  name: string;
  description: string;
  stepContentIds: number[];
}

export type QuizResult = 'CORRECT' | 'WRONG' | 'SKIPPED';

// 어느 화면에서 풀었는지. A06이 최초 풀이와 피드 복기를 나눠 집계하는 데 씀(공통기준 30)
export type SolvePath = 'END' | 'REVIEW' | 'WRONG';

export const PATH_LABEL: Record<SolvePath, string> = {
  END: '영상 종료',
  REVIEW: '피드 복기',
  WRONG: '오답 복습',
};

// 제출 1건. 건너뛰기도 기록하지만 정답률 분모에서는 빼므로 result로 구분함(공통기준 25)
export interface QuizResponse {
  id: number;
  contentId: number;
  version: number; // 제출 당시 문항 버전(공통기준 31)
  path: SolvePath;
  picked: number | null; // 건너뛰기는 null
  result: QuizResult;
  at: string;
}

// 콘텐츠별 시청 기록. 조회는 재생 합계 3초·최초 1회, 완료는 고유 구간 90%(공통기준 14·15·16)
export interface WatchStat {
  viewed: boolean;
  completed: boolean;
  watchedAt: string; // 마지막 시청 시각. 복기 대상 선정에서 '오래전에 본' 판단에 씀(공통기준 22)
}

// 미해결 오답. 어느 경로의 정답이든 해결로 바뀜(공통기준 26)
export type WrongStatus = 'PENDING' | 'RESOLVED';

// 카드 열람·답 펼침은 정답 제출이 아니므로 응답과 따로 센다(공통기준 27 / A06-05)
export interface CardLog {
  opened: number;
  revealed: number;
}

export interface UserRecords {
  stats: Record<number, WatchStat>;
  liked: number[];
  saved: number[];
  wrongNotes: Record<number, WrongStatus>;
  responses: QuizResponse[];
  cardLogs: Record<number, CardLog>;
  seriesQuizExposure: Record<number, number>; // 콘텐츠별 영상 종료 퀴즈 노출 수(A06 참여율 분모)
  reviewExposure: number; // 복기 카드 노출 수(A06 복기 응답률 분모)
  interests: number[];
  reviewInterval: number; // 복기 간격. 기본 5(공통기준 19)
  onboarded: boolean; // L01 첫 안내를 마쳤는지(P01)
  lastContentId: number | null; // 마지막으로 보던 콘텐츠(공통기준 32)
}
