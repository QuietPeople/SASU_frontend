// SASU 화면에서 쓰는 콘텐츠·퀴즈 타입(통합 DB 설계서의 contents, quizzes 기준으로 화면에 필요한 값만)

export type ContentStatus = 'DRAFT' | 'PUBLISHED';

// 영상당 문항 1개. OX·3지·4지 중 하나(최종 공통기준 17)
export type QuizFormat = 'OX' | 'THREE' | 'FOUR';

export interface Category {
  id: number;
  name: string;
}

export interface Content {
  id: number;
  title: string;
  categoryId: number;
  tags: string[];
  summary: string; // 핵심 내용. 첫 문장을 한 줄 정리로 씀(기능 정의서 C17)
  source: string;
  reviewedAt: string;
  status: ContentStatus;
  durationSec: number | null;
  cautionEnabled: boolean; // 실무 용어 해석 주의 표시 여부
  cautionText: string;
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

export type QuizResult = 'CORRECT' | 'WRONG' | 'SKIPPED';
