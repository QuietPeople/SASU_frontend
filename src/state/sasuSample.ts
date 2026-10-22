import type { Category, Content, Quiz } from '../types/sasu';

// 화면 확인용 예시 데이터와 가짜 요청 함수. 실제 API가 준비되면 request 대신 fetch로 바꿈.
// 제목·카테고리·커리큘럼명은 기획서 예상 화면과 본문에 나온 것을 사용함.

export const sampleCategories: Category[] = [
  { id: 1, name: '실무 용어' },
  { id: 2, name: '엑셀' },
  { id: 3, name: '재경' },
  { id: 4, name: 'AI 업무 활용' },
  { id: 5, name: '커뮤니케이션·협업' },
  { id: 6, name: '기획·문서·보고' },
  { id: 7, name: '취업·직무입문' },
];

const base = {
  source: '제작자 작성 · 예시 출처',
  reviewedAt: '2026-10-01',
  cautionEnabled: false,
  cautionText: '',
};

export const sampleContents: Content[] = [
  { ...base, id: 1, title: 'AI 답변, 그대로 쓰기 전에 확인할 3가지', categoryId: 4, tags: ['AI 검증', '출처'], summary: 'AI가 만든 결과를 업무에 사용하기 전 최소 검증 항목을 구분한다. 사실과 수치는 원문 출처를 다시 확인하고, 민감정보 포함 여부와 숨은 가정을 확인한다.', status: 'PUBLISHED', durationSec: 68 },
  { ...base, id: 2, title: '일정 지연 보고, 늦기 전에 말하는 구조', categoryId: 5, tags: ['보고', '일정'], summary: '지연 사실과 영향, 대응안, 필요한 결정을 빠짐없이 보고한다. 현재 상태를 수치나 완료 기준으로 말한다.', status: 'PUBLISHED', durationSec: 40 },
  { ...base, id: 3, title: '결론부터 쓰는 업무 이메일 첫 세 줄', categoryId: 6, tags: ['이메일', '보고'], summary: '보고 이메일은 결론과 요청을 첫 문장에 둔다. 배경 설명은 그다음에 짧게 붙인다.', status: 'PUBLISHED', durationSec: 38 },
  { ...base, id: 4, title: 'XLOOKUP이 안 될 때 먼저 볼 조건', categoryId: 2, tags: ['XLOOKUP', '함수'], summary: '찾는 값과 범위의 형식이 같은지 먼저 확인한다. 공백과 숫자 형식 차이가 흔한 원인이다.', status: 'PUBLISHED', durationSec: 40 },
  { ...base, id: 5, title: '미팅 어레인지', categoryId: 1, tags: ['회의', '외래어'], summary: '미팅 어레인지는 회의 준비와 조율을 뜻한다. 일정, 장소, 참석자를 맞추는 일까지 포함한다.', status: 'PUBLISHED', durationSec: 15, cautionEnabled: true, cautionText: '회사에 따라 의미가 다를 수 있음' },
  { ...base, id: 6, title: '송부', categoryId: 1, tags: ['문서', '한자어'], summary: '송부는 문서나 물건을 보내는 일을 뜻한다. 메일에서는 첨부해 보낸다는 의미로 자주 쓴다.', status: 'PUBLISHED', durationSec: 15 },
  { ...base, id: 7, title: 'R&R', categoryId: 1, tags: ['역할', '약어'], summary: 'R&R은 역할과 책임(Role & Responsibility)을 뜻한다. 누가 무엇을 맡는지 정할 때 쓴다.', status: 'PUBLISHED', durationSec: 15 },
  { ...base, id: 8, title: 'ASAP', categoryId: 1, tags: ['약어', '일정'], summary: 'ASAP은 가능한 한 빨리(As Soon As Possible)를 뜻한다. 정확한 기한을 함께 확인하는 것이 좋다.', status: 'PUBLISHED', durationSec: 15 },
  { ...base, id: 9, title: '크로스체크', categoryId: 1, tags: ['검토', '외래어'], summary: '크로스체크는 다른 사람이나 다른 자료로 한 번 더 확인하는 일을 뜻한다.', status: 'PUBLISHED', durationSec: 15, cautionEnabled: true, cautionText: '회사에 따라 의미가 다를 수 있음' },
  { ...base, id: 10, title: '엑셀 중복값 제거', categoryId: 2, tags: ['중복값', '데이터 정리'], summary: '중복된 행을 지우기 전에 기준 열을 먼저 정한다. 원본은 복사해 두고 작업한다.', status: 'PUBLISHED', durationSec: 40 },
  { ...base, id: 11, title: '공고 분석하는 법', categoryId: 7, tags: [], summary: '', source: '', reviewedAt: '', status: 'DRAFT', durationSec: null },
  { ...base, id: 12, title: 'STAR로 경험 답변하기', categoryId: 7, tags: ['면접'], summary: '', source: '', reviewedAt: '', status: 'DRAFT', durationSec: null },
];

// 콘텐츠별 등록 문항. 3·5번 외 문항은 핵심 내용 문장을 바탕으로 만든 예시임
export const sampleQuizzes: Quiz[] = [
  { contentId: 1, version: 2, format: 'THREE', question: 'AI 답변을 업무에 쓰기 전에 가장 먼저 확인할 것은?', choices: ['문장이 자연스러운지', '사실과 수치의 원문 출처', '답변의 길이'], answer: 1, explanation: '사실과 수치는 원문 출처를 다시 확인한다. 문장이 자연스러워도 내용이 틀릴 수 있다.' },
  { contentId: 2, version: 1, format: 'THREE', question: '일정 지연을 보고할 때 빠뜨리지 말아야 할 것은?', choices: ['지연 사실과 영향, 대응안', '지연된 이유에 대한 사과만', '다음 일정 없이 현재 상황만'], answer: 0, explanation: '지연 사실과 영향, 대응안, 필요한 결정을 함께 보고해야 상대가 판단할 수 있다.' },
  { contentId: 3, version: 1, format: 'FOUR', question: '보고 이메일의 첫 문장으로 가장 적절한 것은?', choices: ['안녕하세요, 요즘 날씨가 많이 추워졌습니다.', '지난주부터 여러 상황을 검토해 보았습니다.', '납기 지연 가능성이 있어 대응안 승인을 요청드립니다.', '첨부파일을 보내드리오니 확인 바랍니다.'], answer: 2, explanation: '결론과 요청을 첫 문장에 두면 읽는 사람이 바로 판단할 수 있다.' },
  { contentId: 4, version: 1, format: 'THREE', question: 'XLOOKUP이 값을 찾지 못할 때 먼저 확인할 것은?', choices: ['찾는 값과 범위의 형식이 같은지', '시트 이름이 영어인지', '글꼴 크기가 같은지'], answer: 0, explanation: '공백과 숫자 형식 차이가 흔한 원인이라 찾는 값과 범위의 형식부터 확인한다.' },
  { contentId: 5, version: 1, format: 'OX', question: '미팅 어레인지는 일정, 장소, 참석자를 맞추는 일까지 포함한다.', choices: ['O', 'X'], answer: 0, explanation: '회의 준비와 조율 전반을 뜻하므로 일정·장소·참석자 조율이 포함된다.' },
  { contentId: 8, version: 1, format: 'THREE', question: 'ASAP 요청을 받았을 때 함께 확인하면 좋은 것은?', choices: ['정확한 기한', '요청한 사람의 직급', '메일 글꼴'], answer: 0, explanation: 'ASAP은 사람마다 기준이 달라 정확한 기한을 함께 확인하는 것이 좋다.' },
  { contentId: 10, version: 1, format: 'THREE', question: '엑셀에서 중복값을 지우기 전에 먼저 할 일은?', choices: ['기준 열을 정하고 원본을 복사해 둔다', '바로 중복 제거를 누른다', '열 너비를 맞춘다'], answer: 0, explanation: '기준 열을 먼저 정하고 원본을 복사해 두어야 잘못 지웠을 때 되돌릴 수 있다.' },
];

export function categoryName(categories: Category[], id: number): string {
  return categories.find((c) => c.id === id)?.name ?? '미지정';
}

export function quizOf(contentId: number): Quiz | undefined {
  return sampleQuizzes.find((q) => q.contentId === contentId);
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// 주소에 ?fail=list 처럼 붙이면 그 요청을 실패로 돌려 오류 화면을 확인할 수 있음(여러 개는 쉼표로)
function shouldFail(key: string): boolean {
  try {
    const params = new URLSearchParams(window.location.search);
    return (params.get('fail') ?? '').split(',').includes(key);
  } catch {
    return false;
  }
}

export async function request<T>(key: string, payload: T, ms = 500): Promise<T> {
  await wait(ms);
  if (shouldFail(key)) throw new Error('서버에 연결하지 못했습니다.');
  return payload;
}
