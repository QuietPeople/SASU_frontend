import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import { useSession } from '../../state/session'
import { RequestError } from '../../admin/RequestFeedback'
import { Button } from '../../admin/ui'
import { Icon } from '../../admin/Icon'
import { useToast } from '../../admin/useToast'
import '../../admin/reset.css'

type ResetTarget = { userId: number; name: string; generation: number; actorId: number }
type ResetResult = {
  user_id: number
  record_generation: number
  deleted_counts: {
    watch_records: number
    responses: number
    likes: number
    saved_contents: number
  }
}

function ResetConfirmation({
  target,
  valid,
  busy,
  onCancel,
  onConfirm,
}: {
  target: ResetTarget
  valid: boolean
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const cancel = useRef<HTMLButtonElement>(null)
  const [acknowledged, setAcknowledged] = useState(false)
  useEffect(() => {
    const element = dialog.current!
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    element.showModal()
    cancel.current?.focus()
    return () => {
      element.close()
      document.body.style.overflow = overflow
      previous?.focus()
    }
  }, [])
  return (
    <dialog
      ref={dialog}
      className="admin-reset-confirm"
      aria-labelledby="reset-confirm-title"
      aria-describedby="reset-confirm-description"
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) onCancel()
      }}
    >
      <div className="admin-reset-confirm__body">
        <p className="admin-reset__eyebrow">실행 전 최종 확인</p>
        <h2 id="reset-confirm-title">학습 기록을 초기화할까요?</h2>
        <p id="reset-confirm-description">
          <strong>{target.name}</strong> 님의 학습 기록이 삭제됩니다.
          <br />
          초기화한 기록은 이 화면에서 복구할 수 없습니다.
        </p>
        <div className="admin-reset-confirm__target">
          <span>초기화 대상</span>
          <strong>{target.name}</strong>
          <small>사용자 ID {target.userId}</small>
        </div>
        <dl className="admin-reset-confirm__scope">
          <div>
            <dt>삭제</dt>
            <dd>시청·퀴즈 풀이·오답·복습 기록, 좋아요, 저장 목록</dd>
          </div>
          <div>
            <dt>함께 변경</dt>
            <dd>시리즈 진행률과 해당 학습자의 기록이 반영된 통계</dd>
          </div>
          <div>
            <dt>유지</dt>
            <dd>사용자 계정·설정, 콘텐츠·영상·퀴즈·시리즈 자료, 다른 학습자의 기록</dd>
          </div>
        </dl>
        {!valid && (
          <p className="admin-reset-confirm__changed" role="alert">
            대상 또는 학습 기록 상태가 변경됐습니다. 취소한 뒤 다시 확인해 주세요.
          </p>
        )}
        <label className="admin-reset-confirm__ack">
          <input
            type="checkbox"
            checked={acknowledged}
            disabled={busy || !valid}
            onChange={(event) => setAcknowledged(event.target.checked)}
          />
          <span>초기화 대상과 삭제 범위를 확인했으며, 되돌릴 수 없음을 이해했습니다.</span>
        </label>
      </div>
      <footer>
        <button ref={cancel} type="button" className="admin-btn" disabled={busy} onClick={onCancel}>
          취소
        </button>
        <Button
          variant="danger"
          loading={busy}
          disabled={!acknowledged || !valid}
          onClick={onConfirm}
        >
          {busy ? '초기화 중…' : '학습 기록 삭제 및 초기화'}
        </Button>
      </footer>
    </dialog>
  )
}

export function ResetPage() {
  const { actorId, learnerId, generation, refreshSettings, users, settings, isPending } =
    useSession()
  const learnerName = users.find((user) => user.user_id === learnerId)?.name ?? '현재 학습자'
  const cache = useQueryClient()
  const { show, node } = useToast()
  const [requestError, setRequestError] = useState<unknown>(null)
  const [target, setTarget] = useState<ResetTarget | null>(null)
  const [busy, setBusy] = useState(false)
  const running = useRef(false)
  const [completed, setCompleted] = useState<{ name: string; result: ResetResult } | null>(null)
  const ready = !isPending && actorId !== null && learnerId !== null && generation !== null
  const valid =
    target !== null &&
    target.userId === learnerId &&
    target.actorId === actorId &&
    target.generation === generation
  const run = async () => {
    if (running.current || !target || !valid) return
    running.current = true
    setBusy(true)
    setRequestError(null)
    setCompleted(null)
    try {
      const result = await api<ResetResult>(`/users/${target.userId}/test-records/reset`, {
        method: 'POST',
        actorId: target.actorId,
        body: { confirm: true, expected_record_generation: target.generation },
      })
      if (settings?.user_id === target.userId)
        cache.setQueryData(['session', 'settings', target.userId], {
          ...settings,
          record_generation: result.record_generation,
        })
      setCompleted({ name: target.name, result })
      setTarget(null)
      show('테스트 기록을 초기화했어요.')
      await Promise.allSettled([refreshSettings(), cache.invalidateQueries()])
    } catch (error) {
      setTarget(null)
      setRequestError(error)
      await refreshSettings().catch(() => undefined)
    } finally {
      running.current = false
      setBusy(false)
    }
  }
  return (
    <div className="admin-page admin-reset">
      <header className="admin-page__head">
        <p className="admin-eyebrow">관리자 · 테스트 초기화</p>
        <h1 className="admin-title">학습 기록 초기화</h1>
        <p className="admin-sub">
          테스트를 처음부터 다시 진행할 때 사용하는 기능입니다.
          <br />
          실행 전에 대상 학습자와 삭제 범위를 확인해 주세요.
        </p>
      </header>
      <section className="admin-reset__target" aria-label="초기화 대상 학습자">
        <div>
          <span>초기화 대상 학습자</span>
          <strong>
            {isPending
              ? '학습자 확인 중…'
              : learnerId === null
                ? '지정된 학습자 없음'
                : learnerName}
          </strong>
        </div>
        {learnerId !== null && (
          <small>
            사용자 ID <b>{learnerId}</b>
          </small>
        )}
        <p>현재 테스트 학습자 한 명에게만 적용됩니다. 다른 학습자의 기록은 유지됩니다.</p>
      </section>
      <section className="admin-reset__scope" aria-label="초기화 범위">
        <div className="admin-reset__scope-column admin-reset__scope-column--delete">
          <header>
            <span className="admin-reset__mark">−</span>
            <h2>삭제되는 기록</h2>
          </header>
          <dl>
            <div>
              <dt>시청·학습 진행</dt>
              <dd>영상 시청 이력과 완료 기록이 삭제되고, 시리즈 진행률도 초기화됩니다.</dd>
            </div>
            <div>
              <dt>퀴즈·복습</dt>
              <dd>퀴즈 풀이와 응답, 오답 노트, 복습·플래시카드 이용 기록이 삭제됩니다.</dd>
            </div>
            <div>
              <dt>좋아요·저장</dt>
              <dd>누른 좋아요와 저장 목록이 비워집니다.</dd>
            </div>
          </dl>
        </div>
        <div className="admin-reset__scope-column">
          <header>
            <Icon name="check" size={19} />
            <h2>유지되는 데이터</h2>
          </header>
          <dl>
            <div>
              <dt>콘텐츠와 학습 자료</dt>
              <dd>등록한 콘텐츠·영상 파일·퀴즈와 수정 이력·시리즈 구성은 유지됩니다.</dd>
            </div>
            <div>
              <dt>사용자 계정과 설정</dt>
              <dd>계정, 관심 분야, 관심 분야 안내 완료 상태와 복습 주기는 유지됩니다.</dd>
            </div>
            <div>
              <dt>다른 학습자의 기록</dt>
              <dd>초기화 대상으로 표시되지 않은 사용자는 영향을 받지 않습니다.</dd>
            </div>
          </dl>
        </div>
      </section>
      <section className="admin-reset__notice" aria-labelledby="reset-notice-title">
        <h2 id="reset-notice-title">실행 전 확인해 주세요</h2>
        <ul>
          <li>
            <strong>삭제한 기록을 되돌리는 기능은 없습니다.</strong> 필요한 테스트 결과나 통계는
            먼저 확인해 두세요.
          </li>
          <li>
            해당 학습자의 기록이 집계에서 빠지므로{' '}
            <strong>조회수·좋아요·저장 수와 학습 통계도 달라집니다.</strong>
          </li>
          <li>
            다른 창에서 학습 중이라면 종료한 뒤 진행해 주세요. 초기화 후에는 학습 화면을
            새로고침하고 다시 시작해 주세요.
          </li>
        </ul>
      </section>
      <div className="admin-reset__actions">
        <p>
          {ready
            ? '다음 단계에서 삭제 범위를 다시 확인합니다.'
            : isPending
              ? '학습자 정보를 확인하고 있습니다.'
              : '초기화할 학습자와 설정을 확인할 수 없습니다.'}
        </p>
        <Button
          variant="danger"
          disabled={busy || !ready}
          onClick={() => {
            if (actorId !== null && learnerId !== null && generation !== null)
              setTarget({ userId: learnerId, name: learnerName, generation, actorId })
          }}
        >
          초기화 확인
        </Button>
      </div>
      {completed && (
        <section className="admin-reset__complete" role="status">
          <h2>{completed.name} 님의 기록 초기화가 완료되었습니다.</h2>
          <p>콘텐츠와 사용자 설정은 유지되었습니다.</p>
          <dl>
            {(
              [
                ['시청 기록', completed.result.deleted_counts.watch_records],
                ['퀴즈 응답', completed.result.deleted_counts.responses],
                ['좋아요', completed.result.deleted_counts.likes],
                ['저장', completed.result.deleted_counts.saved_contents],
              ] as const
            ).map(([label, count]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{count.toLocaleString()}건 삭제</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
      {target && (
        <ResetConfirmation
          target={target}
          valid={valid}
          busy={busy}
          onCancel={() => {
            if (!running.current) setTarget(null)
          }}
          onConfirm={() => void run()}
        />
      )}
      {requestError != null && <RequestError title="기록 초기화 실패" error={requestError} />}
      {node}
    </div>
  )
}
