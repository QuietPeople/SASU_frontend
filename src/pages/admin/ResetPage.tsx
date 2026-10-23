import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import { adminError } from '../../api/admin'
import { useSession } from '../../state/session'
import { Button, ConfirmDialog } from '../../shared/ui'
import { useToast } from '../../shared/useToast'

export function ResetPage() {
  const { actorId, learnerId, generation, refreshSettings, users, settings } = useSession()
  const learnerName = users.find((user) => user.user_id === learnerId)?.name ?? '현재 학습자'
  const cache = useQueryClient()
  const { show, node } = useToast()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [expected, setExpected] = useState<number | null>(null)
  const run = async () => {
    if (busy || actorId === null || learnerId === null || expected === null) return
    setBusy(true)
    try {
      const result = await api<{ record_generation: number }>(
        `/users/${learnerId}/test-records/reset`,
        {
          method: 'POST',
          actorId,
          body: { confirm: true, expected_record_generation: expected },
        },
      )
      if (settings)
        cache.setQueryData(['session', 'settings', learnerId], {
          ...settings,
          record_generation: result.record_generation,
        })
      setOpen(false)
      await refreshSettings().catch(() => undefined)
      await cache.invalidateQueries()
      show('테스트 기록을 초기화했어요.')
    } catch (error) {
      setOpen(false)
      show(adminError(error), 'error')
      await refreshSettings().catch(() => undefined)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="sasu-page sasu-reset">
      <header className="sasu-page__head">
        <p className="sasu-eyebrow">관리자 · 테스트 초기화</p>
        <h1 className="sasu-title">테스트 기록 초기화</h1>
      </header>
      <section className="sasu-card">
        <h2 className="sasu-card__title">{learnerName}의 삭제할 기록</h2>
        <p>시청 · 응답 · 오답 · 복습 · 시리즈 진행 · 좋아요 · 저장 목록</p>
      </section>
      <section className="sasu-card">
        <h2 className="sasu-card__title">유지할 자료</h2>
        <p>관리자가 등록한 영상 · 퀴즈 · 시리즈 자료 · 관심 분야와 복습 설정</p>
      </section>
      <Button
        variant="danger"
        disabled={busy || actorId === null || learnerId === null || generation === null}
        onClick={() => {
          setExpected(generation)
          setOpen(true)
        }}
      >
        기록 초기화
      </Button>
      <ConfirmDialog
        open={open}
        title={`${learnerName}의 테스트 기록을 초기화할까요?`}
        confirmLabel="기록 초기화"
        danger
        busy={busy}
        onCancel={() => !busy && setOpen(false)}
        onConfirm={() => void run()}
      >
        <p>삭제: 시청·응답·오답·복습·시리즈 진행·좋아요·저장</p>
        <p>유지: 영상·퀴즈·시리즈·사용자 설정</p>
        <p className="sasu-muted">초기화 후 되돌릴 수 없어요.</p>
      </ConfirmDialog>
      {node}
    </div>
  )
}
