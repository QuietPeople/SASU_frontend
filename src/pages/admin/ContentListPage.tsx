import { Skeleton } from '../../shared/Skeleton'
import { ImeInput } from '../../shared/ImeInput'
import { Thumbnail } from '../../shared/Thumbnail'
import { usePaginationScroll } from '../../shared/usePaginationScroll'
import { ContentDialog } from '../../admin/ContentDialog'
import { ContentFilter } from '../../admin/ContentFilter'
import type { ContentSubviewKind } from '../../admin/contentSubview'
import { RequestError } from '../../admin/RequestFeedback'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useToast } from '../../admin/useToast'
import { contentDeletedMessage } from '../../admin/contentDelete'
import { type ApiPage } from '../../api/client'
import { type AdminContent, type AdminCategory, useAdminQuery } from '../../api/admin'
import { Badge, Button, StateBlock } from '../../admin/ui'
import { Icon, type IconName } from '../../admin/Icon'
import { pageNumbers } from '../../admin/pagination'
import '../../admin/content-list.css'
import { useAdminView } from '../../admin/useAdminView'
import {
  adminFilters,
  adminPage,
  adminStatus,
  adminId,
  adminMissing,
  adminContentListPath,
  CONTENT_MISSING_OPTIONS,
} from '../../admin/navigation'

function ContentActions({
  content,
  onOpen,
}: {
  content: AdminContent
  onOpen: (content: AdminContent, view: ContentSubviewKind) => void
}) {
  return (
    <div
      className="admin-cl__actions"
      role="group"
      aria-label={`${content.title || '제목 없음'} 관리`}
    >
      <Button size="sm" variant="primary" onClick={() => onOpen(content, 'edit')}>
        편집
      </Button>
      <Button size="sm" variant="ghost" onClick={() => onOpen(content, 'materials')}>
        자료
      </Button>
      <Button size="sm" variant="ghost" onClick={() => onOpen(content, 'stats')}>
        통계
      </Button>
    </div>
  )
}

const PAGE_SIZE = 5

export function ContentListPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { show, node } = useToast()
  useEffect(() => {
    const notice = location.state as { contentDeleted?: { pending: boolean } } | null
    if (notice?.contentDeleted) {
      show(
        contentDeletedMessage(notice.contentDeleted.pending),
        notice.contentDeleted.pending ? 'error' : 'ok',
      )
      navigate(location.pathname + location.search, { replace: true, state: null })
    }
  }, [location, navigate, show])
  const [params, setParams] = useAdminView('contents')
  const query = params.get('q') ?? '',
    status = adminStatus(params.get('status')),
    page = adminPage(params.get('page'))
  const category = adminId(params.get('category_id'))
  const missing = adminMissing(params.get('missing'))
  const { attach: paginationRef, preserve: preservePaginationScroll } =
    usePaginationScroll<HTMLElement>(`${query}:${status}:${category}:${missing}`)
  const update = (values: Record<string, string>) => setParams(adminFilters(params, values), true)
  const setQuery = (value: string) => update({ q: value })
  const setStatus = (value: string) => update({ status: value })
  const setPage = (value: number) => {
    if (value === page) return
    preservePaginationScroll()
    update({ page: String(value) })
  }
  const categories = useAdminQuery<{ items: AdminCategory[] }>('/categories')
  const [panel, setPanel] = useState<{ content: AdminContent; view: ContentSubviewKind } | null>(
    null,
  )
  const openPanel = (content: AdminContent, view: ContentSubviewKind) => setPanel({ content, view })
  const list = useAdminQuery<ApiPage<AdminContent>>(
    adminContentListPath(params, { size: PAGE_SIZE }),
  )
  const all = useAdminQuery<ApiPage<AdminContent>>(
    adminContentListPath(params, { status: 'ALL', size: 1 }),
  )
  const published = useAdminQuery<ApiPage<AdminContent>>(
    adminContentListPath(params, { status: 'PUBLISHED', size: 1 }),
  )
  const drafts = useAdminQuery<ApiPage<AdminContent>>(
    adminContentListPath(params, { status: 'DRAFT', size: 1 }),
  )
  const reset = () => {
    setParams(new URLSearchParams())
  }
  const selectStatus = (next: string) => {
    setStatus(next)
  }
  const summaries: {
    value: string
    label: string
    description: string
    count: number | undefined
    icon: IconName
    tone: string
  }[] = [
    {
      value: 'ALL',
      label: '전체 콘텐츠',
      description: '등록된 모든 콘텐츠',
      count: all.data?.total,
      icon: 'contents',
      tone: 'blue',
    },
    {
      value: 'PUBLISHED',
      label: '공개',
      description: '학습자가 볼 수 있어요',
      count: published.data?.total,
      icon: 'check',
      tone: 'green',
    },
    {
      value: 'DRAFT',
      label: '임시저장',
      description: '작성 중인 콘텐츠',
      count: drafts.data?.total,
      icon: 'draft',
      tone: 'amber',
    },
  ]
  const totalPages = Math.max(1, Math.ceil((list.data?.total ?? 0) / PAGE_SIZE))
  useEffect(() => {
    if (list.data && page > totalPages)
      setParams(adminFilters(params, { page: String(totalPages) }), true)
  }, [list.data, page, totalPages, params, setParams])
  return (
    <>
      <div className="admin-page admin-cl">
        <header className="admin-page__head admin-page__head--row">
          <div>
            <p className="admin-eyebrow">관리자 · 콘텐츠</p>
            <h1 className="admin-title">콘텐츠 목록</h1>
            <p className="admin-sub">임시저장한 콘텐츠는 학습자에게 보이지 않아요.</p>
          </div>
          <Button variant="primary" onClick={() => navigate('/admin/contents/new')}>
            <Icon name="plus" size={18} /> 새 콘텐츠
          </Button>
        </header>
        <div className="admin-cl__summaries" role="group" aria-label="상태별 콘텐츠 필터">
          {summaries.map((item) => (
            <button
              key={item.value}
              type="button"
              className={`admin-cl__summary admin-cl__summary--${item.tone}`}
              aria-pressed={status === item.value}
              onClick={() => selectStatus(item.value)}
            >
              <span className="admin-cl__summary-top">
                <span>{item.label}</span>
                <span className="admin-cl__summary-icon">
                  <Icon name={item.icon} size={19} />
                </span>
              </span>
              <span className="admin-cl__summary-count">
                {item.count?.toLocaleString() ?? '—'}
                <span>개</span>
              </span>
              <span className="admin-cl__summary-bottom">
                {item.description}
                <Icon name="arrow" size={16} />
              </span>
            </button>
          ))}
        </div>
        <section ref={paginationRef} className="admin-cl__panel" aria-label="콘텐츠 검색 결과">
          <form
            className="admin-cl__toolbar"
            role="search"
            aria-label="콘텐츠 검색"
            onSubmit={(event) => {
              event.preventDefault()
              setPage(1)
            }}
          >
            <div className="admin-cl__search">
              <Icon name="search" size={19} />
              <ImeInput
                type="search"
                aria-label="콘텐츠 검색어"
                value={query}
                onValueChange={setQuery}
                placeholder="제목, 태그, 핵심 내용 검색"
              />
            </div>
            <ContentFilter
              className="admin-cl__filter admin-cl__filter--category"
              id="content-list-category"
              label="분야"
              value={category ? String(category) : ''}
              disabled={categories.isPending}
              options={[
                { id: '', label: '전체 분야' },
                ...(categories.data?.items ?? []).map((item) => ({
                  id: String(item.category_id),
                  label: item.name,
                })),
              ]}
              onChange={(category_id) => update({ category_id })}
            />
            <ContentFilter
              className="admin-cl__filter admin-cl__filter--missing"
              id="content-list-missing"
              label="미등록 항목"
              value={missing ?? ''}
              options={CONTENT_MISSING_OPTIONS.map(({ value, label }) => ({ id: value, label }))}
              onChange={(missing) => update({ missing })}
            />
            <button className="admin-cl__search-submit" type="submit">
              검색
            </button>
          </form>
          <div className="admin-cl__results">
            <p>
              {query ? (
                <>
                  <strong>“{query}”</strong> 검색 결과
                </>
              ) : (
                '콘텐츠 목록'
              )}{' '}
              <span>{list.data?.total?.toLocaleString() ?? '—'}</span>
            </p>
            {query || status !== 'ALL' || category || missing ? (
              <button type="button" onClick={reset}>
                <Icon name="reset" size={14} /> 조건 초기화
              </button>
            ) : null}
          </div>
          {list.isPending ? (
            <div className="admin-cl__loading">
              <Skeleton variant="list" label="목록을 불러오는 중" />
              <span>콘텐츠를 불러오고 있어요</span>
            </div>
          ) : list.isError ? (
            <RequestError
              title="목록을 불러오지 못했어요."
              variant="screen"
              error={list.error}
              action={<Button onClick={() => void list.refetch()}>다시 시도</Button>}
            />
          ) : !list.data.items.length ? (
            <StateBlock
              title="조건에 맞는 콘텐츠가 없어요."
              action={<Button onClick={reset}>조건 초기화</Button>}
            />
          ) : (
            <>
              <div className="admin-table-wrap admin-cl__desktop-list">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>제목</th>
                      <th>분야</th>
                      <th>상태</th>
                      <th>관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.data.items.map((c) => (
                      <tr key={c.content_id}>
                        <td>
                          <div className="sasu-thumbnail-row">
                            <Thumbnail src={c.thumbnail_url} refreshKey={list.dataUpdatedAt} />
                            <span className="admin-table__title">{c.title || '제목 없음'}</span>
                          </div>
                          <span className="admin-table__tags">
                            {c.tags.map((t) => `#${t.name}`).join(' ')}
                          </span>
                        </td>
                        <td>{c.category?.name ?? '—'}</td>
                        <td>
                          <Badge tone={c.status === 'PUBLISHED' ? 'green' : 'neutral'}>
                            {c.status === 'PUBLISHED' ? '공개' : '임시저장'}
                          </Badge>
                        </td>
                        <td className="admin-table__right">
                          <ContentActions content={c} onOpen={openPanel} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ul className="admin-cl__mobile-list" aria-label="콘텐츠 목록">
                {list.data.items.map((content) => (
                  <li className="admin-cl__content-card" key={content.content_id}>
                    <div className="admin-cl__card-head">
                      <div className="sasu-thumbnail-row">
                        <Thumbnail src={content.thumbnail_url} refreshKey={list.dataUpdatedAt} />
                        <h2>{content.title || '제목 없음'}</h2>
                      </div>
                      <Badge tone={content.status === 'PUBLISHED' ? 'green' : 'neutral'}>
                        {content.status === 'PUBLISHED' ? '공개' : '임시저장'}
                      </Badge>
                    </div>
                    <p className="admin-cl__card-category">
                      {content.category?.name ?? '분야 미지정'}
                    </p>
                    {content.tags.length > 0 && (
                      <p className="admin-cl__card-tags">
                        {content.tags.map((tag) => `#${tag.name}`).join(' ')}
                      </p>
                    )}
                    <ContentActions content={content} onOpen={openPanel} />
                  </li>
                ))}
              </ul>
              <footer className="admin-cl__footer">
                <p className="admin-cl__range">
                  총 <strong>{list.data.total.toLocaleString()}</strong>개 중{' '}
                  <strong>
                    {((page - 1) * PAGE_SIZE + 1).toLocaleString()}–
                    {Math.min(page * PAGE_SIZE, list.data.total).toLocaleString()}
                  </strong>
                </p>
                <nav className="admin-pagination" aria-label="콘텐츠 목록 페이지">
                  <button
                    type="button"
                    className="admin-pagination__arrow"
                    aria-label="이전 페이지"
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                  >
                    <Icon name="chevronLeft" size={17} />
                  </button>
                  {pageNumbers(page, totalPages).map((number) =>
                    typeof number === 'number' ? (
                      <button
                        type="button"
                        key={number}
                        aria-label={`${number}페이지`}
                        aria-current={page === number ? 'page' : undefined}
                        onClick={() => setPage(number)}
                      >
                        {number}
                      </button>
                    ) : (
                      <span key={number} className="admin-pagination__gap" aria-hidden="true">
                        …
                      </span>
                    ),
                  )}
                  <button
                    type="button"
                    className="admin-pagination__arrow"
                    aria-label="다음 페이지"
                    disabled={!list.data.has_next}
                    onClick={() => setPage(page + 1)}
                  >
                    <Icon name="chevronRight" size={17} />
                  </button>
                </nav>
              </footer>
            </>
          )}
        </section>
      </div>
      {panel && (
        <ContentDialog
          content={
            list.data?.items.find((item) => item.content_id === panel.content.content_id) ??
            panel.content
          }
          initialView={panel.view}
          onClose={() => setPanel(null)}
          onDeleted={(pending) => {
            setPanel(null)
            show(contentDeletedMessage(pending), pending ? 'error' : 'ok')
          }}
        />
      )}
      {node}
    </>
  )
}
