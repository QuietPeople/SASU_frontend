import { Skeleton } from '../../shared/Skeleton'
import { ImeInput } from '../../shared/ImeInput'
import { useEffect } from 'react'
import { Thumbnail } from '../../shared/Thumbnail'
import { usePaginationScroll } from '../../shared/usePaginationScroll'
import { useAdminQuery, type AdminCurriculum } from '../../api/admin'
import { queryString, type ApiPage } from '../../api/client'
import { RequestError } from '../../admin/RequestFeedback'
import { Icon } from '../../admin/Icon'
import { Button } from '../../admin/ui'
import { SeriesDialog } from '../../admin/SeriesDialog'
import { AdminPagination } from '../../admin/AdminPagination'
import '../../admin/series.css'
import { useAdminView } from '../../admin/useAdminView'
import { adminPage, adminId, adminFilters } from '../../admin/navigation'

export function SeriesBuilderPage() {
  const [params, setParams] = useAdminView('series')
  const rawEdit = params.get('edit')
  const editing = rawEdit === 'new' ? 'new' : (adminId(rawEdit) ?? null)
  const search = params.get('q') ?? ''
  const page = adminPage(params.get('page'))
  const { attach: paginationRef, preserve: preservePaginationScroll } =
    usePaginationScroll<HTMLElement>(search)
  const list = useAdminQuery<ApiPage<AdminCurriculum>>(
    `/curriculums${queryString({ view: 'editor', q: search.trim() || undefined, page, size: 5 })}`,
  )
  const setEditing = (id: number | 'new' | null) =>
    setParams(adminFilters(params, { edit: id === null ? '' : String(id) }))
  const setSearch = (value: string) => setParams(adminFilters(params, { q: value }), true)
  const setPage = (value: number) => {
    preservePaginationScroll()
    setParams(adminFilters(params, { page: String(value) }))
  }
  const pages = Math.max(1, Math.ceil((list.data?.total ?? 0) / 5))
  useEffect(() => {
    if (list.data && !list.isFetching && page > pages)
      setParams(adminFilters(params, { page: String(pages) }), true)
  }, [list.data, list.isFetching, page, pages, params, setParams])
  return (
    <div className="admin-page admin-series">
      <header className="admin-page__head admin-page__head--row admin-series__page-head">
        <div>
          <p className="admin-eyebrow">관리자 · 시리즈</p>
          <h1 className="admin-title">시리즈 관리</h1>
          <p className="admin-help">콘텐츠를 묶고, 학습할 순서를 구성해요.</p>
        </div>
        <Button variant="primary" onClick={() => setEditing('new')}>
          <Icon name="plus" size={17} />새 시리즈
        </Button>
      </header>
      <section
        ref={paginationRef}
        className="admin-card admin-series__catalog"
        aria-label="시리즈 목록"
      >
        <div className="admin-series__catalog-head">
          <h2>
            시리즈 <span>{list.data?.total ?? '—'}</span>
          </h2>
          <label className="admin-series__search">
            <Icon name="search" size={18} />
            <ImeInput
              type="search"
              aria-label="시리즈 검색"
              placeholder="시리즈 이름·설명 검색"
              maxLength={200}
              value={search}
              onValueChange={setSearch}
            />
          </label>
        </div>
        {list.isPending ? (
          <Skeleton variant="list" />
        ) : (
          list.data && (
            <>
              {!list.data.items.length ? (
                <div className="admin-series__empty">
                  <Icon name="series" size={30} />
                  <strong>{search ? '검색 결과가 없어요.' : '아직 시리즈가 없어요.'}</strong>
                  <p>
                    {search
                      ? '다른 이름으로 검색해 주세요.'
                      : '새 시리즈를 만들고 콘텐츠를 추가해 보세요.'}
                  </p>
                </div>
              ) : (
                <ul className="admin-series__cards">
                  {list.data.items.map((series) => (
                    <li key={series.curriculum_id}>
                      <button
                        type="button"
                        className="admin-series__series-card"
                        onClick={() => setEditing(series.curriculum_id)}
                        aria-label={`${series.title} 편집`}
                      >
                        <Thumbnail src={series.thumbnail_url} refreshKey={list.dataUpdatedAt} />
                        <span className="admin-series__series-info">
                          <strong>{series.title}</strong>
                          {series.description && (
                            <span className="admin-series__description">{series.description}</span>
                          )}
                          <span className="admin-series__series-count">
                            {series.total_steps}개 콘텐츠{' '}
                            <span>· 학습자 시청 가능 {series.available_steps}개</span>
                          </span>
                        </span>
                        <span className="admin-series__edit-label">
                          편집 <Icon name="chevronRight" size={17} />
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {list.data.total > 0 && (
                <AdminPagination
                  page={list.data.page}
                  size={5}
                  total={list.data.total}
                  hasNext={list.data.has_next}
                  disabled={list.isFetching}
                  label="시리즈 목록 페이지"
                  onChange={setPage}
                />
              )}
            </>
          )
        )}
        {list.error && (
          <RequestError
            title="시리즈 목록을 불러오지 못했어요."
            variant={list.data ? 'toast' : 'screen'}
            error={list.error}
            action={<Button onClick={() => void list.refetch()}>다시 시도</Button>}
          />
        )}
      </section>
      {rawEdit && editing === null && (
        <RequestError
          title="올바른 시리즈 편집 주소가 아니에요."
          action={<Button onClick={() => setEditing(null)}>목록으로</Button>}
        />
      )}
      {editing !== null && (
        <SeriesDialog
          key={editing}
          id={editing}
          onClose={() => setEditing(null)}
          onSavedId={(id) => {
            if (editing === 'new') setParams(adminFilters(params, { edit: String(id) }), true)
          }}
        />
      )}
    </div>
  )
}
