import { ApiError } from '../api/client.ts'
import type { EditableContent } from '../api/admin.ts'

export interface UploadRecovery {
  contentId: number
  previousRevision: string | null
  reason: 'interrupted' | 'timeout' | 'unknown'
}

export class UploadNeedsReviewError extends Error {
  constructor(cause: unknown) {
    super('영상 요청이 중단돼 저장 결과를 확인해야 해요. 콘텐츠 정보와 선택한 파일은 유지돼요.', {
      cause,
    })
    this.name = 'UploadNeedsReviewError'
  }
}

export function uploadNeedsReview(error: unknown) {
  // 추출 실패 응답은 서버가 새 영상 연결을 취소한 결과이므로 중단 확인창을 띄우지 않는다.
  if (error instanceof ApiError && error.code === 'THUMBNAIL_GENERATION_FAILED') return false
  return (
    (error instanceof Error && error.name === 'AbortError') ||
    (error instanceof ApiError &&
      (error.status === 0 ||
        error.status >= 500 ||
        ['INVALID_RESPONSE', 'VIDEO_CHANGED', 'VIDEO_ALREADY_EXISTS'].includes(error.code)))
  )
}

export function compareUploadedVideo(recovery: UploadRecovery, latest: EditableContent) {
  if (latest.detail.content.content_id !== recovery.contentId)
    throw new Error('다른 콘텐츠의 영상 정보가 반환됐어요.')
  return latest.detail.content.media_revision !== recovery.previousRevision
    ? 'changed'
    : 'unchanged'
}

const memory = new Map<string, UploadRecovery>()
export function uploadRecoveryKey(
  actorId: number | null,
  generation: number | null,
  contentId: number,
) {
  return `sasu:upload-check:${actorId}:${generation}:${contentId}`
}
export function rememberUpload(key: string, recovery: UploadRecovery | null) {
  if (recovery) memory.set(key, recovery)
  else memory.delete(key)
  try {
    if (recovery) sessionStorage.setItem(key, JSON.stringify(recovery))
    else sessionStorage.removeItem(key)
  } catch {
    /* 저장소가 제한된 경우 현재 탭의 메모리 상태를 유지한다. */
  }
}
export function readUploadRecovery(key: string): UploadRecovery | null {
  try {
    const raw = sessionStorage.getItem(key)
    if (raw) {
      const value: unknown = JSON.parse(raw)
      if (value && typeof value === 'object') {
        const recovery = value as UploadRecovery
        if (
          Number.isSafeInteger(recovery.contentId) &&
          recovery.contentId > 0 &&
          (recovery.previousRevision === null || typeof recovery.previousRevision === 'string') &&
          ['interrupted', 'timeout', 'unknown'].includes(recovery.reason)
        )
          return recovery
      }
    }
  } catch {
    /* 저장소가 제한된 경우 현재 탭의 메모리 상태를 사용한다. */
  }
  return memory.get(key) ?? null
}
