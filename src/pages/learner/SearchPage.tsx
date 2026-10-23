import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router'
import { api, queryString, type ApiPage } from '../../api/client'
import { categoryId, pageNumber, useCategories, type LearnerContent } from '../../api/learner'
import { useSession } from '../../state/session'
import { Button, StateBlock } from '../../shared/ui'

export function SearchPage() {
  const { actorId, learnerId, generation, isPending, error } = useSession()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const searchForm = useRef<HTMLFormElement>(null)
  const q = (params.get('q') ?? '').trim()
  const catId = categoryId(params.get('cat'))
  const page = pageNumber(params.get('page'))
  const categories = useCategories(actorId, generation)
  const results = useQuery({
    queryKey: ['learner', 'search', actorId, learnerId, generation, q, catId, page],
    queryFn: ({ signal }) =>
      api<ApiPage<LearnerContent>>(
        `/contents${queryString({ q, category_id: catId, status: 'PUBLISHED', user_id: learnerId, page, size: 20 })}`,
        { actorId, signal },
      ),
    enabled: actorId !== null && learnerId !== null && Boolean(q),
  })
  const search = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const next = new URLSearchParams()
    const term = String(form.get('q') ?? '').trim()
    const category = String(form.get('cat') ?? '')
    if (term) next.set('q', term)
    if (category) next.set('cat', category)
    setParams(next)
  }
  const goPage = (next: number) => {
    const query = new URLSearchParams(params)
    query.set('page', String(next))
    setParams(query)
  }
  const reset = () => {
    searchForm.current?.reset()
    setParams(new URLSearchParams())
  }
  const rows = results.data?.items ?? []
  return (
    <div className="sasu-page sasu-search">
      <header className="sasu-page__head">
        <p className="sasu-eyebrow">학습자 · 검색</p>
        <h1 className="sasu-title">검색</h1>
      </header>
      <form
        ref={searchForm}
        key={`${q}:${catId ?? ''}:${categories.isPending}`}
        className="sasu-search__bar"
        onSubmit={search}
      >
        <label className="sasu-field">
          <span className="sasu-sr">검색어</span>
          <input
            name="q"
            className="sasu-input"
            defaultValue={q}
            maxLength={200}
            placeholder="제목·태그·핵심 정리로 검색"
          />
        </label>
        <label className="sasu-field sasu-field--sm">
          <span className="sasu-sr">분야</span>
          <select
            name="cat"
            className="sasu-input"
            defaultValue={catId ?? ''}
            disabled={categories.isPending}
          >
            <option value="">분야 전체</option>
            {categories.data?.items.map((cat) => (
              <option key={cat.category_id} value={cat.category_id}>
                {cat.name}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" variant="primary">
          검색
        </Button>
        <Button onClick={reset}>조건 초기화</Button>
      </form>
      {categories.error ? (
        <StateBlock
          title="분야를 불러오지 못했어요."
          text={categories.error.message}
          action={<Button onClick={() => void categories.refetch()}>다시 시도</Button>}
        />
      ) : null}
      {isPending ? (
        <StateBlock title="사용자를 불러오는 중이에요." />
      ) : error ? (
        <StateBlock title="사용자 정보를 불러오지 못했어요." text={error.message} />
      ) : learnerId === null ? (
        <StateBlock title="학습자를 선택해 주세요." />
      ) : !q ? (
        <StateBlock
          title="검색어를 입력해 주세요."
          text="제목 → 태그 → 핵심 정리 순으로 일치하는 공개 콘텐츠를 보여 줘요."
        />
      ) : results.isPending ? (
        <StateBlock title="검색 결과를 불러오는 중이에요." />
      ) : results.error ? (
        <StateBlock
          title="검색 결과를 불러오지 못했어요."
          text={results.error.message}
          action={<Button onClick={() => void results.refetch()}>다시 시도</Button>}
        />
      ) : (
        <>
          <p className="sasu-search__summary">
            검색 결과 {results.data?.total ?? 0}개 · 제목 → 태그 → 핵심 정리 일치순
            {catId
              ? ` · ${categories.data?.items.find((cat) => cat.category_id === catId)?.name ?? '선택한 분야'}`
              : ''}
          </p>
          {rows.length === 0 ? (
            <EmptySearchResult
              key={`${actorId}:${generation}:${q}:${catId}:${page}`}
              actorId={actorId!}
              learnerId={learnerId}
              generation={generation!}
              onReset={reset}
            />
          ) : (
            <ul className="sasu-result-list">
              {rows.map((content) => (
                <li key={content.content_id}>
                  <button
                    type="button"
                    className="sasu-result-card"
                    onClick={() =>
                      navigate(`/learner/watch/${content.content_id}`, {
                        state: {
                          context: 'SEARCH',
                          returnTo: `/learner/search?${params}`,
                          contentIds: rows.map((row) => row.content_id),
                        },
                      })
                    }
                  >
                    <span className="sasu-result-card__thumb" aria-hidden="true">
                      {content.tags[0]?.name ?? content.title?.slice(0, 2)}
                    </span>
                    <span className="sasu-result-card__body">
                      <span className="sasu-result-card__title">{content.title}</span>
                      <span className="sasu-result-card__meta">
                        {content.category?.name ?? '분야 없음'}
                      </span>
                      <span className="sasu-result-card__summary">
                        {content.tags.map((tag) => `#${tag.name}`).join(' ')}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {results.data && (page > 1 || results.data.has_next) ? (
            <div className="sasu-row" aria-label="검색 결과 페이지">
              <Button disabled={page === 1 || results.isFetching} onClick={() => goPage(page - 1)}>
                이전
              </Button>
              <span>{results.data.page} 페이지</span>
              <Button
                disabled={!results.data.has_next || results.isFetching}
                onClick={() => goPage(page + 1)}
              >
                다음
              </Button>
            </div>
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
        <p role="alert">
          {error.message}{' '}
          <Button loading={isPending} onClick={() => mutate()}>
            이용 기록 다시 저장
          </Button>
        </p>
      ) : null}
    </>
  )
}
