import { useQuery } from '@tanstack/react-query'
import { api } from './client'

export interface Category {
  category_id: number
  name: string
}
export interface LearnerContent {
  content_id: number
  title: string | null
  category: Category | null
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
export interface SavedContent {
  content: LearnerContent
  saved_at: string
}
export interface WrongAnswer {
  content: LearnerContent
  question: {
    question_id: number
    question_version_id: number
    content_id: number
    question_text: string
  }
  status: 'PENDING' | 'RESOLVED'
  wrong_count: number
  first_wrong_at: string
  last_wrong_at: string
  resolved_at: string | null
}
export interface Flashcard {
  question_id: number
  question_version_id: number
  content_id: number
  content_title: string
  category: Category
  front: string
}
export interface CurriculumSummary {
  curriculum_id: number
  title: string
  description: string | null
  total_steps: number
  available_steps: number
  completed_steps: number | null
  progress_percent: number | null
}
export interface CurriculumStep {
  curriculum_content_id: number
  content_id: number
  step_order: number
  watch_completed: boolean | null
  question_correct: boolean | null
  completed: boolean | null
  content: LearnerContent | null
  available: boolean
}
export interface CurriculumDetail {
  summary: CurriculumSummary
  steps: CurriculumStep[]
}
export interface LearnerDashboard {
  user_id: number
  watched_content_count: number
  completed_content_count: number
  answered_count: number
  pending_question_count: number
  first_quiz_accuracy: { numerator: number; denominator: number; percent: number | null }
  category_states: {
    category: Category
    pending_question_count: number
    state: 'NEEDS_REVIEW' | 'NO_PENDING_WRONG'
  }[]
  curriculums: CurriculumSummary[]
}
export interface LearnerSettings {
  user_id: number
  interest_category_ids: number[]
  interest_guide_completed: boolean
  review_interval: number
  record_generation: number
}
export function useCategories(actorId: number | null, generation: number | null) {
  return useQuery({
    queryKey: ['learner', 'categories', actorId, generation],
    queryFn: ({ signal }) => api<{ items: Category[] }>('/categories', { actorId, signal }),
    enabled: actorId !== null,
  })
}
export function pageNumber(value: string | null) {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1
}
export function categoryId(value: string | null) {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined
}
