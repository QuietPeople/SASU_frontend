import { useQuery } from '@tanstack/react-query'
import { api, type ApiPage } from './client'
import { useSession } from '../state/session'

export interface AdminCategory {
  category_id: number
  name: string
}
export interface AdminTag {
  tag_id: number
  name: string
}
export interface AdminContent {
  content_id: number
  title: string | null
  category: AdminCategory | null
  tags: AdminTag[]
  status: 'DRAFT' | 'PUBLISHED'
  has_quiz: boolean
  video_url: string | null
  media_revision: string | null
  video_duration: number | null
}
export interface EditableContent {
  detail: {
    content: AdminContent
    core_content: string | null
    source: string | null
    reviewed_on: string | null
    caution_enabled: boolean
    caution_text: string | null
    related_curriculums: { curriculum_id: number; title: string }[]
  }
  missing_for_publish: string[]
}
export interface VideoPolicy {
  max_bytes: number
  min_duration_sec: number
  max_duration_sec: number
  max_long_edge_px: number
  accept: string
  formats: string[]
}
export type UploadedVideo = Pick<
  AdminContent,
  'content_id' | 'video_url' | 'video_duration' | 'media_revision' | 'status'
>
export type QuestionType = 'OX' | 'MCQ_3' | 'MCQ_4'
export interface AdminQuestion {
  question_id: number
  question_version_id: number
  content_id: number
  question_type: QuestionType
  question_text: string
  options: { option_id: number; option_order: number; option_text: string }[]
}
export interface QuestionVersion extends AdminQuestion {
  version_no: number
  explanation: string
  created_at: string
  is_current: boolean
  options: (AdminQuestion['options'][number] & { is_correct: boolean })[]
}
export interface VersionSummary {
  question_version_id: number
  version_no: number
  created_at: string
  is_current: boolean
  response_count: number
}
export interface AdminCurriculum {
  curriculum_id: number
  title: string
  description: string | null
  total_steps: number
  available_steps: number
}
export interface CurriculumDetail {
  summary: AdminCurriculum
  steps: { content_id: number; content: AdminContent | null; available: boolean }[]
}
export interface Rate {
  numerator: number
  denominator: number
  percent: number | null
}
export interface AdminStatistics {
  reactions: { view_count: number; like_count: number; saved_count: number; watch_completion: Rate }
  quiz: {
    shown_count: number
    answered_count: number
    skipped_count: number
    participation: Rate
    first_accuracy: Rate
  }
  feed_review: {
    shown_count: number
    answered_count: number
    skipped_count: number
    response_rate: Rate
    accuracy: Rate
  }
  wrong_review: {
    answered_count: number
    accuracy: Rate
    pending_count: number
    resolved_count: number
  }
  flashcards: { viewed_count: number; flipped_count: number }
}
export interface AdminResponse {
  response_id: number
  user_id: number
  question: AdminQuestion
  response_path: 'VIDEO_QUIZ' | 'FEED_REVIEW' | 'WRONG_NOTE'
  result: 'CORRECT' | 'WRONG' | 'SKIP'
  selected_option_id: number | null
  correct_answer: string
  explanation: string
  submitted_at: string
}

export function useAdminQuery<T>(path: string | null) {
  const { actorId, generation } = useSession()
  return useQuery({
    queryKey: ['admin', actorId, generation, path],
    queryFn: ({ signal }) => api<T>(path!, { actorId: actorId ?? undefined, signal }),
    enabled: actorId !== null && path !== null,
  })
}

export async function adminPages<T>(
  path: string,
  actorId: number,
  signal?: AbortSignal,
): Promise<T[]> {
  const items: T[] = []
  for (let page = 1; ; page++) {
    const result = await api<ApiPage<T>>(
      `${path}${path.includes('?') ? '&' : '?'}page=${page}&size=100`,
      { actorId, signal },
    )
    items.push(...result.items)
    if (!result.has_next) return items
  }
}

export function useAdminPages<T>(path: string, enabled = true) {
  const { actorId, generation } = useSession()
  return useQuery({
    queryKey: ['admin', actorId, generation, 'all-pages', path],
    queryFn: ({ signal }) => adminPages<T>(path, actorId!, signal),
    enabled: actorId !== null && enabled,
  })
}

export function adminError(error: unknown): string {
  return error instanceof Error ? error.message : '요청을 처리하지 못했어요. 다시 시도해 주세요.'
}
