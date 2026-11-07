import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AdminContent } from '../api/admin'
import { invalidateContentDeletion } from '../api/queryInvalidation'
import { useSession } from '../state/session'
import { Button, ConfirmDialog } from './ui'
import { RequestError } from './RequestFeedback'
import { contentDeleteMutationOptions, deleteContent, type ContentDeleted } from './contentDelete'

export function ContentDeleteAction({
  content,
  onDeleted,
}: {
  content: AdminContent
  onDeleted: (result: ContentDeleted) => void
}) {
  const { actorId } = useSession()
  const cache = useQueryClient()
  const [confirm, setConfirm] = useState(false)
  const mutation = useMutation({
    ...contentDeleteMutationOptions,
    mutationFn: () => {
      if (actorId === null) throw new Error('관리자 사용자를 선택해 주세요.')
      return deleteContent({ contentId: content.content_id, actorId })
    },
    onSuccess: async (result) => {
      setConfirm(false)
      onDeleted(result)
      await invalidateContentDeletion(cache, { contentId: content.content_id })
    },
    onError: () => setConfirm(false),
  })
  return (
    <>
      <Button
        size="sm"
        variant="danger"
        disabled={actorId === null || mutation.isPending}
        onClick={() => {
          mutation.reset()
          setConfirm(true)
        }}
      >
        삭제
      </Button>
      {mutation.error && <RequestError title="콘텐츠 삭제 실패" error={mutation.error} />}
      <ConfirmDialog
        open={confirm}
        title="콘텐츠를 영구 삭제할까요?"
        confirmLabel="삭제"
        danger
        busy={mutation.isPending}
        onCancel={() => {
          setConfirm(false)
          mutation.reset()
        }}
        onConfirm={() => {
          if (!confirm || actorId === null || mutation.isPending) return
          mutation.mutate()
        }}
      >
        <p>
          <strong>{content.title || '제목 없는 콘텐츠'}</strong>
        </p>
        <p>
          영상·썸네일, 퀴즈·해설, 모든 학습자의 관련 학습 기록·좋아요·저장이 삭제되고 시리즈에서
          제외돼요. 삭제한 내용은 복구할 수 없어요.
        </p>
      </ConfirmDialog>
    </>
  )
}
