import { ApiError, GENERATION_MISMATCH_EVENT } from '../api/client.ts'
import type { UploadedVideo } from '../api/admin.ts'

export interface VideoUploadProgress {
  phase: 'uploading' | 'processing'
  loaded: number
  total: number | null
  percent: number | null
}

export function uploadVideo({
  contentId,
  actorId,
  file,
  expectedMediaRevision,
  onProgress,
}: {
  contentId: number
  actorId: number
  file: File
  expectedMediaRevision?: string | null
  onProgress: (progress: VideoUploadProgress) => void
}): Promise<UploadedVideo> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    const body = new FormData()
    body.append('file', file)
    if (expectedMediaRevision) body.append('expected_media_revision', expectedMediaRevision)
    let progress: VideoUploadProgress = {
      phase: 'uploading',
      loaded: 0,
      total: null,
      percent: null,
    }
    let settled = false
    const fail = (error: unknown) => {
      if (settled) return
      settled = true
      reject(error)
    }
    request.open('PUT', `/api/contents/${contentId}/video`)
    request.setRequestHeader('Accept', 'application/json')
    request.setRequestHeader('X-Actor-Id', String(actorId))
    // multipart 경계는 브라우저가 설정하며, upload 완료와 응답 완료는 구분한다.
    request.upload.onprogress = (event) => {
      if (settled || progress.phase === 'processing') return
      const total = event.lengthComputable && event.total > 0 ? event.total : null
      const loaded = Math.max(0, total === null ? event.loaded : Math.min(event.loaded, total))
      progress = {
        phase: 'uploading',
        loaded,
        total,
        percent: total === null ? null : Math.min(99, Math.floor((loaded / total) * 100)),
      }
      onProgress(progress)
    }
    request.upload.onload = () => {
      if (settled) return
      progress = {
        ...progress,
        phase: 'processing',
        loaded: progress.total ?? progress.loaded,
        percent: 100,
      }
      onProgress(progress)
    }
    request.onload = () => {
      if (settled) return
      let data: unknown
      try {
        data = request.responseText ? JSON.parse(request.responseText) : undefined
      } catch {
        fail(new ApiError(request.status, 'INVALID_RESPONSE', '서버 응답을 읽지 못했습니다.'))
        return
      }
      if (request.status < 200 || request.status >= 300) {
        const detail = (
          data as { detail?: { code?: string; message?: string; fields?: unknown } } | undefined
        )?.detail
        const code = detail?.code ?? `HTTP_${request.status}`
        if (code === 'RECORD_GENERATION_MISMATCH' && typeof window !== 'undefined')
          window.dispatchEvent(new CustomEvent(GENERATION_MISMATCH_EVENT))
        fail(
          new ApiError(
            request.status,
            code,
            detail?.message ?? '영상 업로드에 실패했습니다. 다시 시도해 주세요.',
            detail?.fields,
          ),
        )
        return
      }
      if (!data || typeof data !== 'object' || !('content_id' in data)) {
        fail(
          new ApiError(request.status, 'INVALID_RESPONSE', '영상 저장 결과를 확인하지 못했습니다.'),
        )
        return
      }
      settled = true
      resolve(data as UploadedVideo)
    }
    request.onerror = () =>
      fail(
        new ApiError(0, 'NETWORK_ERROR', '서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.'),
      )
    request.ontimeout = () =>
      fail(new ApiError(0, 'UPLOAD_TIMEOUT', '영상 업로드 응답 시간이 초과되었습니다.'))
    request.onabort = () => fail(new DOMException('영상 업로드가 취소되었습니다.', 'AbortError'))
    onProgress(progress)
    request.send(body)
  })
}
