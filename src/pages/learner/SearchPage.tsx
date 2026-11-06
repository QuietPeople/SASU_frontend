import { Skeleton } from '../../shared/Skeleton'
import { Thumbnail } from '../../shared/Thumbnail'
import { usePaginationScroll } from '../../shared/usePaginationScroll'
import { useEffect, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router'
import { api, queryString, type ApiPage } from '../../api/client'
import { categoryId, pageNumber, useCategories, type LearnerContent } from '../../api/learner'
import { useSession } from '../../state/session'
import { Button } from '../../learner/ui'
import { SearchFilters } from '../../learner/SearchFilters'
import { Pagination } from '../../learner/Pagination'
import { LearnerState as StateBlock } from '../../learner/LearnerState'
import { useListMemory } from '../../features/learner-navigation/useListMemory'
import '../../learner/navigation.css'
import '../../learner/search.css'

export function SearchPage() {
  const { actorId, learnerId, generation, isPending, error } = useSession()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const rawQuery = params.get('q') ?? ''
  const q = rawQuery.trim()
  const catId = categoryId(params.get('cat'))
  const page = pageNumber(params.get('page'))
  const { attach: paginationRef, preserve: preservePaginationScroll } =
    usePaginationScroll<HTMLDivElement>(`${actorId}:${learnerId}:${generation}:${q}:${catId}`)
  const categories = useCategories(actorId, generation)
  const results = useQuery({
    queryKey: ['learner', 'search', actorId, learnerId, generation, q, catId, page, 5],
    queryFn: ({ signal }) =>
      api<ApiPage<LearnerContent>>(
        `/contents${queryString({ q, category_id: catId, status: 'PUBLISHED', user_id: learnerId, page, size: 5 })}`,
        { actorId, signal },
      ),
    enabled: actorId !== null && learnerId !== null && generation !== null && Boolean(q || catId),
  })
  const memory = useListMemory(
    `${actorId}:${learnerId}:${generation}`,
    'search',
    params.toString(),
    results.isSuccess,
  )
  const updateFilter = (name: 'q' | 'cat', value: string) => {
    const next = new URLSearchParams(params)
    next.delete('page')
    if (value) next.set(name, value)
    else next.delete(name)
    memory.reset()
    setParams(next, { replace: name === 'q' })
  }
  const goPage = (next: number) => {
    preservePaginationScroll()
    memory.preserveScroll()
    const query = new URLSearchParams(params)
    query.set('page', String(next))
    setParams(query)
  }
  const reset = () => {
    memory.reset()
    setParams(new URLSearchParams())
  }
  const rows = results.data?.items ?? []
  return (
    <div ref={paginationRef} className="sasu-page learner-search">
      <header className="sasu-page__head">
        <p className="sasu-eyebrow">학습자 · 검색</p>
        <h1 className="sasu-title">검색</h1>
        <p className="sasu-sub">제목·태그·핵심 정리로 공개 영상을 찾아요.</p>
      </header>
      <SearchFilters
        query={rawQuery}
        categoryId={catId}
        categories={categories.data?.items ?? []}
        pending={categories.isPending}
        onQueryChange={(value) => updateFilter('q', value)}
        onCategoryChange={(value) => updateFilter('cat', value)}
        onReset={reset}
      />
      {categories.error ? (
        <StateBlock
          title="분야를 불러오지 못했어요."
          variant="toast"
          error={categories.error}
          action={<Button onClick={() => void categories.refetch()}>다시 시도</Button>}
        />
      ) : null}
      {isPending ? (
        <Skeleton variant="list" label="사용자를 불러오는 중이에요." />
      ) : error ? (
        <StateBlock title="사용자 정보를 불러오지 못했어요." error={error} />
      ) : learnerId === null ? (
        <StateBlock title="학습자를 선택해 주세요." />
      ) : !q && !catId ? (
        <StateBlock
          title="검색어를 입력하거나 분야를 선택해 주세요."
          text="검색어가 없어도 분야를 선택하면 해당 분야의 공개 영상을 둘러볼 수 있어요."
          action={<Button onClick={() => navigate('/learner/series')}>시리즈 둘러보기</Button>}
        />
      ) : results.isPending ? (
        <Skeleton variant="list" label="검색 결과를 불러오는 중이에요." />
      ) : results.error ? (
        <StateBlock
          title="검색 결과를 불러오지 못했어요."
          error={results.error}
          action={<Button onClick={() => void results.refetch()}>다시 시도</Button>}
        />
      ) : (
        <>
          <div className="learner-search__results-head" aria-live="polite">
            <div>
              <h2>
                {q ? (
                  <>
                    <span>“{q}”</span> 검색 결과
                  </>
                ) : (
                  '분야별 영상'
                )}{' '}
                <span className="learner-search__count">
                  {(results.data?.total ?? 0).toLocaleString()}
                </span>
              </h2>
              {catId && (
                <p>
                  {categories.data?.items.find((cat) => cat.category_id === catId)?.name ??
                    '선택한 분야'}
                </p>
              )}
            </div>
            <span className="learner-search__sort">
              {q ? '제목 · 태그 · 핵심 정리 일치순' : '최근 공개순'}
            </span>
          </div>
          {rows.length === 0 ? (
            <EmptySearchResult
              key={`${actorId}:${generation}:${q}:${catId}:${page}`}
              actorId={actorId!}
              learnerId={learnerId}
              generation={generation!}
              onReset={reset}
            />
          ) : (
            <ul className="learner-search__results">
              {rows.map((content) => (
                <li key={content.content_id}>
                  <button
                    type="button"
                    className="learner-search__card"
                    data-list-item={content.content_id}
                    onClick={() => {
                      memory.remember(content.content_id)
                      navigate(`/learner/feed?start=${content.content_id}`, {
                        state: { returnTo: `/learner/search?${params}` },
                      })
                    }}
                  >
                    <span className="learner-search__poster">
                      <Thumbnail
                        src={content.thumbnail_url}
                        refreshKey={results.dataUpdatedAt}
                        className="learner-search__thumbnail"
                      />
                      <span className="learner-search__play" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                          <path d="m9 5 11 7-11 7z" />
                        </svg>
                      </span>
                    </span>
                    <span className="learner-search__card-body">
                      <span className="learner-search__card-meta">
                        <span className="learner-search__category-name">
                          {content.category?.name ?? '분야 없음'}
                        </span>
                        {content.watch_completed && (
                          <span className="learner-search__watched">시청 완료</span>
                        )}
                      </span>
                      <span className="learner-search__card-title">
                        {content.title || '제목 없음'}
                      </span>
                      {content.tags.length > 0 && (
                        <span className="learner-search__tags">
                          {content.tags.map((tag) => `#${tag.name}`).join('  ')}
                        </span>
                      )}
                      <span className="learner-search__card-foot">
                        <span>조회수 {content.view_count.toLocaleString()}</span>
                        <span className="learner-search__watch">
                          학습하기{' '}
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.7"
                            aria-hidden="true"
                          >
                            <path d="M5 12h14m-5-5 5 5-5 5" />
                          </svg>
                        </span>
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {results.data && results.data.total > 0 ? (
            <Pagination
              page={results.data.page}
              size={5}
              total={results.data.total}
              hasNext={results.data.has_next}
              disabled={results.isFetching}
              label="검색 결과 페이지"
              onChange={goPage}
            />
          ) : null}
        </>
      )}
    </div>
  )
}

function EmptySearchResult({
  actorId,
  learnerId,
  generation,
  onReset,
}: {
  actorId: number
  learnerId: number
  generation: number
  onReset: () => void
}) {
  const [eventId] = useState(() => crypto.randomUUID())
  const { mutate, isError, isPending, error } = useMutation({
    mutationFn: () =>
      api(`/users/${learnerId}/events`, {
        method: 'POST',
        actorId,
        generation,
        body: { client_event_id: eventId, event_type: 'SEARCH_EMPTY' },
      }),
  })
  useEffect(() => {
    mutate()
  }, [mutate])
  return (
    <>
      <StateBlock
        title="검색 결과가 없어요."
        text="검색어를 줄이거나 분야를 바꿔 보세요."
        action={<Button onClick={onReset}>조건 초기화</Button>}
      />
      {isError ? (
        <StateBlock
          variant="toast"
          title="검색 이용 기록을 저장하지 못했어요."
          error={error}
          action={
            <Button loading={isPending} onClick={() => mutate()}>
              이용 기록 다시 저장
            </Button>
          }
        />
      ) : null}
    </>
  )
}
