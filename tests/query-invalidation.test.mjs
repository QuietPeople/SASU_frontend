import assert from 'node:assert/strict'
import { test } from 'node:test'
import { QueryClient, QueryObserver } from '@tanstack/react-query'
import {
  invalidateLearnerReaction,
  invalidateWatchProgress,
  invalidateQuizResult,
  invalidateLearnerSettings,
  invalidateContentChange,
  invalidateCategoryChange,
  invalidateQuestionChange,
  invalidateCurriculumChange,
  invalidateRecordReset,
} from '../src/api/queryInvalidation.ts'

const identity = { actorId: 42, learnerId: 42, generation: 3 }
const learner = (entity, ...parts) => ['learner', entity, 42, 42, 3, ...parts]
const admin = (path) => ['admin', 1, 3, path]
const snapshots = [
  'currentFeed',
  'attempt',
  'attemptChoice',
  'attemptSubmission',
  'feedRecovery',
  'wrongReview',
]

const keys = {
  content: learner('content', 7),
  otherContent: learner('content', 8),
  question: learner('question', 7),
  otherQuestion: learner('question', 8),
  search: learner('search', '엑셀', null, 1),
  searchPage2: learner('search', '엑셀', 2, 2),
  saved: learner('saved', null, 1),
  savedPage2: learner('saved', 2, 2),
  wrong: learner('wrong', null, 1),
  cards: learner('cards', null, 1),
  flashcards: learner('flashcards', null, null, 1),
  curriculum: learner('curriculum', 11),
  otherCurriculum: learner('curriculum', 12),
  curriculums: learner('curriculums', 1),
  dashboard: learner('dashboard'),
  categories: ['learner', 'categories', 42, 3],
  otherActorContent: ['learner', 'content', 77, 42, 3, 7],
  otherLearnerContent: ['learner', 'content', 42, 43, 3, 7],
  previousContent: ['learner', 'content', 42, 42, 2, 7],
  users: ['session', 'users'],
  settings: ['session', 'settings', 42],
  otherSettings: ['session', 'settings', 43],
  currentFeed: learner('feed', 'current-visit', 0),
  attempt: learner('attempt', 'attempt-id'),
  attemptChoice: learner('attempt-choice', 'attempt-id'),
  attemptSubmission: learner('attempt-submission', 'attempt-id'),
  feedRecovery: learner('feed-attempt-recovery', 'attempt-id'),
  wrongReview: learner('wrong-review', 7, 20, 'attempt-id'),
  adminContent: admin('/contents/7?view=editor'),
  adminOtherContent: admin('/contents/8?view=editor'),
  adminContents: admin('/contents?status=ALL&page=1&size=10'),
  adminAllContents: ['admin', 1, 3, 'all-pages', '/contents?status=ALL'],
  adminPicker: ['admin', 1, 3, 'stats-content-search', '엑셀', '', 'ALL', 1],
  adminCategories: admin('/categories'),
  adminTags: admin('/tags?q=엑셀&size=20'),
  adminCurriculum: admin('/curriculums/11?view=editor'),
  adminOtherCurriculum: admin('/curriculums/12?view=editor'),
  adminCurriculums: admin('/curriculums?page=1&size=20'),
  adminQuestion: admin('/contents/7/question?view=editor'),
  adminOtherQuestion: admin('/contents/8/question?view=editor'),
  adminVersion: admin('/questions/19/versions/20'),
  adminOtherVersion: admin('/questions/29/versions/30'),
  adminHistory: admin('/questions/19/versions?page=1&size=10'),
  adminOtherHistory: admin('/questions/29/versions?page=1&size=10'),
  stats: admin('/statistics'),
  contentStats: admin('/contents/7/statistics'),
  otherContentStats: admin('/contents/8/statistics'),
  responses: admin('/responses?page=1&size=10'),
  contentResponses: admin('/responses?content_id=7&page=1&size=10'),
  otherContentResponses: admin('/responses?content_id=8&page=1&size=10'),
}

function trackedCache(t, selected = keys, inactive = []) {
  const cache = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity, gcTime: Infinity },
      mutations: { retry: false },
    },
  })
  const calls = new Map()
  const subscriptions = []
  for (const [name, queryKey] of Object.entries(selected)) {
    calls.set(name, 0)
    cache.setQueryData(queryKey, { name, revision: 0 })
    if (inactive.includes(name)) continue
    const observer = new QueryObserver(cache, {
      queryKey,
      queryFn: async () => {
        const revision = calls.get(name) + 1
        calls.set(name, revision)
        return { name, revision }
      },
    })
    subscriptions.push(observer.subscribe(() => {}))
  }
  t.after(() => {
    for (const unsubscribe of subscriptions) unsubscribe()
    cache.clear()
  })
  return {
    cache,
    refetched(...names) {
      for (const name of names) assert.equal(calls.get(name), 1, name + '은 한 번 갱신해야 함')
    },
    untouched(...names) {
      for (const name of names) assert.equal(calls.get(name), 0, name + '은 재조회하면 안 됨')
    },
    invalidated(name) {
      return cache.getQueryState(selected[name])?.isInvalidated
    },
  }
}

const unrelatedPersonalState = [
  'users',
  'settings',
  'otherSettings',
  'categories',
  'otherContent',
  'question',
  'otherQuestion',
  'otherActorContent',
  'otherLearnerContent',
  'previousContent',
  ...snapshots,
]

test('좋아요는 같은 사용자·세대의 콘텐츠 표시와 관련 통계만 갱신한다', async (t) => {
  const observed = trackedCache(t)
  await invalidateLearnerReaction(observed.cache, identity, 7, 'like')
  observed.refetched(
    'content',
    'search',
    'searchPage2',
    'saved',
    'savedPage2',
    'wrong',
    'curriculum',
    'stats',
    'contentStats',
  )
  observed.untouched(
    ...unrelatedPersonalState,
    'cards',
    'flashcards',
    'adminCategories',
    'adminQuestion',
    'otherContentStats',
    'responses',
  )
})

test('저장 해제는 저장 목록의 모든 필터·페이지와 개인 상태를 함께 갱신한다', async (t) => {
  const observed = trackedCache(t)
  await invalidateLearnerReaction(observed.cache, identity, 7, 'saved')
  observed.refetched('content', 'saved', 'savedPage2', 'search', 'searchPage2', 'curriculum')
  observed.untouched(...unrelatedPersonalState, 'adminCategories', 'otherContentStats')
})

test('시청 보고는 진도·복습 후보 조회를 갱신하고 풀이 준비나 피드 순서를 재조회하지 않는다', async (t) => {
  const observed = trackedCache(t)
  await invalidateWatchProgress(observed.cache, identity, 7)
  observed.refetched(
    'content',
    'search',
    'saved',
    'dashboard',
    'curriculum',
    'curriculums',
    'cards',
    'flashcards',
    'stats',
    'contentStats',
  )
  observed.untouched(...unrelatedPersonalState, 'adminCategories', 'adminQuestion', 'responses')
})

test('퀴즈 제출은 결과 목록·진도·관련 응답 통계를 갱신하고 현재 풀이를 보존한다', async (t) => {
  const observed = trackedCache(t)
  await invalidateQuizResult(observed.cache, identity, 7)
  observed.refetched(
    'wrong',
    'dashboard',
    'curriculum',
    'curriculums',
    'cards',
    'flashcards',
    'stats',
    'contentStats',
    'responses',
    'contentResponses',
    'adminHistory',
  )
  observed.untouched(
    ...unrelatedPersonalState,
    'adminCategories',
    'otherContentStats',
    'otherContentResponses',
  )
})

test('설정 저장 후 시작 안내를 갱신해도 현재 피드·사용자 목록·다른 사용자 캐시는 보존한다', async (t) => {
  const observed = trackedCache(t)
  await invalidateLearnerSettings(observed.cache, identity)
  observed.refetched('dashboard')
  observed.untouched(
    'users',
    'otherSettings',
    'categories',
    'content',
    'otherActorContent',
    'otherLearnerContent',
    'adminCategories',
    ...snapshots,
  )
})

test('비활성 저장 목록은 stale 처리만 하고 활성 상세는 실제로 재조회한다', async (t) => {
  const observed = trackedCache(t, keys, ['saved', 'savedPage2'])
  await invalidateLearnerReaction(observed.cache, identity, 7, 'saved')
  observed.refetched('content')
  observed.untouched('saved', 'savedPage2')
  assert.equal(observed.invalidated('saved'), true)
  assert.equal(observed.invalidated('savedPage2'), true)
  assert.equal(observed.invalidated('categories'), false)
})

test('콘텐츠 수정은 관리자 목록·전체 페이지·선택기와 여러 학습자의 해당 콘텐츠를 갱신한다', async (t) => {
  const observed = trackedCache(t)
  await invalidateContentChange(observed.cache, { contentId: 7, tagsChanged: true })
  observed.refetched(
    'adminContents',
    'adminAllContents',
    'adminPicker',
    'adminContent',
    'adminTags',
    'adminCurriculums',
    'content',
    'otherActorContent',
    'otherLearnerContent',
    'search',
    'saved',
    'wrong',
    'cards',
    'flashcards',
    'curriculum',
    'curriculums',
    'dashboard',
  )
  observed.untouched(
    'users',
    'settings',
    'categories',
    'otherContent',
    'adminOtherContent',
    'adminCategories',
    ...snapshots,
  )
})

test('태그가 바뀌지 않은 콘텐츠 저장은 태그 검색 캐시를 다시 요청하지 않는다', async (t) => {
  const observed = trackedCache(t)
  await invalidateContentChange(observed.cache, { contentId: 7, tagsChanged: false })
  observed.refetched('content', 'adminContent', 'adminContents')
  observed.untouched('adminTags', 'adminOtherContent', ...snapshots)
})

test('분야 추가는 선택 목록을 갱신하고 기존 콘텐츠·풀이를 불필요하게 재조회하지 않는다', async (t) => {
  const observed = trackedCache(t)
  await invalidateCategoryChange(observed.cache, { renamed: false })
  observed.refetched('categories', 'adminCategories')
  observed.untouched(
    'content',
    'search',
    'saved',
    'adminContent',
    'settings',
    'users',
    ...snapshots,
  )
})

test('분야 이름 변경은 이름을 포함한 콘텐츠 조회에도 반영한다', async (t) => {
  const observed = trackedCache(t)
  await invalidateCategoryChange(observed.cache, { renamed: true })
  observed.refetched('categories', 'adminCategories', 'content', 'otherContent', 'search', 'saved')
  observed.untouched('users', 'settings', 'adminTags', ...snapshots)
})

test('문항 버전 변경은 관련 문항·버전 이력을 갱신하고 이미 열린 풀이를 교체하지 않는다', async (t) => {
  const observed = trackedCache(t)
  await invalidateQuestionChange(observed.cache, { contentId: 7, questionId: 19 })
  observed.refetched('question', 'adminQuestion', 'adminVersion', 'adminHistory', 'wrong', 'cards')
  observed.untouched(
    'otherQuestion',
    'adminOtherQuestion',
    'adminOtherVersion',
    'adminOtherHistory',
    'users',
    'settings',
    'adminCategories',
    ...snapshots,
  )
})

test('시리즈 수정은 목록·해당 단계·콘텐츠의 관련 학습과 대시보드를 함께 갱신한다', async (t) => {
  const observed = trackedCache(t)
  await invalidateCurriculumChange(observed.cache, { curriculumId: 11 })
  observed.refetched(
    'adminCurriculums',
    'adminCurriculum',
    'curriculums',
    'curriculum',
    'content',
    'dashboard',
  )
  observed.untouched(
    'adminOtherCurriculum',
    'otherCurriculum',
    'users',
    'settings',
    'categories',
    ...snapshots,
  )
})

test('학습 기록 초기화는 대상 사용자의 이전 세대 요청을 취소하고 재전송하지 않는다', async (t) => {
  const oldKey = learner('content', 7)
  const newKey = ['learner', 'content', 42, 42, 4, 7]
  const observed = trackedCache(t, {
    old: oldKey,
    oldAttempt: learner('attempt', 'old-attempt'),
    next: newKey,
    otherLearner: keys.otherLearnerContent,
    users: keys.users,
    settings: keys.settings,
    categories: keys.categories,
    adminCategories: keys.adminCategories,
    stats: keys.stats,
    responses: keys.responses,
  })
  let aborted = false
  let requests = 0
  const pending = observed.cache
    .fetchQuery({
      queryKey: oldKey,
      staleTime: 0,
      queryFn: ({ signal }) => {
        requests++
        return new Promise((resolve, reject) => {
          signal.addEventListener('abort', () => {
            aborted = true
            reject(new Error('초기화 이전 조회 취소'))
          })
        })
      },
    })
    .catch(() => undefined)
  assert.equal(requests, 1)

  await invalidateRecordReset(observed.cache, {
    learnerId: 42,
    previousGeneration: 3,
    newGeneration: 4,
  })
  await pending

  assert.equal(aborted, true)
  assert.equal(requests, 1, '이전 세대의 취소된 요청을 다시 시작하면 안 됨')
  assert.equal(observed.invalidated('old'), true)
  assert.equal(observed.invalidated('oldAttempt'), true)
  observed.untouched(
    'old',
    'oldAttempt',
    'next',
    'otherLearner',
    'users',
    'settings',
    'categories',
    'adminCategories',
  )
  observed.refetched('stats', 'responses')
})

test('문항 식별값을 아는 퀴즈 제출은 다른 문항의 수정 이력을 재조회하지 않는다', async (t) => {
  const observed = trackedCache(t)
  await invalidateQuizResult(observed.cache, identity, 7, 19)
  observed.refetched('adminHistory', 'adminVersion', 'contentStats', 'contentResponses')
  observed.untouched(
    'adminOtherHistory',
    'adminOtherVersion',
    'otherContentResponses',
    ...snapshots,
  )
})

test('콘텐츠 생성 전 태그만 저장된 부분 성공은 태그 목록만 갱신한다', async (t) => {
  const observed = trackedCache(t)
  await invalidateContentChange(observed.cache, { tagsChanged: true })
  observed.refetched('adminTags')
  observed.untouched(
    'adminContents',
    'adminAllContents',
    'adminContent',
    'adminOtherContent',
    'adminPicker',
    'content',
    'search',
    'saved',
    'users',
    'settings',
    ...snapshots,
  )
})
