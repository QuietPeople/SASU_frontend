import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { invalidateCategoryChange } from '../api/queryInvalidation'
import { api, ApiError } from '../api/client'
import { useAdminPages, useAdminQuery, type AdminCategory, type AdminContent } from '../api/admin'
import { useSession } from '../state/session'
import { RequestError } from './RequestFeedback'
import { Button, Spinner } from './ui'
import { Icon } from './Icon'
import { useToast } from './useToast'
import {
  categoryDirty,
  categoryNameError,
  categoryUsage,
  type CategoryDraft,
} from './categoryEditor'
import './category.css'

// 독립 화면의 작성 중 입력만 탭 내 보존한다. 저장·취소 시 제거한다.
const drafts = new Map<number, CategoryDraft>()

export function CategoryManager({
  standalone = false,
  onCreated,
  onBusyChange,
  onDirtyChange,
}: {
  standalone?: boolean
  onCreated?: (category: AdminCategory) => void
  onBusyChange?: (busy: boolean) => void
  onDirtyChange?: (dirty: boolean) => void
}) {
  const { actorId } = useSession()
  const cache = useQueryClient()
  const navigate = useNavigate()
  const { show, node } = useToast()
  const list = useAdminQuery<{ items: AdminCategory[] }>('/categories')
  const contents = useAdminPages<AdminContent>('/contents?status=ALL', standalone)
  const [editor, setEditor] = useState<CategoryDraft | null>(() =>
    standalone && actorId !== null ? (drafts.get(actorId) ?? null) : null,
  )
  const [search, setSearch] = useState('')
  const saving = useRef(false)
  const saveMutation = useMutation({
    mutationFn: persistCategory,
    onError: (cause) => {
      if (cause instanceof ApiError && cause.code === 'CATEGORY_NAME_CONFLICT')
        setConflict('다른 분야에서 사용 중인 이름이에요. 다른 이름을 입력해 주세요.')
    },
    onSettled: () => {
      saving.current = false
    },
  })
  const busy = saveMutation.isPending
  const [touched, setTouched] = useState(false)
  const [conflict, setConflict] = useState('')
  const requestError =
    saveMutation.error instanceof ApiError && saveMutation.error.code === 'CATEGORY_NAME_CONFLICT'
      ? null
      : saveMutation.error
  const [destination, setDestination] = useState<string | null>(null)
  const confirmation = useRef<HTMLDialogElement>(null)
  const stayButton = useRef<HTMLButtonElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const dirty = categoryDirty(editor)
  const categories = list.data?.items ?? []
  const error = editor ? categoryNameError(editor, categories) || conflict : ''
  const existing =
    editor?.id === null ? categories.find((c) => c.name === editor.name.trim()) : null
  const counts = categoryUsage(contents.data ?? [])
  const matches = categories.filter((c) =>
    c.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  )

  const update = (next: CategoryDraft | null) => {
    setEditor(next)
    setConflict('')
    if (standalone && actorId !== null) {
      if (next && categoryDirty(next)) drafts.set(actorId, next)
      else drafts.delete(actorId)
    }
  }
  const open = (category?: AdminCategory) => {
    if (saving.current || editor) return
    setSearch('')
    setTouched(false)
    saveMutation.reset()
    update({
      id: category?.category_id ?? null,
      name: category?.name ?? '',
      original: category?.name ?? '',
    })
  }
  const editorId = editor?.id
  useEffect(() => {
    input.current?.focus()
  }, [editorId])
  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])
  useEffect(() => {
    onBusyChange?.(busy)
  }, [busy, onBusyChange])
  useEffect(() => {
    if (!dirty && !busy) return
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', guard)
    return () => window.removeEventListener('beforeunload', guard)
  }, [dirty, busy])
  useEffect(() => {
    if (!standalone || (!dirty && !busy)) return
    const guard = (event: MouseEvent) => {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)
        return
      if (!(event.target instanceof Element)) return
      const link = event.target.closest('a[href]')
      let path: string | null = null
      if (
        link instanceof HTMLAnchorElement &&
        link.target !== '_blank' &&
        link.origin === location.origin &&
        link.pathname + link.search !== location.pathname + location.search
      )
        path = link.pathname + link.search + link.hash
      if (event.target.closest('.admin-nav__switch')) path = '/learner/search'
      const brand = event.target.closest('.admin-nav__brand')
      if (brand && !brand.hasAttribute('aria-expanded')) path = '/'
      if (!path) return
      event.preventDefault()
      event.stopPropagation()
      if (!saving.current) setDestination(path)
    }
    document.addEventListener('click', guard, true)
    return () => document.removeEventListener('click', guard, true)
  }, [standalone, dirty, busy])
  useEffect(() => {
    if (!destination) return
    const dialog = confirmation.current!
    const previous = document.activeElement as HTMLElement | null
    dialog.showModal()
    stayButton.current?.focus()
    return () => {
      dialog.close()
      previous?.focus()
    }
  }, [destination])

  async function persistCategory({
    id,
    name,
    actorId,
  }: {
    id: number | null
    name: string
    actorId: number
  }) {
    const category = await api<AdminCategory>(id === null ? '/categories' : `/categories/${id}`, {
      actorId,
      method: id === null ? 'POST' : 'PATCH',
      body: { name },
    })
    const reused = id === null && categories.some((c) => c.category_id === category.category_id)
    cache.setQueriesData<{ items: AdminCategory[] }>(
      {
        predicate: (query) =>
          query.queryKey[0] === 'admin' &&
          query.queryKey[1] === actorId &&
          query.queryKey.at(-1) === '/categories',
      },
      (old) =>
        old
          ? {
              items: [
                ...old.items.filter((c) => c.category_id !== category.category_id),
                category,
              ].sort((a, b) => a.category_id - b.category_id),
            }
          : old,
    )
    update(null)
    if (id === null) onCreated?.(category)
    show(
      id !== null
        ? '분야 이름을 바꿨어요.'
        : reused
          ? onCreated
            ? '기존 분야를 콘텐츠에 선택했어요.'
            : '이미 등록된 분야를 확인했어요.'
          : onCreated
            ? '분야를 추가하고 콘텐츠에 선택했어요.'
            : '새 분야를 추가했어요.',
    )
    await invalidateCategoryChange(cache, { renamed: id !== null })
  }
  const save = () => {
    if (!editor || saving.current || actorId === null || !dirty || !list.data) return
    setTouched(true)
    if (error) {
      input.current?.focus()
      return
    }
    saving.current = true
    saveMutation.mutate({ id: editor.id, name: editor.name.trim(), actorId })
  }
  const form = editor && (
    <form
      className="admin-category__form"
      onSubmit={(event) => {
        event.preventDefault()
        void save()
      }}
    >
      <label htmlFor="category-name">{editor.id === null ? '새 분야명' : '분야명 수정'}</label>
      <div className="admin-category__form-row">
        <input
          ref={input}
          id="category-name"
          className="admin-input"
          value={editor.name}
          placeholder="예: 업무 자동화"
          disabled={busy}
          aria-invalid={!!error && (touched || !!editor.name)}
          aria-describedby="category-name-help"
          onBlur={() => setTouched(true)}
          onChange={(e) => update({ ...editor, name: e.target.value })}
        />
        <div className="admin-category__form-actions">
          <Button
            type="submit"
            variant="primary"
            size="sm"
            loading={busy}
            disabled={!dirty || !!error || actorId === null || !list.data}
          >
            {editor.id !== null ? '저장' : existing ? '기존 분야 사용' : '추가'}
          </Button>
          <Button
            size="sm"
            disabled={busy}
            onClick={() => {
              update(null)
              setTouched(false)
              saveMutation.reset()
            }}
          >
            취소
          </Button>
        </div>
      </div>
      <div id="category-name-help" className="admin-category__field-help">
        <span className={error && (touched || editor.name) ? 'admin-field-error' : ''}>
          {error && (touched || editor.name)
            ? error
            : existing
              ? '이미 등록된 분야예요. 새로 만들지 않고 기존 분야를 사용해요.'
              : '앞뒤 공백을 제외하고 1~30자로 입력해 주세요.'}
        </span>
        <span>{[...editor.name.trim()].length} / 30</span>
      </div>
      {editor.id !== null && (
        <p className="admin-category__rename-note">
          이름을 바꾸면 연결된 콘텐츠와 사용자의 관심 분야에도 반영돼요.
        </p>
      )}
    </form>
  )
  return (
    <div className={`admin-category-manager ${standalone ? 'admin-category-manager--full' : ''}`}>
      <section className="admin-category__catalog" aria-label="분야 목록">
        <header className="admin-category__head">
          <h2>
            분야 <span>{list.data?.items.length ?? '—'}</span>
          </h2>
          <Button
            size="sm"
            variant="primary"
            disabled={busy || !!editor || !list.data}
            onClick={() => open()}
          >
            <Icon name="plus" size={16} />
            분야 추가
          </Button>
        </header>
        <label className="admin-category__search">
          <Icon name="search" size={18} />
          <input
            type="search"
            aria-label="분야 검색"
            placeholder="분야 이름 검색"
            value={search}
            disabled={busy || !!editor}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        {editor?.id === null && form}
        {standalone && (
          <p className="admin-category__usage-note">
            각 분야에 연결된 콘텐츠의 공개·임시저장 현황이에요.
          </p>
        )}
        {list.isPending ? (
          <Spinner />
        ) : !list.data ? null : !matches.length ? (
          <div className="admin-category__empty">
            <Icon name="categories" size={30} />
            <strong>
              {categories.length ? '검색 결과가 없어요.' : '아직 등록된 분야가 없어요.'}
            </strong>
            <p>
              {categories.length
                ? '다른 이름으로 검색해 주세요.'
                : '분야를 추가해 콘텐츠를 분류해 보세요.'}
            </p>
          </div>
        ) : (
          <ul className="admin-category__list">
            {matches.map((cat) => {
              const usage = counts.get(cat.category_id) ?? { total: 0, published: 0, draft: 0 }
              return (
                <li
                  key={cat.category_id}
                  className={editor?.id === cat.category_id ? 'is-editing' : ''}
                >
                  <div className="admin-category__row">
                    <div className="admin-category__name">
                      <span className="admin-category__icon">
                        <Icon name="categories" size={17} />
                      </span>
                      <strong>{cat.name}</strong>
                    </div>
                    {standalone && (
                      <div className="admin-category__usage" aria-label={`${cat.name} 콘텐츠 현황`}>
                        {contents.data && !contents.isError ? (
                          <>
                            <span>
                              전체 <b>{usage.total}</b>
                            </span>
                            <span className="is-published">
                              공개 <b>{usage.published}</b>
                            </span>
                            <span>
                              임시저장 <b>{usage.draft}</b>
                            </span>
                          </>
                        ) : (
                          <span>{contents.isError ? '현황 확인 필요' : '현황 불러오는 중…'}</span>
                        )}
                      </div>
                    )}
                    <button
                      type="button"
                      className="admin-category__edit"
                      disabled={busy || !!editor}
                      aria-label={`${cat.name} 이름 수정`}
                      onClick={() => open(cat)}
                    >
                      이름 수정
                      <Icon name="chevronRight" size={15} />
                    </button>
                  </div>
                  {editor?.id === cat.category_id && form}
                </li>
              )
            })}
          </ul>
        )}
      </section>
      {list.error && (
        <RequestError
          title="분야를 불러오지 못했어요."
          error={list.error}
          action={<Button onClick={() => void list.refetch()}>다시 시도</Button>}
        />
      )}
      {standalone && contents.error && (
        <RequestError
          title="콘텐츠 현황을 불러오지 못했어요."
          error={contents.error}
          action={<Button onClick={() => void contents.refetch()}>현황 다시 불러오기</Button>}
        />
      )}
      {requestError !== null && <RequestError title="분야 저장 실패" error={requestError} />}
      {standalone && (
        <dialog
          ref={confirmation}
          className="admin-category__confirm"
          aria-labelledby="category-leave-title"
          onCancel={(e) => {
            e.preventDefault()
            setDestination(null)
          }}
        >
          <h2 id="category-leave-title">저장하지 않은 입력이 있어요.</h2>
          <p>이동해도 입력은 이 탭에서 임시 보관돼요. 새로고침하면 사라져요.</p>
          <div className="admin-row">
            <button
              ref={stayButton}
              className="admin-btn admin-btn--primary"
              onClick={() => setDestination(null)}
            >
              계속 작성
            </button>
            <Button
              onClick={() => {
                if (destination) {
                  navigate(destination)
                  setDestination(null)
                }
              }}
            >
              이동
            </Button>
          </div>
        </dialog>
      )}
      {node}
    </div>
  )
}
