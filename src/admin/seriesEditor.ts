import type { AdminContent, CurriculumDetail } from '../api/admin'
import { editVersion } from './editVersion.ts'
import type { ApiOptions } from '../api/client'
import { thumbnailFileError } from './thumbnail.ts'

export interface SeriesFields {
  name: string
  description: string
  order: number[]
}
export interface SeriesSession {
  fields: SeriesFields
  savedId: number | null
  updatedAt: string | null
  savedInfo: string
  savedOrder: string
  pendingSteps: boolean
  thumbnailFile: File | null
}
export const seriesInfo = (fields: SeriesFields) =>
  JSON.stringify({ title: fields.name.trim(), description: fields.description.trim() || null })
export function initialSeries(initial?: CurriculumDetail): SeriesSession {
  const fields = {
    name: initial?.summary.title ?? '',
    description: initial?.summary.description ?? '',
    order: initial?.steps.map((step) => step.content_id) ?? [],
  }
  return {
    fields,
    savedId: initial?.summary.curriculum_id ?? null,
    updatedAt: initial?.summary.updated_at ?? null,
    savedInfo: seriesInfo(fields),
    savedOrder: JSON.stringify(fields.order),
    pendingSteps: false,
    thumbnailFile: null,
  }
}
export const seriesDirty = (session: SeriesSession) =>
  seriesInfo(session.fields) !== session.savedInfo ||
  JSON.stringify(session.fields.order) !== session.savedOrder ||
  session.pendingSteps ||
  session.thumbnailFile !== null
export function seriesNameError(value: string) {
  if (!value.trim()) return '시리즈명을 입력해 주세요.'
  if ([...value.trim()].length > 100) return '시리즈명은 100자 이하로 입력해 주세요.'
  return null
}
export function moveSeriesStep(order: number[], source: number, target: number) {
  const from = order.indexOf(source),
    to = order.indexOf(target)
  if (from < 0 || to < 0 || from === to) return order
  const next = [...order]
  next.splice(from, 1)
  next.splice(to, 0, source)
  return next
}
export function addSeriesStep(order: number[], id: number) {
  return order.includes(id) ? order : [...order, id]
}
export function stepWarnings(content?: AdminContent | null, available?: boolean) {
  if (!content) return ['콘텐츠 확인 필요']
  const warnings: string[] = []
  if (content.status === 'PRIVATE') warnings.push('비공개 · 학습자 조회·진도에서 제외')
  else if (content.status !== 'PUBLISHED') warnings.push('임시저장 · 학습자에게 비공개')
  else if (!content.video_url || available === false) warnings.push('영상 확인 필요 · 시청 불가')
  if (!content.has_quiz) warnings.push('퀴즈 없음 · 완료 불가')
  return warnings
}
export async function saveSeries(
  session: SeriesSession,
  actorId: number,
  request: (path: string, options: ApiOptions) => Promise<unknown>,
  onProgress: (session: SeriesSession) => void,
) {
  const error = seriesNameError(session.fields.name)
  if (error) throw new Error(error)
  if (new Set(session.fields.order).size !== session.fields.order.length)
    throw new Error('같은 콘텐츠는 한 번만 추가할 수 있어요.')
  if (session.thumbnailFile) {
    const problem = thumbnailFileError(session.thumbnailFile)
    if (problem) throw new Error(problem)
  }
  let next = session
  const info = seriesInfo(session.fields)
  if (next.savedId === null) {
    const created = (await request('/curriculums', {
      method: 'POST',
      actorId,
      body: JSON.parse(info),
    })) as CurriculumDetail
    next = {
      ...next,
      savedId: created.summary.curriculum_id,
      updatedAt: created.summary.updated_at,
      savedInfo: info,
      pendingSteps: true,
    }
    onProgress(next)
  } else if (next.savedInfo !== info) {
    const updated = (await request(`/curriculums/${next.savedId}`, {
      method: 'PATCH',
      actorId,
      body: { ...JSON.parse(info), expected_updated_at: editVersion(next.updatedAt) },
    })) as { updated_at: string }
    next = { ...next, savedInfo: info, updatedAt: updated.updated_at }
    onProgress(next)
  }
  const order = JSON.stringify(next.fields.order)
  if (next.pendingSteps || next.savedOrder !== order) {
    const updated = (await request(`/curriculums/${next.savedId}/steps`, {
      method: 'PUT',
      actorId,
      body: { content_ids: next.fields.order, expected_updated_at: editVersion(next.updatedAt) },
    })) as { updated_at: string }
    next = { ...next, savedOrder: order, pendingSteps: false, updatedAt: updated.updated_at }
    onProgress(next)
  }
  if (next.thumbnailFile) {
    const body = new FormData()
    body.append('file', next.thumbnailFile)
    await request(`/curriculums/${next.savedId}/thumbnail`, { method: 'PUT', actorId, body })
    next = { ...next, thumbnailFile: null }
    onProgress(next)
  }
  return next
}
