import { useEffect, useRef, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useLocation, useNavigate } from 'react-router'
import { api, ApiError, queryString, type ApiPage } from '../api/client'
import {
  useAdminQuery,
  type AdminCategory,
  type AdminContent,
  type EditableContent,
} from '../api/admin'
import { useSession } from '../state/session'
import { AutocompleteInput } from './AutocompleteInput'
import { Icon } from './Icon'
import { Badge, Button } from './ui'

const STATUSES: { id: 'ALL' | 'PUBLISHED' | 'DRAFT'; label: string }[] = [
  { id: 'ALL', label: '전체' },
  { id: 'PUBLISHED', label: '공개' },
  { id: 'DRAFT', label: '임시저장' },
]

export function StatsContentPicker({ target }: { target?: string }) {
  const navigate = useNavigate()
  const { actorId, generation } = useSession()
  const location = useLocation()
  const owner = `${actorId}:${generation}`
  const routeState = location.state as {
    statsContentSearch?: {
      owner: string
      search: string
      category: string
      status: 'ALL' | 'PUBLISHED' | 'DRAFT'
      page: number
    }
  } | null
  const initial =
    routeState?.statsContentSearch?.owner === owner ? routeState.statsContentSearch : undefined
  const statusRoot = useRef<HTMLDivElement>(null)
  const [statusOpen, setStatusOpen] = useState(false)
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState(initial?.search ?? '')
  const [term, setTerm] = useState(initial?.search.trim() ?? '')
  const [category, setCategory] = useState(initial?.category ?? '')
  const [categorySearch, setCategorySearch] = useState<string | null>(null)
  const [status, setStatus] = useState<'ALL' | 'PUBLISHED' | 'DRAFT'>(initial?.status ?? 'ALL')
  const [page, setPage] = useState(initial?.page ?? 1)
  const categories = useAdminQuery<{ items: AdminCategory[] }>('/categories')
  const selected = useAdminQuery<EditableContent>(target ? `/contents/${target}?view=editor` : null)
  const categoryOptions = [
    { id: '', label: '전체 분야' },
    ...(categories.data?.items ?? []).map((c) => ({ id: String(c.category_id), label: c.name })),
  ]
  const categoryName = categoryOptions.find((c) => c.id === category)?.label ?? '전체 분야'
  useEffect(() => {
    const timeout = window.setTimeout(() => setTerm(search.trim()), 250)
    return () => window.clearTimeout(timeout)
  }, [search])
  useEffect(() => {
    if (!statusOpen) return
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !statusRoot.current?.contains(event.target))
        setStatusOpen(false)
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [statusOpen])
  const list = useQuery({
    queryKey: ['admin', actorId, generation, 'stats-content-search', term, category, status, page],
    enabled: open && actorId !== null,
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }): Promise<ApiPage<AdminContent>> => {
      if (term.startsWith('#')) {
        const id = term.slice(1)
        const empty = { items: [], total: 0, page: 1, size: 10, has_next: false }
        if (!/^\d{1,19}$/.test(id) || BigInt(id) < 1n || BigInt(id) > 9223372036854775807n)
          return empty
        try {
          const item = (
            await api<EditableContent>(`/contents/${BigInt(id)}?view=editor`, { actorId, signal })
          ).detail.content
          if (
            (category && String(item.category?.category_id) !== category) ||
            (status !== 'ALL' && item.status !== status)
          )
            return empty
          return { ...empty, items: [item], total: 1 }
        } catch (error) {
          if (error instanceof ApiError && error.status === 404) return empty
          throw error
        }
      }
      return api<ApiPage<AdminContent>>(
        `/contents${queryString({ q: term || undefined, category_id: category || undefined, status, page, size: 10 })}`,
        { actorId, signal },
      )
    },
  })
  const navigateWithFilters = (path: string) =>
    navigate(path, { state: { statsContentSearch: { owner, search, category, status, page } } })
  const updating = search.trim() !== term || list.isPlaceholderData
  const reset = () => {
    setSearch('')
    setTerm('')
    setCategory('')
    setCategorySearch(null)
    setStatus('ALL')
    setStatusOpen(false)
    setPage(1)
    setOpen(true)
  }
  return (
    <section
      className="admin-stats__picker"
      aria-label="통계 콘텐츠 검색"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !event.defaultPrevented) {
          if (statusOpen) {
            setStatusOpen(false)
            statusRoot.current
              ?.querySelector<HTMLButtonElement>('.admin-stats__status-trigger')
              ?.focus()
          } else setOpen(false)
        }
      }}
    >
      <div className="admin-stats__picker-label">
        <label htmlFor="stats-content">대상 콘텐츠 찾기</label>
        <button type="button" onClick={reset} disabled={!search && !category && status === 'ALL'}>
          조건 초기화
        </button>
      </div>
      <div className="admin-stats__picker-controls">
        <div className="admin-stats__picker-search">
          <Icon name="search" size={19} />
          <input
            id="stats-content"
            type="search"
            className="admin-input"
            placeholder="제목·태그·핵심 내용 검색, 번호는 #2969"
            maxLength={200}
            value={search}
            aria-controls={open ? 'stats-content-results' : undefined}
            onFocus={() => setOpen(true)}
            onClick={() => setOpen(true)}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
              setOpen(true)
            }}
          />
        </div>
        <div className="admin-stats__picker-filters">
          <div className="admin-stats__picker-category">
            <label htmlFor="stats-category">분야</label>
            <AutocompleteInput
              id="stats-category"
              placeholder={categories.isPending ? '분야 불러오는 중…' : categoryName}
              listLabel="통계 검색 분야"
              showAll
              value={categorySearch ?? categoryName}
              options={categoryOptions}
              invalid={false}
              onOpen={() => {
                setCategorySearch('')
                setStatusOpen(false)
              }}
              onClose={() => setCategorySearch(null)}
              onChange={setCategorySearch}
              onSelect={(option) => {
                setCategory(option.id)
                setCategorySearch(null)
                setPage(1)
                setOpen(true)
              }}
            />
          </div>
          <div
            className="admin-stats__picker-status"
            ref={statusRoot}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) setStatusOpen(false)
            }}
          >
            <span id="stats-status-label">상태</span>
            <div className="admin-stats__status-select">
              <button
                type="button"
                className="admin-stats__status-trigger"
                aria-labelledby="stats-status-label stats-status-value"
                aria-expanded={statusOpen}
                aria-controls="stats-status-options"
                onClick={() => setStatusOpen(!statusOpen)}
              >
                <span id="stats-status-value">
                  {STATUSES.find((option) => option.id === status)?.label}
                </span>
                <Icon name="chevronDown" size={16} />
              </button>
              {statusOpen && (
                <div
                  id="stats-status-options"
                  className="admin-stats__status-options"
                  role="group"
                  aria-label="콘텐츠 공개 상태 선택"
                >
                  {STATUSES.map((option) => (
                    <button
                      type="button"
                      key={option.id}
                      aria-pressed={status === option.id}
                      onClick={() => {
                        setStatus(option.id)
                        setPage(1)
                        setOpen(true)
                        setStatusOpen(false)
                        statusRoot.current
                          ?.querySelector<HTMLButtonElement>('.admin-stats__status-trigger')
                          ?.focus()
                      }}
                    >
                      {option.label}
                      {status === option.id && <Icon name="check" size={15} />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        {categories.isError && (
          <div className="admin-stats__picker-error">
            분야를 불러오지 못했어요.{' '}
            <Button size="sm" onClick={() => void categories.refetch()}>
              분야 다시 시도
            </Button>
          </div>
        )}
      </div>
      <div className="admin-stats__scope">
        <span>조회 대상</span>
        <strong>
          {target ? selected.data?.detail.content.title || `콘텐츠 #${target}` : '전체 콘텐츠'}
        </strong>
        <button
          type="button"
          className="admin-stats__results-toggle"
          aria-expanded={open}
          aria-controls="stats-content-results"
          onClick={() => {
            setOpen(!open)
            setStatusOpen(false)
          }}
        >
          {open ? '검색 결과 접기' : '검색 결과 보기'}
          <Icon name="chevronDown" size={14} />
        </button>
        {target && (
          <Button
            size="sm"
            onClick={() => {
              setOpen(false)
              navigateWithFilters('/admin/stats')
            }}
          >
            전체 통계 보기
          </Button>
        )}
      </div>
      {open && (
        <div
          className="admin-stats__picker-results"
          id="stats-content-results"
          aria-label="콘텐츠 검색 결과"
          aria-busy={list.isFetching || updating}
        >
          <div className="admin-stats__picker-result-head">
            <span role="status">
              {list.isPending || updating
                ? '검색 중…'
                : list.isError
                  ? '검색 실패'
                  : `${(list.data?.total ?? 0).toLocaleString()}개 콘텐츠`}
            </span>
            <button type="button" aria-label="콘텐츠 검색 결과 접기" onClick={() => setOpen(false)}>
              <Icon name="close" size={17} />
            </button>
          </div>
          {list.isError ? (
            <div className="admin-stats__picker-empty">
              <p>콘텐츠를 불러오지 못했어요.</p>
              <Button size="sm" onClick={() => void list.refetch()}>
                다시 시도
              </Button>
            </div>
          ) : list.isPending ? (
            <div className="admin-stats__picker-empty">콘텐츠를 찾고 있어요.</div>
          ) : !list.data.items.length ? (
            <div className="admin-stats__picker-empty">
              <strong>조건에 맞는 콘텐츠가 없어요.</strong>
              <p>검색어·분야·공개 상태를 바꿔 보세요.</p>
            </div>
          ) : (
            <ul className="admin-stats__picker-list">
              {list.data.items.map((item) => (
                <li key={item.content_id}>
                  <button
                    type="button"
                    disabled={updating}
                    aria-pressed={String(item.content_id) === target}
                    onClick={() => {
                      setOpen(false)
                      navigateWithFilters(`/admin/stats/${item.content_id}`)
                    }}
                  >
                    <span>
                      <strong>{item.title || '제목 없음'}</strong>
                      <small>
                        {item.category?.name ?? '분야 미지정'} · #{item.content_id}
                        {item.tags.length
                          ? ` · ${item.tags
                              .slice(0, 3)
                              .map((tag) => `#${tag.name}`)
                              .join(' ')}`
                          : ''}
                      </small>
                    </span>
                    <Badge tone={item.status === 'PUBLISHED' ? 'green' : 'neutral'}>
                      {item.status === 'PUBLISHED' ? '공개' : '임시저장'}
                    </Badge>
                    {String(item.content_id) === target && (
                      <span className="admin-stats__picker-current">선택됨</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {list.data && list.data.total > 10 && (
            <div className="admin-stats__picker-pages">
              <button
                type="button"
                aria-label="콘텐츠 검색 이전 페이지"
                disabled={updating || list.data.page === 1}
                onClick={() => setPage(page - 1)}
              >
                <Icon name="chevronLeft" size={17} />
              </button>
              <span>
                {list.data.page} / {Math.ceil(list.data.total / 10)}
              </span>
              <button
                type="button"
                aria-label="콘텐츠 검색 다음 페이지"
                disabled={updating || !list.data.has_next}
                onClick={() => setPage(page + 1)}
              >
                <Icon name="chevronRight" size={17} />
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
