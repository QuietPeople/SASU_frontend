import { useEffect, useRef, useState } from 'react'
import { api, ApiError } from '../api/client'
import type { EditableContent } from '../api/admin'
import { uploadVideo, type VideoUploadProgress } from './uploadVideo'
import {
  compareUploadedVideo,
  readUploadRecovery,
  rememberUpload,
  uploadNeedsReview,
  uploadRecoveryKey,
  UploadNeedsReviewError,
  type UploadRecovery,
} from './uploadRecovery'

type UploadCheck =
  | { status: 'checking' | 'unavailable' }
  | { status: 'changed' | 'unchanged'; content: EditableContent }

export function useVideoUpload({
  actorId,
  generation,
  contentId,
}: {
  actorId: number | null
  generation: number | null
  contentId?: number
}) {
  const mounted = useRef(true)
  const active = useRef<AbortController | null>(null)
  const lookup = useRef<AbortController | null>(null)
  const [progress, setProgress] = useState<VideoUploadProgress | null>(null)
  const [recovery, setRecovery] = useState<UploadRecovery | null>(() =>
    contentId === undefined
      ? null
      : readUploadRecovery(uploadRecoveryKey(actorId, generation, contentId)),
  )
  const [check, setCheck] = useState<UploadCheck | null>(null)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      active.current?.abort()
      lookup.current?.abort()
    }
  }, [])

  async function recheck(target = recovery) {
    if (!target || actorId === null) return
    lookup.current?.abort()
    const controller = new AbortController()
    lookup.current = controller
    const timer = setTimeout(() => controller.abort(), 15000)
    if (mounted.current) setCheck({ status: 'checking' })
    try {
      const content = await api<EditableContent>(`/contents/${target.contentId}?view=editor`, {
        actorId,
        signal: controller.signal,
      })
      const status = compareUploadedVideo(target, content)
      if (mounted.current && lookup.current === controller) setCheck({ status, content })
    } catch {
      if (mounted.current && lookup.current === controller) setCheck({ status: 'unavailable' })
    } finally {
      clearTimeout(timer)
      if (lookup.current === controller) lookup.current = null
    }
  }

  function dismissRecovery() {
    if (recovery) rememberUpload(uploadRecoveryKey(actorId, generation, recovery.contentId), null)
    setRecovery(null)
    setCheck(null)
  }

  async function upload(options: {
    contentId: number
    file: File
    expectedMediaRevision?: string | null
    generateThumbnail?: boolean
  }) {
    if (!mounted.current) throw new DOMException('화면을 벗어나 요청을 중단했습니다.', 'AbortError')
    if (actorId === null || active.current) throw new Error('영상 업로드를 시작할 수 없어요.')
    const controller = new AbortController()
    active.current = controller
    const pending: UploadRecovery = {
      contentId: options.contentId,
      previousRevision: options.expectedMediaRevision ?? null,
      reason: 'unknown',
    }
    const key = uploadRecoveryKey(actorId, generation, options.contentId)
    // 화면 이탈·새로고침 뒤에도 중단된 요청을 성공 또는 실패로 단정하지 않는다.
    rememberUpload(key, pending)
    setCheck(null)
    try {
      const result = await uploadVideo({
        ...options,
        actorId,
        signal: controller.signal,
        onProgress: (next) => {
          if (mounted.current) setProgress(next)
        },
      })
      rememberUpload(key, null)
      if (mounted.current) setRecovery(null)
      return result
    } catch (cause) {
      if (!uploadNeedsReview(cause)) {
        rememberUpload(key, null)
        throw cause
      }
      const interrupted: UploadRecovery = {
        ...pending,
        reason:
          cause instanceof Error && cause.name === 'AbortError'
            ? 'interrupted'
            : cause instanceof ApiError && cause.code === 'UPLOAD_TIMEOUT'
              ? 'timeout'
              : 'unknown',
      }
      rememberUpload(key, interrupted)
      if (mounted.current) {
        setRecovery(interrupted)
        await recheck(interrupted)
      }
      throw new UploadNeedsReviewError(cause)
    } finally {
      if (active.current === controller) active.current = null
      if (mounted.current) setProgress(null)
    }
  }

  return {
    progress,
    recovery,
    check,
    upload,
    recheck,
    dismissRecovery,
    cancel: () => active.current?.abort(),
  }
}
