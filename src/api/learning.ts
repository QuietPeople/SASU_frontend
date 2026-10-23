import { api, queryString, type ApiPage } from './client'

export interface LearningIdentity {
  actorId: number
  learnerId: number
  generation: number
}

export interface LearningContent {
  content_id: number
  title: string | null
  category: { category_id: number; name: string } | null
  tags: { tag_id: number; name: string }[]
  video_duration: number | null
  video_url: string | null
  media_revision: string | null
  view_count: number
  like_count: number
  liked: boolean | null
  saved: boolean | null
  watch_completed: boolean | null
  has_quiz: boolean
  status: 'DRAFT' | 'PUBLISHED'
}

export interface LearningContentDetail {
  content: LearningContent
  core_content: string | null
  one_line_summary: string | null
  source: string | null
  reviewed_on: string | null
  caution_enabled: boolean
  caution_text: string | null
  related_curriculums: { curriculum_id: number; title: string }[]
}

export interface LearningQuestion {
  question_id: number
  question_version_id: number
  content_id: number
  question_type: 'OX' | 'MCQ_3' | 'MCQ_4'
  question_text: string
  options: { option_id: number; option_order: number; option_text: string }[]
}

export type ResponsePath = 'VIDEO_QUIZ' | 'FEED_REVIEW' | 'WRONG_NOTE'
export type LearningResult = 'CORRECT' | 'WRONG' | 'SKIP'

export interface LearningResponse {
  response_id: number
  attempt_id: string | null
  question: LearningQuestion
  response_path: ResponsePath
  result: LearningResult
  selected_option_id: number | null
  correct_option_id: number
  correct_answer: string
  explanation: string
  submitted_at: string
  wrong_state: { question_version_id: number; status: 'PENDING' | 'RESOLVED' } | null
}

export interface LearningAttempt {
  attempt_id: string
  user_id: number
  question: LearningQuestion
  response_path: ResponsePath
  submitted: boolean
  response: LearningResponse | null
  record_generation: number
}

export interface WrongAnswer {
  question: LearningQuestion
  content: LearningContent
  status: 'PENDING' | 'RESOLVED'
  wrong_count: number
}

export interface LearningFlashcard {
  question_id: number
  question_version_id: number
  content_id: number
  content_title: string
  category: { category_id: number; name: string }
  front: string
}

export interface FlashcardAnswer {
  card: LearningFlashcard
  back: string
  explanation: string
}

export type WatchContext = 'FEED' | 'SEARCH' | 'CURRICULUM' | 'LIBRARY' | 'REVIEW'
export interface WatchReport {
  visit_id: string
  media_revision: string
  actual_played_seconds: number
  watched_segments: number[][]
  context: WatchContext
}
export interface WatchResult {
  view_counted: boolean
  watch_completed: boolean
  visit_watch_percent: number
  feed_completion_eligible: boolean
  view_count: number
  record_generation: number
}

export type LearningEvent =
  | { event_type: 'VIDEO_QUIZ_SHOWN' | 'FEED_REVIEW_SHOWN'; attempt_id: string }
  | {
      event_type: 'FLASHCARD_VIEWED' | 'FLASHCARD_FLIPPED'
      content_id: number
      question_version_id: number
    }
  | { event_type: 'PLAY_ERROR'; content_id: number; error_code?: string }
  | { event_type: 'SEARCH_EMPTY' }

export function learningKey(identity: LearningIdentity, ...parts: unknown[]) {
  return [
    'learner',
    parts[0],
    identity.actorId,
    identity.learnerId,
    identity.generation,
    ...parts.slice(1),
  ]
}

export function getLearningContent(
  identity: LearningIdentity,
  contentId: number,
  signal?: AbortSignal,
) {
  return api<LearningContentDetail>(
    `/contents/${contentId}${queryString({ view: 'learner', user_id: identity.learnerId })}`,
    { actorId: identity.actorId, signal },
  )
}

export function getLearningQuestion(
  identity: LearningIdentity,
  contentId: number,
  signal?: AbortSignal,
) {
  return api<LearningQuestion | null>(`/contents/${contentId}/question`, {
    actorId: identity.actorId,
    signal,
  })
}

export function recordLearningEvent(
  identity: LearningIdentity,
  clientEventId: string,
  event: LearningEvent,
  signal?: AbortSignal,
) {
  return api(`/users/${identity.learnerId}/events`, {
    method: 'POST',
    ...identity,
    body: { client_event_id: clientEventId, ...event },
    signal,
  })
}

export function createLearningAttempt(
  identity: LearningIdentity,
  attemptId: string,
  question: LearningQuestion,
  responsePath: ResponsePath,
  signal?: AbortSignal,
) {
  return api<LearningAttempt>(`/users/${identity.learnerId}/question-attempts`, {
    method: 'POST',
    ...identity,
    signal,
    body: {
      attempt_id: attemptId,
      question_id: question.question_id,
      expected_question_version_id: question.question_version_id,
      response_path: responsePath,
    },
  })
}

export function recoverLearningAttempt(
  identity: LearningIdentity,
  attemptId: string,
  signal?: AbortSignal,
) {
  return api<LearningAttempt>(`/users/${identity.learnerId}/question-attempts/${attemptId}`, {
    actorId: identity.actorId,
    signal,
  })
}

export function submitLearningAttempt(
  identity: LearningIdentity,
  attemptId: string,
  optionId: number | null,
  signal?: AbortSignal,
) {
  return api<LearningResponse>(
    `/users/${identity.learnerId}/question-attempts/${attemptId}/response`,
    {
      method: 'PUT',
      ...identity,
      signal,
      body:
        optionId === null ? { action: 'SKIP' } : { action: 'ANSWER', selected_option_id: optionId },
    },
  )
}

export function getWrongAnswers(identity: LearningIdentity, page: number, signal?: AbortSignal) {
  return api<ApiPage<WrongAnswer>>(
    `/users/${identity.learnerId}/reviews/wrong-answers${queryString({ page, size: 100, status: 'PENDING' })}`,
    { actorId: identity.actorId, signal },
  )
}

export function getFlashcards(identity: LearningIdentity, page: number, signal?: AbortSignal) {
  return api<ApiPage<LearningFlashcard>>(
    `/users/${identity.learnerId}/reviews/flashcards${queryString({ page, size: 20 })}`,
    { actorId: identity.actorId, signal },
  )
}

export function getFlashcardAnswer(
  identity: LearningIdentity,
  questionVersionId: number,
  signal?: AbortSignal,
) {
  return api<FlashcardAnswer>(
    `/users/${identity.learnerId}/reviews/flashcards/${questionVersionId}`,
    { actorId: identity.actorId, signal },
  )
}

export function sendWatchReport(
  identity: LearningIdentity,
  contentId: number,
  report: WatchReport,
  keepalive = false,
) {
  return api<WatchResult>(`/users/${identity.learnerId}/contents/${contentId}/watch-reports`, {
    method: 'POST',
    ...identity,
    body: report,
    keepalive,
  })
}
