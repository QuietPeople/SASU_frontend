import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import { adminError, useAdminQuery, type AdminCategory } from '../../api/admin'
import { useSession } from '../../state/session'
import { Button, Spinner, StateBlock } from '../../shared/ui'
import { useToast } from '../../shared/useToast'

export function CategoryPage() {
  const { actorId } = useSession()
  const cache = useQueryClient()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { show, node } = useToast()
  const requestedBack = params.get('back') ?? ''
  const back = requestedBack.startsWith('/admin/') ? requestedBack : '/admin/contents'
  const list = useAdminQuery<{ items: AdminCategory[] }>('/categories')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [draft, setDraft] = useState('')
  const [adding, setAdding] = useState('')
  const [busy, setBusy] = useState(false)
  const save = async (id: number | null) => {
    const name = (id === null ? adding : draft).trim()
    if (busy || actorId === null) return
    if (!name) {
      show('분야명을 입력해 주세요.', 'error')
      return
    }
    setBusy(true)
    try {
      await api(id === null ? '/categories' : `/categories/${id}`, {
        actorId,
        method: id === null ? 'POST' : 'PATCH',
        body: { name },
      })
      if (id === null) setAdding('')
      else setEditingId(null)
      await cache.invalidateQueries()
      show(id === null ? '분야를 저장했어요.' : '분야 이름을 바꿨어요.')
    } catch (error) {
      show(adminError(error), 'error')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="sasu-page sasu-form">
      <header className="sasu-page__head">
        <p className="sasu-eyebrow">관리자 · 분야</p>
        <h1 className="sasu-title">분야 관리</h1>
        <p className="sasu-sub">분야를 추가하거나 이름을 수정할 수 있어요.</p>
      </header>
      <section className="sasu-card">
        {list.isPending ? (
          <Spinner />
        ) : list.isError ? (
          <StateBlock
            title="분야를 불러오지 못했어요."
            text={list.error.message}
            action={<Button onClick={() => void list.refetch()}>다시 시도</Button>}
          />
        ) : !list.data.items.length ? (
          <p className="sasu-muted">등록된 분야가 없어요.</p>
        ) : (
          <table className="sasu-table">
            <thead>
              <tr>
                <th>분야</th>
                <th aria-label="동작" />
              </tr>
            </thead>
            <tbody>
              {list.data.items.map((cat) => (
                <tr key={cat.category_id}>
                  <td>
                    {editingId === cat.category_id ? (
                      <input
                        className="sasu-input"
                        value={draft}
                        maxLength={30}
                        disabled={busy}
                        onChange={(e) => setDraft(e.target.value)}
                        aria-label="분야명"
                      />
                    ) : (
                      cat.name
                    )}
                  </td>
                  <td className="sasu-table__right">
                    {editingId === cat.category_id ? (
                      <div className="sasu-table__actions">
                        <Button
                          size="sm"
                          variant="primary"
                          loading={busy}
                          onClick={() => void save(cat.category_id)}
                        >
                          저장
                        </Button>
                        <Button size="sm" disabled={busy} onClick={() => setEditingId(null)}>
                          취소
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() => {
                          setEditingId(cat.category_id)
                          setDraft(cat.name)
                        }}
                      >
                        이름 수정
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <section className="sasu-card">
        <h2 className="sasu-card__title">분야 추가</h2>
        <div className="sasu-row sasu-row--tight">
          <input
            className="sasu-input"
            maxLength={30}
            value={adding}
            disabled={busy}
            onChange={(e) => setAdding(e.target.value)}
            placeholder="새 분야명"
            aria-label="새 분야명"
          />
          <Button
            variant="primary"
            onClick={() => void save(null)}
            loading={busy}
            disabled={actorId === null}
          >
            추가
          </Button>
        </div>
      </section>
      <Button onClick={() => navigate(back)}>콘텐츠 관리로 돌아가기</Button>
      {node}
    </div>
  )
}
