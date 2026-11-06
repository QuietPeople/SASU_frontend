import { contentStatusLabel } from './contentStatus'
import { Skeleton } from '../shared/Skeleton'
import { ImeInput } from '../shared/ImeInput'
import { Thumbnail } from '../shared/Thumbnail'
import { usePaginationScroll } from '../shared/usePaginationScroll'
import { useEffect } from 'react'
import { type ApiPage } from '../api/client'
import { useAdminQuery, type AdminContent, type AdminCategory } from '../api/admin'
import { useAdminView } from './useAdminView'
import {
  adminFilters,
  adminPage,
  adminStatus,
  adminId,
  adminMissing,
  adminContentListPath,
  CONTENT_MISSING_OPTIONS,
} from './navigation'
import { ContentFilter } from './ContentFilter'
import { Icon } from './Icon'
import { pageNumbers } from './pagination'
import { RequestError } from './RequestFeedback'
import { Button, StateBlock } from './ui'
import './content-list.css'
import './content-target-picker.css'

const PAGE_SIZE = 5
const STATUSES = [
  { id: 'ALL', label: '전체' },
  { id: 'PUBLISHED', label: '공개' },
  { id: 'PRIVATE', label: '비공개' },
  { id: 'DRAFT', label: '임시저장' },
]

export function ContentTargetPicker({ onSelect }: { onSelect: (content: AdminContent) => void }) {
  const [params, setParams] = useAdminView('materials')
  const term = params.get('q') ?? ''
  const page = adminPage(params.get('page'))
  const status = adminStatus(params.get('status'))
  const category = adminId(params.get('category_id'))
  const missing = adminMissing(params.get('missing'))
  const { attach: paginationRef, preserve: preservePaginationScroll } =
    usePaginationScroll<HTMLElement>(`${term}:${status}:${category}:${missing}`)
  const list = useAdminQuery<ApiPage<AdminContent>>(
    adminContentListPath(params, { size: PAGE_SIZE }),
  )
  const totalPages = Math.max(1, Math.ceil((list.data?.total ?? 0) / PAGE_SIZE))
  useEffect(() => {
    if (list.data && page > totalPages)
      setParams(adminFilters(params, { page: String(totalPages) }), true)
  }, [list.data, page, totalPages, params, setParams])
  const categories = useAdminQuery<{ items: AdminCategory[] }>('/categories')
  const filtered = !!(term || category || missing || status !== 'ALL')
  const change = (values: Record<string, string>) => {
    if ('page' in values) preservePaginationScroll()
    setParams(adminFilters(params, values), true)
  }
  const goPage = (next: number) => {
    if (next === page || list.isFetching) return
    change({ page: String(next) })
  }
  const reset = () => setParams(new URLSearchParams(), true)
  return (
    <section ref={paginationRef} className="admin-target-picker" aria-label="학습자료 콘텐츠 목록">
      <form
        className="admin-target-picker__toolbar"
        role="search"
        aria-label="학습자료 콘텐츠 검색"
        onSubmit={(event) => {
          event.preventDefault()
          change({ q: term.trim() })
        }}
      >
        <div className="admin-target-picker__search-row">
          <label className="admin-target-picker__search">
            <Icon name="search" size={20} />
            <span className="admin-sr">콘텐츠 검색어</span>
            <ImeInput
              type="search"
              value={term}
              maxLength={200}
              onValueChange={(q) => change({ q })}
              placeholder="제목, 태그, 핵심 내용으로 콘텐츠 검색"
            />
          </label>
          <Button type="submit" variant="primary">
            검색
          </Button>
        </div>
        <div className="admin-target-picker__filters">
          <ContentFilter
            id="material-filter-category"
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
            onChange={(category_id) => change({ category_id })}
          />
          <ContentFilter
            id="material-filter-status"
            label="공개 상태"
            value={status}
            options={STATUSES}
            onChange={(status) => change({ status })}
          />
          <ContentFilter
            id="material-filter-missing"
            label="미등록 항목"
            value={missing ?? ''}
            options={CONTENT_MISSING_OPTIONS.map(({ value, label }) => ({ id: value, label }))}
            onChange={(missing) => change({ missing })}
          />
        </div>
      </form>
      {categories.isError && (
        <RequestError
          title="분야를 불러오지 못했어요."
          error={categories.error}
          action={<Button onClick={() => void categories.refetch()}>다시 시도</Button>}
        />
      )}
      <div className="admin-target-picker__heading">
        <h2>
          {term.trim() ? '검색 결과' : '콘텐츠 목록'}
          <span>{list.data?.total.toLocaleString() ?? '—'}</span>
        </h2>
        {filtered && (
          <button type="button" className="admin-target-picker__reset" onClick={reset}>
            <Icon name="reset" size={14} /> 조건 초기화
          </button>
        )}
      </div>
      {list.isPending ? (
        <div className="admin-target-picker__state">
          <Skeleton variant="list" count={PAGE_SIZE} />
        </div>
      ) : list.isError ? (
        <RequestError
          variant="screen"
          title="학습자료 콘텐츠를 불러오지 못했어요."
          error={list.error}
          action={<Button onClick={() => void list.refetch()}>다시 시도</Button>}
        />
      ) : !list.data.items.length ? (
        <div className="admin-target-picker__state">
          <StateBlock
            title={filtered ? '조건에 맞는 콘텐츠가 없어요.' : '등록된 콘텐츠가 없어요.'}
            text={
              filtered
                ? '검색어 또는 필터를 바꿔 보세요.'
                : '콘텐츠를 등록하면 여기에서 퀴즈를 작성할 수 있어요.'
            }
            action={filtered ? <Button onClick={reset}>조건 초기화</Button> : undefined}
          />
        </div>
      ) : (
        <>
          <ul className="admin-target-picker__list" aria-label="콘텐츠별 학습자료">
            {list.data.items.map((item) => (
              <li key={item.content_id} className="admin-target-picker__item">
                <Thumbnail
                  src={item.thumbnail_url}
                  refreshKey={list.dataUpdatedAt}
                  className="admin-target-picker__thumbnail"
                />
                <div className="admin-target-picker__body">
                  <span
                    className={`admin-target-picker__quiz ${item.has_quiz ? 'is-registered' : 'is-missing'}`}
                  >
                    퀴즈 {item.has_quiz ? '등록' : '미등록'}
                  </span>
                  <h3>
                    <button type="button" aria-haspopup="dialog" onClick={() => onSelect(item)}>
                      {item.title || '제목 없음'}
                    </button>
                  </h3>
                  <div className="admin-target-picker__meta">
                    <span className="admin-target-picker__category">
                      {item.category?.name ?? '분야 미지정'}
                    </span>
                    <span>{contentStatusLabel(item.status)}</span>
                  </div>
                  {item.tags.length > 0 && (
                    <p className="admin-target-picker__tags">
                      {item.tags.map((tag) => `#${tag.name}`).join(' ')}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  className={`admin-btn ${item.has_quiz ? 'admin-btn--default' : 'admin-btn--primary'} admin-target-picker__edit`}
                  aria-haspopup="dialog"
                  aria-label={`${item.title || '제목 없음'} ${item.has_quiz ? '퀴즈 편집' : '퀴즈 작성'}`}
                  onClick={() => onSelect(item)}
                >
                  {item.has_quiz ? '편집' : '퀴즈 작성'}
                  <Icon name="chevronRight" size={16} />
                </button>
              </li>
            ))}
          </ul>
          <footer className="admin-target-picker__footer">
            <p className="admin-cl__range">
              총 <strong>{list.data.total.toLocaleString()}</strong>개 중{' '}
              <strong>
                {((page - 1) * PAGE_SIZE + 1).toLocaleString()}–
                {Math.min(page * PAGE_SIZE, list.data.total).toLocaleString()}
              </strong>
            </p>
            <nav className="admin-pagination" aria-label="학습자료 목록 페이지">
              <button
                type="button"
                className="admin-pagination__arrow"
                aria-label="이전 페이지"
                disabled={page === 1 || list.isFetching}
                onClick={() => goPage(page - 1)}
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
                    disabled={list.isFetching}
                    onClick={() => goPage(number)}
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
                disabled={!list.data.has_next || list.isFetching}
                onClick={() => goPage(page + 1)}
              >
                <Icon name="chevronRight" size={17} />
              </button>
            </nav>
          </footer>
        </>
      )}
    </section>
  )
}
