import { Notification } from '../shared/Notification'
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Button } from './ui'
import { RequestError } from './RequestFeedback'

export function EditConflictNotice({ onReload }: { onReload: () => Promise<void> }) {
  const [confirm, setConfirm] = useState(false)
  const reload = useMutation({ mutationFn: onReload })
  return (
    <>
      <Notification
        kind="snackbar"
        title="저장된 내용이 변경됐어요."
        message="현재 입력은 유지했어요. 최신 내용을 다시 불러온 뒤 수정해 주세요."
        action={
          confirm ? (
            <>
              <p>저장하지 않은 변경을 버리고 최신 내용으로 바꿀까요?</p>
              <div className="admin-row">
                <Button disabled={reload.isPending} onClick={() => setConfirm(false)}>
                  취소
                </Button>
                <Button
                  loading={reload.isPending}
                  disabled={reload.isPending}
                  onClick={() => reload.mutate()}
                >
                  최신 내용으로 다시 편집
                </Button>
              </div>
            </>
          ) : (
            <Button onClick={() => setConfirm(true)}>최신 내용 불러오기</Button>
          )
        }
      />
      {reload.error && <RequestError title="최신 내용을 불러오지 못했어요." error={reload.error} />}
    </>
  )
}
