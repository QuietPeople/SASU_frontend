import { Skeleton } from '../../shared/Skeleton'
import { useQuery } from '@tanstack/react-query'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import { api, queryString, type ApiPage } from '../../api/client'
import { pageNumber, type CurriculumSummary } from '../../api/learner'
import { useListMemory } from '../../features/learner-navigation/useListMemory'
import { LearnerState as StateBlock } from '../../learner/LearnerState'
import { LiveSearchInput } from '../../learner/LiveSearchInput'
import { MenuIcon } from '../../learner/MenuIcon'
import { SeriesDetailDialog } from '../../learner/SeriesDetailDialog'
import { Button } from '../../learner/ui'
import { Thumbnail } from '../../shared/Thumbnail'
import { usePaginationScroll } from '../../shared/usePaginationScroll'
import { Pagination } from '../../learner/Pagination'
import { useSession } from '../../state/session'
import '../../learner/series.css'

export function SeriesPage() {
  const { actorId, learnerId, generation, isPending, error } = useSession()
  const navigate = useNavigate()
  const location = useLocation()
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const page = pageNumber(params.get('page'))
  const rawQuery = params.get('q') ?? ''
  const q = rawQuery.trim()
  const enabled = actorId !== null && learnerId !== null
  const list = useQuery({
    queryKey: ['learner', 'curriculums', actorId, learnerId, generation, q, page, 5],
    queryFn: ({ signal }) =>
      api<ApiPage<CurriculumSummary>>(
        `/curriculums${queryString({ view: 'learner', user_id: learnerId, q: q || undefined, page, size: 5 })}`,
        { actorId, signal },
      ),
    enabled,
  })
  const { attach: paginationRef, preserve: preservePaginationScroll } =
    usePaginationScroll<HTMLElement>(`${actorId}:${learnerId}:${generation}:${q}`)
  const memory = useListMemory(
    `${actorId}:${learnerId}:${generation}`,
    'series',
    params.toString(),
    list.isSuccess && !id,
  )
  const openSeries = (seriesId: number) => {
    memory.remember(seriesId)
    navigate(`/learner/series/${seriesId}${params.size ? `?${params}` : ''}`, {
      state: { fromSeriesList: true },
    })
  }
  const closeSeries = () => {
    if (location.state?.fromSeriesList) navigate(-1)
    else navigate(`/learner/series${params.size ? `?${params}` : ''}`, { replace: true })
  }
  const goPage = (next: number) => {
    const query = new URLSearchParams(params)
    query.set('page', String(next))
    preservePaginationScroll()
    memory.preserveScroll()
    setParams(query)
  }
  return (
    <div className="sasu-page learner-series">
      <header className="sasu-page__head">
        <p className="sasu-eyebrow">학습자 · 시리즈</p>
        <h1 className="sasu-title">시리즈</h1>
        <p className="sasu-sub">함께 배우면 좋은 영상을 모았어요. 원하는 시리즈를 선택해 보세요.</p>
      </header>
      <section ref={paginationRef} className="learner-series__catalog" aria-label="시리즈 목록">
        <div className="learner-series__catalog-head">
          <h2>
            시리즈 <span>{list.data?.total ?? '—'}</span>
          </h2>
          <label className="learner-series__search">
            <MenuIcon name="search" size={18} />
            <LiveSearchInput
              type="search"
              aria-label="시리즈 검색"
              placeholder="시리즈 이름·설명 검색"
              maxLength={200}
              value={rawQuery}
              onValueChange={(value) => {
                const next = new URLSearchParams(params)
                if (value) next.set('q', value)
                else next.delete('q')
                next.delete('page')
                memory.reset()
                setParams(next, { replace: true })
              }}
            />
          </label>
        </div>
        {q && (
          <p className="learner-series__search-summary" aria-live="polite">
            “{q}” 검색 결과
          </p>
        )}
        {isPending || (enabled && list.isPending) ? (
          <div className="learner-series__loading">
            <Skeleton variant="list" label="시리즈를 불러오는 중" />
          </div>
        ) : error ? (
          <StateBlock title="사용자 정보를 불러오지 못했어요." error={error} />
        ) : !enabled ? (
          <StateBlock title="학습자를 선택해 주세요." />
        ) : list.error ? (
          <StateBlock
            title="시리즈를 불러오지 못했어요."
            error={list.error}
            action={<Button onClick={() => void list.refetch()}>다시 시도</Button>}
          />
        ) : (
          <>
            {!list.data?.items.length ? (
              <StateBlock
                title={q ? '검색 결과가 없어요.' : '아직 시리즈가 없어요.'}
                text={
                  q
                    ? '시리즈 이름이나 설명의 다른 단어로 검색해 보세요.'
                    : '새로운 시리즈가 준비되면 여기서 확인할 수 있어요.'
                }
                action={
                  q ? (
                    <Button onClick={() => setParams(new URLSearchParams())}>검색 초기화</Button>
                  ) : undefined
                }
              />
            ) : (
              <ul className="learner-series__list" aria-label="학습 시리즈 목록">
                {list.data.items.map((series) => (
                  <li key={series.curriculum_id}>
                    <button
                      data-list-item={series.curriculum_id}
                      type="button"
                      className="learner-series__card"
                      aria-label={`${series.title} 학습 내용 보기`}
                      aria-haspopup="dialog"
                      onClick={() => openSeries(series.curriculum_id)}
                    >
                      <Thumbnail src={series.thumbnail_url} refreshKey={list.dataUpdatedAt} />
                      <span className="learner-series__info">
                        <strong>{series.title}</strong>
                        {series.description && (
                          <span className="learner-series__description">{series.description}</span>
                        )}
                        <span className="learner-series__counts">
                          영상 {series.total_steps}개{' '}
                          <span>· 학습 완료 {series.completed_steps ?? '—'}개</span>
                        </span>
                        <span className="learner-series__progress-line">
                          <span className="learner-series__track" aria-hidden="true">
                            <span
                              style={{
                                width: `${Math.min(100, Math.max(0, series.progress_percent ?? 0))}%`,
                              }}
                            />
                          </span>
                          <span>진행률 {series.progress_percent ?? '—'}%</span>
                        </span>
                      </span>
                      <span className="learner-series__open-label">
                        학습 내용 <Arrow />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {list.data && (list.data.total > 0 || page > 1) && (
              <Pagination
                page={page}
                size={5}
                total={list.data.total}
                hasNext={list.data.has_next}
                disabled={list.isFetching}
                label="시리즈 페이지"
                onChange={goPage}
              />
            )}
          </>
        )}
      </section>
      {id && (
        <SeriesDetailDialog
          key={`${actorId}:${learnerId}:${generation}:${id}`}
          id={Number(id)}
          listQuery={params.toString()}
          onClose={closeSeries}
        />
      )}
    </div>
  )
}

function Arrow({ backwards = false }: { backwards?: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={backwards ? 'm14 6-6 6 6 6' : 'm10 6 6 6-6 6'} />
    </svg>
  )
}
