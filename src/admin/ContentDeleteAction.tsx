import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { EditableContent } from '../api/admin'
import { invalidateContentDeletion } from '../api/queryInvalidation'
import { useSession } from '../state/session'
import { Button, ConfirmDialog } from './ui'
import { RequestError } from './RequestFeedback'
import { EditConflictNotice } from './EditConflictNotice'
import { isEditConflict } from './editVersion'
import { contentDeleteMutationOptions, deleteContent, type ContentDeleted } from './contentDelete'
import './content-delete.css'

export function ContentDeleteAction({
  content,
  disabled,
  dirty,
  onDeleted,
  onBusyChange,
  onReload,
}: {
  content: EditableContent
  disabled: boolean
  dirty: boolean
  onDeleted: (result: ContentDeleted) => void
  onBusyChange: (busy: boolean) => void
  onReload: () => Promise<void>
}) {
  const { actorId } = useSession()
  const cache = useQueryClient()
  const [confirm, setConfirm] = useState(false)
  const guard = useRef(false)
  const mutation = useMutation({
    ...contentDeleteMutationOptions,
    mutationFn: () => {
      if (actorId === null) throw new Error('관리자 사용자를 선택해 주세요.')
      return deleteContent({ content, actorId })
    },
    onSuccess: async (result) => {
      setConfirm(false)
      onDeleted(result)
      await invalidateContentDeletion(cache, { contentId: content.detail.content.content_id })
    },
    onError: () => setConfirm(false),
    onSettled: () => {
      guard.current = false
    },
  })
  useEffect(() => {
    onBusyChange(mutation.isPending)
  }, [mutation.isPending, onBusyChange])
  const blocked =
    disabled || dirty || actorId === null || mutation.isPending || isEditConflict(mutation.error)
  return (
    <section className="admin-content-delete" aria-label="콘텐츠 영구 삭제">
      <Button
        variant="danger"
        disabled={blocked}
        onClick={() => {
          if (blocked) return
          mutation.reset()
          setConfirm(true)
        }}
      >
        콘텐츠 영구 삭제
      </Button>
      <p className="admin-help">
        {dirty
          ? '변경한 내용을 먼저 저장한 뒤 삭제해 주세요.'
          : '콘텐츠를 영구 삭제하면 모든 학습자의 관련 학습 기록·좋아요·저장도 함께 지워요.'}
      </p>
      {isEditConflict(mutation.error) ? (
        <EditConflictNotice
          onReload={async () => {
            await onReload()
            mutation.reset()
            setConfirm(false)
          }}
        />
      ) : mutation.error ? (
        <RequestError title="콘텐츠 삭제 실패" error={mutation.error} />
      ) : null}
      <ConfirmDialog
        open={confirm}
        title="콘텐츠를 영구 삭제할까요?"
        confirmLabel="영구 삭제"
        danger
        busy={mutation.isPending}
        onCancel={() => {
          setConfirm(false)
          mutation.reset()
        }}
        onConfirm={() => {
          if (!confirm || blocked || guard.current) return
          guard.current = true
          mutation.mutate()
        }}
      >
        <p>
          <strong>{content.detail.content.title || '제목 없는 콘텐츠'}</strong>
        </p>
        <p>
          영상·썸네일, 퀴즈·해설, 모든 학습자의 관련 학습 기록·좋아요·저장이 삭제되고 시리즈에서
          제외돼요. 삭제한 내용은 복구할 수 없어요.
        </p>
      </ConfirmDialog>
    </section>
  )
}
