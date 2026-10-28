import { useState } from 'react'
import { useAdminPages, type AdminCurriculum } from '../../api/admin'
import { RequestError } from '../../admin/RequestFeedback'
import { Icon } from '../../admin/Icon'
import { Button, Spinner } from '../../admin/ui'
import { SeriesDialog } from '../../admin/SeriesDialog'
import '../../admin/series.css'

export function SeriesBuilderPage() {
  const list = useAdminPages<AdminCurriculum>('/curriculums?view=editor')
  const [editing, setEditing] = useState<number | 'new' | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const matches = (list.data ?? []).filter((series) =>
    `${series.title} ${series.description ?? ''}`
      .toLocaleLowerCase()
      .includes(search.trim().toLocaleLowerCase()),
  )
  const pages = Math.max(1, Math.ceil(matches.length / 5))
  const currentPage = Math.min(page, pages)
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
      <section className="admin-card admin-series__catalog" aria-label="시리즈 목록">
        <div className="admin-series__catalog-head">
          <h2>
            시리즈 <span>{list.data?.length ?? '—'}</span>
          </h2>
          <label className="admin-series__search">
            <Icon name="search" size={18} />
            <input
              type="search"
              aria-label="시리즈 검색"
              placeholder="시리즈 이름 검색"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
            />
          </label>
        </div>
        {list.isPending ? (
          <Spinner />
        ) : (
          list.data && (
            <>
              {!matches.length ? (
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
                  {matches.slice((currentPage - 1) * 5, currentPage * 5).map((series) => (
                    <li key={series.curriculum_id}>
                      <button
                        type="button"
                        className="admin-series__series-card"
                        onClick={() => setEditing(series.curriculum_id)}
                        aria-label={`${series.title} 편집`}
                      >
                        <span className="admin-series__series-icon">
                          <Icon name="series" size={22} />
                        </span>
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
              {pages > 1 && (
                <nav className="admin-series__pagination" aria-label="시리즈 목록 페이지">
                  <button
                    type="button"
                    aria-label="이전 시리즈 페이지"
                    disabled={currentPage === 1}
                    onClick={() => setPage(currentPage - 1)}
                  >
                    <Icon name="chevronLeft" size={18} />
                  </button>
                  <span>
                    {currentPage} / {pages}
                  </span>
                  <button
                    type="button"
                    aria-label="다음 시리즈 페이지"
                    disabled={currentPage === pages}
                    onClick={() => setPage(currentPage + 1)}
                  >
                    <Icon name="chevronRight" size={18} />
                  </button>
                </nav>
              )}
            </>
          )
        )}
        {list.error && (
          <RequestError
            title="시리즈 목록을 불러오지 못했어요."
            error={list.error}
            action={<Button onClick={() => void list.refetch()}>다시 시도</Button>}
          />
        )}
      </section>
      {editing !== null && (
        <SeriesDialog key={editing} id={editing} onClose={() => setEditing(null)} />
      )}
    </div>
  )
}
