import { ContentDialog } from '../../admin/ContentDialog'
import type { ContentSubviewKind } from '../../admin/contentSubview'
import { RequestError } from '../../admin/RequestFeedback'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { type ApiPage, queryString } from '../../api/client'
import { type AdminContent, useAdminQuery } from '../../api/admin'
import { Badge, Button, Spinner, StateBlock } from '../../admin/ui'
import { Icon, type IconName } from '../../admin/Icon'
import { pageNumbers } from '../../admin/pagination'
import '../../admin/content-list.css'

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

const PAGE_SIZE = 10

export function ContentListPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('ALL')
  const [page, setPage] = useState(1)
  const [panel, setPanel] = useState<{ content: AdminContent; view: ContentSubviewKind } | null>(
    null,
  )
  const openPanel = (content: AdminContent, view: ContentSubviewKind) => setPanel({ content, view })
  const list = useAdminQuery<ApiPage<AdminContent>>(
    `/contents${queryString({ q: query.trim() || undefined, status, page, size: PAGE_SIZE })}`,
  )
  const all = useAdminQuery<ApiPage<AdminContent>>('/contents?status=ALL&size=1')
  const published = useAdminQuery<ApiPage<AdminContent>>('/contents?status=PUBLISHED&size=1')
  const drafts = useAdminQuery<ApiPage<AdminContent>>('/contents?status=DRAFT&size=1')
  const reset = () => {
    setQuery('')
    setStatus('ALL')
    setPage(1)
  }
  const selectStatus = (next: string) => {
    setStatus(next)
    setPage(1)
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
        <section className="admin-cl__panel" aria-label="콘텐츠 검색 결과">
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
              <input
                type="search"
                aria-label="콘텐츠 검색어"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value)
                  setPage(1)
                }}
                placeholder="제목, 태그, 핵심 내용 검색"
              />
            </div>
            <div className="admin-cl__filter">
              <label htmlFor="admin-content-status">상태</label>
              <div className="admin-cl__select">
                <select
                  id="admin-content-status"
                  value={status}
                  onChange={(event) => selectStatus(event.target.value)}
                >
                  <option value="ALL">전체</option>
                  <option value="PUBLISHED">공개</option>
                  <option value="DRAFT">임시저장</option>
                </select>
                <span className="admin-cl__filter-chevron">
                  <Icon name="chevronDown" size={16} />
                </span>
              </div>
            </div>
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
            {query || status !== 'ALL' ? (
              <button type="button" onClick={reset}>
                <Icon name="reset" size={14} /> 조건 초기화
              </button>
            ) : null}
          </div>
          {list.isPending ? (
            <div className="admin-cl__loading">
              <Spinner label="목록을 불러오는 중" />
              <span>콘텐츠를 불러오고 있어요</span>
            </div>
          ) : list.isError ? (
            <RequestError
              title="목록을 불러오지 못했어요."
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
                          <span className="admin-table__title">{c.title || '제목 없음'}</span>
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
                      <h2>{content.title || '제목 없음'}</h2>
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
        />
      )}
    </>
  )
}
