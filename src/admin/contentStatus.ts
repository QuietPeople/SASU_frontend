export type ContentStatus = 'DRAFT' | 'PUBLISHED' | 'PRIVATE'
export type ContentStatusFilter = ContentStatus | 'ALL'
export const contentStatusOptions: { id: ContentStatusFilter; label: string }[] = [
  { id: 'ALL', label: '전체' },
  { id: 'PUBLISHED', label: '공개' },
  { id: 'PRIVATE', label: '비공개' },
  { id: 'DRAFT', label: '임시저장' },
]
export function contentStatusLabel(status: ContentStatus) {
  return { DRAFT: '임시저장', PUBLISHED: '공개', PRIVATE: '비공개' }[status]
}
export function contentStatusTone(status?: ContentStatus): 'green' | 'amber' | 'neutral' {
  return status === 'PUBLISHED' ? 'green' : status === 'PRIVATE' ? 'amber' : 'neutral'
}
