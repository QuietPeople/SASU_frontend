import type { EditableContent } from '../api/admin.ts'
import { api } from '../api/client.ts'

export interface ContentDeleted {
  content_id: number
  file_cleanup_pending: boolean
}
// 영구 삭제는 오프라인 대기나 자동 재시도 없이 사용자가 다시 확인하여 실행한다.
export const contentDeleteMutationOptions = { networkMode: 'always', retry: false } as const

export async function deleteContent({
  contentId,
  actorId,
}: {
  contentId: number
  actorId: number
}) {
  const content = await api<EditableContent>(`/contents/${contentId}?view=editor`, { actorId })
  return api<ContentDeleted>(`/contents/${contentId}`, {
    actorId,
    method: 'DELETE',
    body: { expected_updated_at: content.updated_at, confirm: true },
  })
}

export function contentDeletedMessage(pending: boolean) {
  return pending
    ? '콘텐츠는 삭제했지만 일부 첨부 파일 정리가 완료되지 않았어요. 서버 로그를 확인해 주세요.'
    : '콘텐츠와 관련 학습 기록을 영구 삭제했어요.'
}
