import type { EditableContent } from '../api/admin.ts'
import { api } from '../api/client.ts'

export interface ContentDeleted {
  content_id: number
  file_cleanup_pending: boolean
}
export type LifecycleAction = 'private' | 'publish' | 'delete'
// 관리자 파괴적 작업을 오프라인 대기열에 두고 연결 복구 후 자동 실행하지 않는다.
export const contentLifecycleMutationOptions = {
  networkMode: 'always',
  retry: false,
} as const
export async function requestContentLifecycle({
  action,
  content,
  actorId,
}: {
  action: LifecycleAction
  content: EditableContent
  actorId: number
}) {
  const path = `/contents/${content.detail.content.content_id}`
  const body = { expected_updated_at: content.updated_at }
  if (action === 'delete') {
    const result = await api<ContentDeleted>(path, {
      actorId,
      method: 'DELETE',
      body: { ...body, confirm: true },
    })
    return { action, result } as const
  }
  const result = await api<EditableContent>(
    `${path}/${action === 'private' ? 'unpublish' : 'publish'}`,
    {
      actorId,
      method: 'POST',
      body,
    },
  )
  return { action, result } as const
}
export function contentDeletedMessage(pending: boolean) {
  return pending
    ? '콘텐츠는 삭제했지만 일부 첨부 파일 정리가 완료되지 않았어요. 서버 로그를 확인해 주세요.'
    : '콘텐츠와 관련 학습 기록을 영구 삭제했어요.'
}
