import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { EditableContent } from '../api/admin'
import { invalidateContentLifecycle } from '../api/queryInvalidation'
import { useSession } from '../state/session'
import { Button, ConfirmDialog } from './ui'
import { RequestError } from './RequestFeedback'
import { EditConflictNotice } from './EditConflictNotice'
import { isEditConflict } from './editVersion'
import {
  contentLifecycleMutationOptions,
  requestContentLifecycle,
  type LifecycleAction,
  type ContentDeleted,
} from './contentLifecycle'
import './content-lifecycle.css'

export function ContentLifecycleActions({
  content,
  disabled,
  dirty,
  onUpdated,
  onDeleted,
  onBusyChange,
  onReload,
}: {
  content: EditableContent
  disabled: boolean
  dirty: boolean
  onUpdated: (content: EditableContent) => void
  onDeleted: (result: ContentDeleted) => void
  onBusyChange: (busy: boolean) => void
  onReload: () => Promise<void>
}) {
  const { actorId } = useSession()
  const cache = useQueryClient()
  const [confirm, setConfirm] = useState<LifecycleAction | null>(null)
  const guard = useRef(false)
  const mutation = useMutation({
    ...contentLifecycleMutationOptions,
    mutationFn: (action: LifecycleAction) => {
      if (actorId === null) throw new Error('관리자 사용자를 선택해 주세요.')
      return requestContentLifecycle({ action, content, actorId })
    },
    onSuccess: async (outcome) => {
      setConfirm(null)
      if (outcome.action === 'delete') onDeleted(outcome.result)
      else onUpdated(outcome.result)
      await invalidateContentLifecycle(cache, {
        contentId: content.detail.content.content_id,
        deleted: outcome.action === 'delete',
      })
    },
    onError: () => {
      setConfirm(null)
    },
    onSettled: () => {
      guard.current = false
    },
  })
  useEffect(() => {
    onBusyChange(mutation.isPending)
  }, [mutation.isPending, onBusyChange])
  const status = content.detail.content.status
  const blocked =
    disabled || dirty || actorId === null || mutation.isPending || isEditConflict(mutation.error)
  const select = (action: LifecycleAction) => {
    if (blocked) return
    mutation.reset()
    setConfirm(action)
  }
  const execute = () => {
    if (!confirm || blocked || guard.current) return
    guard.current = true
    mutation.mutate(confirm)
  }
  return (
    <section className="admin-content-lifecycle" aria-label="콘텐츠 공개 상태와 영구 삭제">
      <div className="admin-content-lifecycle__actions">
        {status === 'PUBLISHED' && (
          <Button disabled={blocked} onClick={() => select('private')}>
            비공개로 전환
          </Button>
        )}
        {status === 'PRIVATE' && (
          <Button disabled={blocked} onClick={() => select('publish')}>
            다시 공개
          </Button>
        )}
        <Button variant="danger" disabled={blocked} onClick={() => select('delete')}>
          콘텐츠 영구 삭제
        </Button>
      </div>
      <p className="admin-help">
        {dirty
          ? '변경한 내용을 먼저 저장한 뒤 상태를 변경하거나 삭제해 주세요.'
          : status === 'PRIVATE'
            ? '비공개 상태예요. 학습 기록은 보존되며 다시 공개하면 학습 현황에 반영돼요.'
            : '비공개 전환은 학습 기록을 보존하고, 영구 삭제는 관련 기록도 함께 지워요.'}
      </p>
      {isEditConflict(mutation.error) ? (
        <EditConflictNotice
          onReload={async () => {
            await onReload()
            mutation.reset()
            setConfirm(null)
          }}
        />
      ) : mutation.error ? (
        <RequestError title="콘텐츠 상태 변경·삭제 실패" error={mutation.error} />
      ) : null}
      <ConfirmDialog
        open={confirm !== null}
        title={
          confirm === 'delete'
            ? '콘텐츠를 영구 삭제할까요?'
            : confirm === 'private'
              ? '비공개로 전환할까요?'
              : '콘텐츠를 다시 공개할까요?'
        }
        confirmLabel={
          confirm === 'delete' ? '영구 삭제' : confirm === 'private' ? '비공개로 전환' : '다시 공개'
        }
        danger={confirm === 'delete'}
        busy={mutation.isPending}
        onCancel={() => {
          setConfirm(null)
          mutation.reset()
        }}
        onConfirm={execute}
      >
        <p>
          <strong>{content.detail.content.title || '제목 없는 콘텐츠'}</strong>
        </p>
        <p>
          {confirm === 'delete'
            ? '영상·썸네일, 퀴즈·해설, 모든 학습자의 관련 학습 기록·좋아요·저장이 삭제되고 시리즈에서 제외돼요. 삭제한 내용은 복구할 수 없어요.'
            : confirm === 'private'
              ? '학습자에게 표시되지 않고 학습 현황·진도에서도 제외돼요. 기존 기록은 보존되며 다시 공개하면 반영돼요.'
              : '학습자가 다시 이용할 수 있고 보존된 학습 기록이 학습 현황에 반영돼요.'}
        </p>
      </ConfirmDialog>
    </section>
  )
}
