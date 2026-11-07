import { ErrorFeedback } from '../shared/ErrorFeedback'
import { Skeleton } from '../shared/Skeleton'
import { ImeInput } from '../shared/ImeInput'
import { usePaginationScroll } from '../shared/usePaginationScroll'
import { useEffect, useState } from 'react'
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
import { ContentFilter } from './ContentFilter'
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
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState(initial?.search ?? '')
  const [term, setTerm] = useState(initial?.search.trim() ?? '')
  const [category, setCategory] = useState(initial?.category ?? '')
  const [status, setStatus] = useState<'ALL' | 'PUBLISHED' | 'DRAFT'>(initial?.status ?? 'ALL')
  const [page, setPage] = useState(initial?.page ?? 1)
  const { attach: paginationRef, preserve: preservePaginationScroll } =
    usePaginationScroll<HTMLDivElement>(`${owner}:${term}:${category}:${status}:${open}`)
  const changePage = (next: number) => {
    preservePaginationScroll()
    setPage(next)
  }
  const categories = useAdminQuery<{ items: AdminCategory[] }>('/categories')
  const categoryOptions = [
    { id: '', label: '전체 분야' },
    ...(categories.data?.items ?? []).map((c) => ({ id: String(c.category_id), label: c.name })),
  ]
  useEffect(() => {
    const timeout = window.setTimeout(() => setTerm(search.trim()), 250)
    return () => window.clearTimeout(timeout)
  }, [search])
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
  const showAllStatistics = () => {
    setOpen(false)
    navigateWithFilters('/admin/stats')
  }
  const updating = search.trim() !== term || list.isPlaceholderData
  const reset = () => {
    setSearch('')
    setTerm('')
    setCategory('')
    setStatus('ALL')
    setPage(1)
    setOpen(true)
  }
  return (
    <section
      className="admin-stats__picker"
      aria-label="통계 콘텐츠 검색"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !event.defaultPrevented) setOpen(false)
      }}
    >
      <div className="admin-stats__picker-label">
        <h2>통계를 볼 콘텐츠 찾기</h2>
        <Button size="sm" variant="primary" onClick={showAllStatistics}>
          전체 통계 보기
        </Button>
      </div>
      <div className="admin-stats__picker-controls">
        <div className="admin-stats__picker-search-field">
          <label htmlFor="stats-content">검색어</label>
          <div className="admin-stats__picker-search">
            <Icon name="search" size={19} />
            <ImeInput
              id="stats-content"
              type="search"
              className="admin-input"
              placeholder="제목·태그·핵심 내용 검색, 번호는 #2969"
              maxLength={200}
              value={search}
              aria-controls={open ? 'stats-content-results' : undefined}
              onFocus={() => setOpen(true)}
              onClick={() => setOpen(true)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return
                event.preventDefault()
                const next = event.currentTarget.value.trim()
                if (!next) {
                  showAllStatistics()
                  return
                }
                setTerm(next)
                setPage(1)
                setOpen(true)
              }}
              onValueChange={(value) => {
                setSearch(value)
                setPage(1)
                setOpen(true)
              }}
            />
          </div>
        </div>
        <div className="admin-stats__picker-filters">
          <ContentFilter
            id="stats-category"
            label="분야"
            value={category}
            options={categoryOptions}
            disabled={categories.isPending}
            onChange={(value) => {
              setCategory(value)
              setPage(1)
              setOpen(true)
            }}
          />
          <ContentFilter
            id="stats-status"
            label="상태"
            value={status}
            options={STATUSES}
            onChange={(value) => {
              const option = STATUSES.find((item) => item.id === value)
              if (!option) return
              setStatus(option.id)
              setPage(1)
              setOpen(true)
            }}
          />
        </div>
        {categories.isError && (
          <ErrorFeedback
            title="분야를 불러오지 못했어요."
            error={categories.error}
            action={
              <Button size="sm" onClick={() => void categories.refetch()}>
                분야 다시 시도
              </Button>
            }
          />
        )}
      </div>
      <div className="admin-stats__scope">
        <p>결과에서 콘텐츠를 선택하면 집계 대상이 바뀌어요.</p>
        <div className="admin-stats__search-actions">
          <Button size="sm" onClick={reset} disabled={!search && !category && status === 'ALL'}>
            조건 초기화
          </Button>
          <button
            type="button"
            className="admin-btn admin-btn--default admin-btn--sm admin-stats__results-toggle"
            aria-expanded={open}
            aria-controls="stats-content-results"
            onClick={() => {
              setOpen(!open)
            }}
          >
            {open ? '검색 결과 접기' : '검색 결과 보기'}
            <Icon name="chevronDown" size={14} />
          </button>
        </div>
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
          <div className="admin-stats__picker-scroll">
            <div ref={paginationRef}>
              {list.isError ? (
                <ErrorFeedback
                  variant="screen"
                  title="콘텐츠를 불러오지 못했어요."
                  error={list.error}
                  action={
                    <Button size="sm" onClick={() => void list.refetch()}>
                      다시 시도
                    </Button>
                  }
                />
              ) : list.isPending ? (
                <Skeleton variant="list" label="콘텐츠를 찾는 중" />
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
            </div>
          </div>
          {list.data && list.data.total > 10 && (
            <div className="admin-stats__picker-pages">
              <button
                type="button"
                aria-label="콘텐츠 검색 이전 페이지"
                disabled={updating || list.data.page === 1}
                onClick={() => changePage(page - 1)}
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
                onClick={() => changePage(page + 1)}
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
