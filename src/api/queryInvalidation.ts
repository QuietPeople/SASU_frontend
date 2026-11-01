import type { Query, QueryClient } from '@tanstack/react-query'
import type { LearningIdentity } from './learning'

type Predicate = (query: Query) => boolean

// 기존 키 형식을 유지한다. 조회 URL의 필터와 all-pages 키도 같은 리소스로 분류한다.
function adminPath(query: Query) {
  const key = query.queryKey
  if (key[0] !== 'admin') return null
  const path = key[3] === 'all-pages' ? key[4] : key[3]
  if (typeof path !== 'string' || !path.startsWith('/')) return null
  const [pathname, search = ''] = path.split('?')
  return { pathname, params: new URLSearchParams(search) }
}

function learnerResource(query: Query, entities: readonly string[], contentId?: number) {
  const key = query.queryKey
  if (key[0] !== 'learner' || !entities.includes(String(key[1]))) return false
  return (
    !['content', 'question'].includes(String(key[1])) ||
    contentId === undefined ||
    key[5] === contentId
  )
}

function sameLearner(query: Query, identity: LearningIdentity) {
  const key = query.queryKey
  return (
    key[0] === 'learner' &&
    key[2] === identity.actorId &&
    key[3] === identity.learnerId &&
    key[4] === identity.generation
  )
}

function adminContents(query: Query, contentId?: number) {
  if (query.queryKey[0] === 'admin' && query.queryKey[3] === 'stats-content-search') return true
  const path = adminPath(query)?.pathname
  if (path === '/contents') return true
  const match = path?.match(/^\/contents\/(\d+)$/)
  return Boolean(match && (contentId === undefined || Number(match[1]) === contentId))
}

function adminCurriculums(query: Query, curriculumId?: number) {
  const path = adminPath(query)?.pathname
  if (path === '/curriculums') return true
  const match = path?.match(/^\/curriculums\/(\d+)$/)
  return Boolean(match && (curriculumId === undefined || Number(match[1]) === curriculumId))
}

function adminStatistics(query: Query, contentId?: number) {
  const path = adminPath(query)?.pathname
  if (path === '/statistics') return true
  const match = path?.match(/^\/contents\/(\d+)\/statistics(?:\/[^/]+)?$/)
  return Boolean(match && (contentId === undefined || Number(match[1]) === contentId))
}

function adminResponses(query: Query, contentId?: number) {
  const path = adminPath(query)
  if (path?.pathname !== '/responses') return false
  const target = path.params.get('content_id')
  return !target || contentId === undefined || Number(target) === contentId
}

function adminQuestionHistory(query: Query, questionId?: number) {
  const match = adminPath(query)?.pathname.match(/^\/questions\/(\d+)\/versions(?:\/\d+)?$/)
  return Boolean(match && (questionId === undefined || Number(match[1]) === questionId))
}

function invalidate(cache: QueryClient, predicate: Predicate): Promise<void> {
  return cache.invalidateQueries({ predicate })
}

const contentViews = ['content', 'search', 'saved', 'wrong', 'curriculum']
const progressViews = [...contentViews, 'dashboard', 'curriculums', 'cards', 'flashcards']
const publicContentViews = progressViews

// 현재 피드 순서와 진행 중인 풀이/복습 스냅샷은 일반 갱신 대상에서 제외한다.
export function invalidateLearnerReaction(
  cache: QueryClient,
  identity: LearningIdentity,
  contentId: number,
  kind: 'like' | 'saved',
): Promise<void> {
  const entities = kind === 'saved' ? [...contentViews, 'dashboard'] : contentViews
  return invalidate(
    cache,
    (query) =>
      (sameLearner(query, identity) && learnerResource(query, entities, contentId)) ||
      adminStatistics(query, contentId),
  )
}

export function invalidateWatchProgress(
  cache: QueryClient,
  identity: LearningIdentity,
  contentId: number,
): Promise<void> {
  return invalidate(
    cache,
    (query) =>
      (sameLearner(query, identity) && learnerResource(query, progressViews, contentId)) ||
      adminStatistics(query, contentId),
  )
}

export function invalidateQuizResult(
  cache: QueryClient,
  identity: LearningIdentity,
  contentId: number,
  questionId?: number,
): Promise<void> {
  return invalidate(
    cache,
    (query) =>
      (sameLearner(query, identity) &&
        learnerResource(query, [
          'wrong',
          'dashboard',
          'curriculum',
          'curriculums',
          'cards',
          'flashcards',
        ])) ||
      adminStatistics(query, contentId) ||
      adminResponses(query, contentId) ||
      adminQuestionHistory(query, questionId),
  )
}

export function invalidateLearnerSettings(
  cache: QueryClient,
  identity: LearningIdentity,
): Promise<void> {
  // 설정 응답은 호출부에서 설정 캐시에 반영한다. 추천 순서는 다음 피드 진입 때 갱신한다.
  return invalidate(
    cache,
    (query) => sameLearner(query, identity) && learnerResource(query, ['dashboard']),
  )
}

export function invalidateContentChange(
  cache: QueryClient,
  { contentId, tagsChanged = false }: { contentId?: number; tagsChanged?: boolean },
): Promise<void> {
  return invalidate(
    cache,
    (query) =>
      (tagsChanged && adminPath(query)?.pathname === '/tags') ||
      (contentId !== undefined &&
        (adminContents(query, contentId) ||
          adminCurriculums(query) ||
          adminStatistics(query, contentId) ||
          learnerResource(query, publicContentViews, contentId))),
  )
}

export function invalidateCategoryChange(
  cache: QueryClient,
  { renamed }: { renamed: boolean },
): Promise<void> {
  return invalidate(
    cache,
    (query) =>
      adminPath(query)?.pathname === '/categories' ||
      learnerResource(query, ['categories']) ||
      (renamed &&
        (adminContents(query) ||
          adminCurriculums(query) ||
          learnerResource(query, publicContentViews))),
  )
}

export function invalidateQuestionChange(
  cache: QueryClient,
  { contentId, questionId }: { contentId: number; questionId?: number },
): Promise<void> {
  return invalidate(
    cache,
    (query) =>
      adminContents(query, contentId) ||
      adminCurriculums(query) ||
      adminPath(query)?.pathname === `/contents/${contentId}/question` ||
      adminQuestionHistory(query, questionId) ||
      adminStatistics(query, contentId) ||
      adminResponses(query, contentId) ||
      learnerResource(query, [...publicContentViews, 'question'], contentId),
  )
}

export function invalidateCurriculumChange(
  cache: QueryClient,
  { curriculumId }: { curriculumId?: number },
): Promise<void> {
  return invalidate(
    cache,
    (query) =>
      adminCurriculums(query, curriculumId) ||
      Boolean(adminPath(query)?.pathname.match(/^\/contents\/\d+$/)) ||
      learnerResource(query, ['content', 'curriculums', 'dashboard']) ||
      (learnerResource(query, ['curriculum']) &&
        (curriculumId === undefined || query.queryKey[5] === curriculumId)),
  )
}

export async function invalidateRecordReset(
  cache: QueryClient,
  {
    learnerId,
    previousGeneration,
    newGeneration,
  }: {
    learnerId: number
    previousGeneration: number
    newGeneration: number
  },
): Promise<void> {
  if (previousGeneration === newGeneration) return
  const oldRecords: Predicate = (query) => {
    const key = query.queryKey
    return (
      key[0] === 'learner' &&
      key[1] !== 'categories' &&
      key[3] === learnerId &&
      typeof key[4] === 'number' &&
      key[4] < newGeneration
    )
  }
  await cache.cancelQueries({ predicate: oldRecords })
  // 이전 세대 요청을 다시 실행하지 않는다. 마운트된 화면은 새 세대 키로 조회한다.
  await cache.invalidateQueries({ predicate: oldRecords, refetchType: 'none' })
  await invalidate(
    cache,
    (query) => adminStatistics(query) || adminResponses(query) || adminQuestionHistory(query),
  )
}
