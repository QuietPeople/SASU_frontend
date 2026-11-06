import { Skeleton } from '../../shared/Skeleton'
import { SearchFilters } from '../../learner/SearchFilters'
import { SegmentedTabs } from '../../learner/SegmentedTabs'
import { FlashcardGallery } from '../../learner/FlashcardGallery'
import { Thumbnail } from '../../shared/Thumbnail'
import { usePaginationScroll } from '../../shared/usePaginationScroll'
import { Pagination } from '../../learner/Pagination'
import { useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router'
import { api, queryString, type ApiPage } from '../../api/client'
import type { LearningIdentity } from '../../api/learning'
import { invalidateLearnerReaction } from '../../api/queryInvalidation'
import {
  categoryId,
  pageNumber,
  useCategories,
  type SavedContent,
  type WrongAnswer,
  type Flashcard,
} from '../../api/learner'
import { useSession } from '../../state/session'
import { Button } from '../../learner/ui'
import { LearnerState as StateBlock } from '../../learner/LearnerState'
import { useToast } from '../../learner/useToast'

import { learnerErrorMessage, libraryParams } from '../../features/learner-navigation/state'
import { useListMemory } from '../../features/learner-navigation/useListMemory'
import '../../learner/navigation.css'

type Tab = 'saved' | 'wrong' | 'cards'
const TABS: { id: Tab; label: string }[] = [
  { id: 'saved', label: '저장 영상' },
  { id: 'wrong', label: '오답 복습' },
  { id: 'cards', label: '플래시카드' },
]

export function LibraryPage() {
  const {
    actorId,
    learnerId,
    generation,
    isPending,
    error: sessionError,
    refreshSettings,
  } = useSession()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { show, node } = useToast()
  const unsavingRef = useRef(false)
  const tab = (
    TABS.some((item) => item.id === params.get('tab')) ? params.get('tab') : 'saved'
  ) as Tab
  const rawQuery = params.get('q') ?? ''
  const q = rawQuery.trim()
  const concept = categoryId(params.get('concept'))
  const { attach: paginationRef, preserve: preservePaginationScroll } =
    usePaginationScroll<HTMLDivElement>(
      `${actorId}:${learnerId}:${generation}:${tab}:${q}:${concept}`,
    )
  const page = pageNumber(params.get('page'))
  const categories = useCategories(actorId, generation)
  const enabled = actorId !== null && learnerId !== null && generation !== null
  const filters = queryString({
    q: q || undefined,
    category_id: concept,
    page,
    size: tab === 'cards' ? 8 : 5,
  })
  // 활성 탭은 현재 페이지를 조회하고 다른 탭은 최소 크기의 개수 조회만 사용한다.
  const saved = useQuery({
    queryKey: ['learner', 'saved', actorId, learnerId, generation, concept, page, q, 5],
    queryFn: ({ signal }) =>
      api<ApiPage<SavedContent>>(`/users/${learnerId}/saved-contents${filters}`, {
        actorId,
        signal,
      }),
    enabled: enabled && tab === 'saved',
  })
  const wrong = useQuery({
    queryKey: ['learner', 'wrong', actorId, learnerId, generation, concept, page, q, 5],
    queryFn: ({ signal }) =>
      api<ApiPage<WrongAnswer>>(
        `/users/${learnerId}/reviews/wrong-answers${queryString({ q: q || undefined, category_id: concept, status: 'PENDING', page, size: 5 })}`,
        { actorId, signal },
      ),
    enabled: enabled && tab === 'wrong',
  })
  const cards = useQuery({
    queryKey: ['learner', 'cards', actorId, learnerId, generation, concept, page, q, 8],
    queryFn: ({ signal }) =>
      api<ApiPage<Flashcard>>(`/users/${learnerId}/reviews/flashcards${filters}`, {
        actorId,
        signal,
      }),
    enabled: enabled && tab === 'cards',
  })
  const active = tab === 'saved' ? saved : tab === 'wrong' ? wrong : cards
  const savedCount = useQuery({
    queryKey: ['learner', 'saved', actorId, learnerId, generation, 'count', concept, q],
    queryFn: ({ signal }) =>
      api<ApiPage<SavedContent>>(
        `/users/${learnerId}/saved-contents${queryString({ q: q || undefined, category_id: concept, page: 1, size: 1 })}`,
        { actorId, signal },
      ),
    enabled: enabled && tab !== 'saved',
    staleTime: 30_000,
  })
  const wrongCount = useQuery({
    queryKey: ['learner', 'wrong', actorId, learnerId, generation, 'count', concept, q],
    queryFn: ({ signal }) =>
      api<ApiPage<WrongAnswer>>(
        `/users/${learnerId}/reviews/wrong-answers${queryString({ q: q || undefined, category_id: concept, status: 'PENDING', page: 1, size: 1 })}`,
        { actorId, signal },
      ),
    enabled: enabled && tab !== 'wrong',
    staleTime: 30_000,
  })
  const cardsCount = useQuery({
    queryKey: ['learner', 'cards', actorId, learnerId, generation, 'count', concept, q],
    queryFn: ({ signal }) =>
      api<ApiPage<Flashcard>>(
        `/users/${learnerId}/reviews/flashcards${queryString({ q: q || undefined, category_id: concept, page: 1, size: 1 })}`,
        { actorId, signal },
      ),
    enabled: enabled && tab !== 'cards',
    staleTime: 30_000,
  })
  const countOf = (id: Tab) => {
    const list = id === 'saved' ? saved : id === 'wrong' ? wrong : cards
    const count = id === 'saved' ? savedCount : id === 'wrong' ? wrongCount : cardsCount
    return id === tab
      ? (list.data?.total ?? count.data?.total)
      : (count.data?.total ?? list.data?.total)
  }
  const memory = useListMemory(
    `${actorId}:${learnerId}:${generation}`,
    `library:${tab}`,
    params.toString(),
    active.isSuccess,
  )
  const conceptName = concept
    ? (categories.data?.items.find((item) => item.category_id === concept)?.name ?? '선택한 분야')
    : ''
  const setFilter = (name: string, value: string) => {
    if (name === 'tab' || name === 'page') memory.preserveScroll()
    else memory.reset()
    if (name === 'page') preservePaginationScroll()
    const next = libraryParams(params, name, value)
    if (name === 'q' && value) next.set('q', value)
    setParams(next, { replace: name === 'q' })
  }
  const removal = useMutation({
    mutationFn: ({
      id,
      identity,
    }: {
      id: number
      identity: LearningIdentity
      previousPage?: number
    }) =>
      api(`/users/${identity.learnerId}/contents/${id}/saved`, {
        method: 'DELETE',
        ...identity,
      }),
    onSuccess: async (_, { id, identity, previousPage }) => {
      await invalidateLearnerReaction(queryClient, identity, id, 'saved')
      if (previousPage !== undefined) setFilter('page', String(previousPage))
      show('저장을 해제했어요.')
    },
    onError: async (error) => {
      show(learnerErrorMessage(error), 'error')
      await refreshSettings().catch(() => undefined)
    },
    onSettled: () => {
      unsavingRef.current = false
    },
  })
  const unsaving = removal.isPending ? removal.variables.id : null
  const unsave = (id: number) => {
    if (unsavingRef.current || actorId === null || learnerId === null || generation === null) return
    unsavingRef.current = true
    removal.mutate({
      id,
      identity: { actorId, learnerId, generation },
      previousPage: saved.data?.items.length === 1 && page > 1 ? page - 1 : undefined,
    })
  }
  const openVideo = (id: number) => {
    memory.remember(id)
    navigate(
      `/learner/watch/${id}${queryString({ from: 'library', returnTo: `/learner/library?${params}` })}`,
      {
        state: { context: 'LIBRARY', returnTo: `/learner/library?${params}` },
      },
    )
  }
  return (
    <div className="sasu-page sasu-library">
      <header className="sasu-page__head">
        <p className="sasu-eyebrow">학습자 · 보관함</p>
        <h1 className="sasu-title">보관함</h1>
        <p className="sasu-sub">저장한 영상과 복습할 문항, 플래시카드를 모아 둬요.</p>
      </header>
      <SegmentedTabs
        label="보관함 탭"
        value={tab}
        options={TABS.map((item) => ({ ...item, count: countOf(item.id) }))}
        onChange={(next) => setFilter('tab', next)}
        idPrefix="library-tab"
        panelId="library-panel"
        disabled={unsaving !== null}
      />
      <SearchFilters
        query={rawQuery}
        categoryId={concept}
        categories={categories.data?.items ?? []}
        pending={categories.isPending}
        disabled={unsaving !== null}
        label="보관함 제목 검색"
        placeholder="콘텐츠 제목으로 검색"
        onQueryChange={(value) => setFilter('q', value)}
        onCategoryChange={(value) => setFilter('concept', value)}
        onReset={() => setFilter('reset', '')}
      />
      {categories.error ? (
        <StateBlock
          title="분야를 불러오지 못했어요."
          variant="toast"
          error={categories.error}
          action={<Button onClick={() => void categories.refetch()}>다시 시도</Button>}
        />
      ) : null}
      {removal.isError ? (
        <StateBlock title="저장 해제를 반영하지 못했어요." variant="toast" error={removal.error} />
      ) : null}
      <div
        ref={paginationRef}
        role="tabpanel"
        id="library-panel"
        aria-labelledby={`library-tab-${tab}`}
        aria-busy={isPending || active.isPending}
        tabIndex={0}
      >
        {isPending ? (
          <Skeleton variant="list" label="사용자를 불러오는 중이에요." />
        ) : sessionError ? (
          <StateBlock title="사용자 정보를 불러오지 못했어요." error={sessionError} />
        ) : !enabled ? (
          <StateBlock title="학습자를 선택해 주세요." />
        ) : active.isPending ? (
          <Skeleton
            variant={tab === 'cards' ? 'cards' : 'list'}
            count={tab === 'cards' ? 8 : 3}
            label="목록을 불러오는 중이에요."
          />
        ) : active.error ? (
          <StateBlock
            title="목록을 불러오지 못했어요."
            error={active.error}
            action={<Button onClick={() => void active.refetch()}>다시 시도</Button>}
          />
        ) : (
          <>
            <p className="sasu-search__summary" aria-live="polite">
              {q ? `“${q}” 검색 결과` : '전체'} {active.data?.total ?? 0}개
              {conceptName ? ` · ${conceptName}` : ' · 분야 전체'}
            </p>
            {active.data?.items.length === 0 ? (
              <StateBlock
                title={
                  q || concept
                    ? '검색 결과가 없어요.'
                    : tab === 'saved'
                      ? '저장한 영상이 없어요.'
                      : tab === 'wrong'
                        ? '복습 필요 0개'
                        : '이용할 수 있는 카드가 없어요.'
                }
                text={
                  q
                    ? '다른 제목으로 검색하거나 검색어를 지워 주세요.'
                    : concept
                      ? '다른 분야를 선택하거나 전체 목록을 확인해 주세요.'
                      : tab === 'saved'
                        ? '영상을 보다가 저장하면 여기에 모여요.'
                        : tab === 'wrong'
                          ? '퀴즈에서 틀린 문항이 생기면 여기에서 다시 풀 수 있어요.'
                          : '공개된 콘텐츠에 퀴즈가 등록되면 플래시카드로 볼 수 있어요.'
                }
                action={
                  q ? (
                    <Button onClick={() => setFilter('q', '')}>검색어 지우기</Button>
                  ) : concept ? (
                    <Button onClick={() => setFilter('concept', '')}>분야 전체 보기</Button>
                  ) : (
                    <Button variant="primary" onClick={() => navigate('/learner/search')}>
                      영상 검색하러 가기
                    </Button>
                  )
                }
              />
            ) : null}
            {tab === 'saved' ? (
              <ul className="sasu-result-list">
                {saved.data?.items.map(({ content }) => (
                  <li key={content.content_id}>
                    <div className="sasu-result-card sasu-result-card--static">
                      <Thumbnail
                        src={content.thumbnail_url}
                        refreshKey={saved.dataUpdatedAt}
                        className="sasu-result-card__thumb"
                      />
                      <span className="sasu-result-card__body">
                        <span className="sasu-result-card__title">{content.title}</span>
                        <span className="sasu-result-card__meta">{content.category?.name}</span>
                      </span>
                      <span className="sasu-result-card__actions">
                        <Button
                          size="sm"
                          variant="primary"
                          data-list-item={content.content_id}
                          onClick={() => openVideo(content.content_id)}
                        >
                          영상 보기
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => void unsave(content.content_id)}
                          disabled={unsaving !== null || generation === null}
                          loading={unsaving === content.content_id}
                        >
                          저장 해제
                        </Button>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
            {tab === 'wrong' ? (
              <ul className="sasu-result-list">
                {wrong.data?.items.map((item) => (
                  <li key={item.question.question_version_id}>
                    <div className="sasu-result-card sasu-result-card--static">
                      <Thumbnail
                        src={item.content.thumbnail_url}
                        refreshKey={wrong.dataUpdatedAt}
                        className="sasu-result-card__thumb"
                      />
                      <span className="sasu-result-card__body sasu-library__review-body">
                        <span className="sasu-library__review-badge">복습 필요</span>
                        <span className="sasu-result-card__title">{item.content.title}</span>
                        <span className="sasu-result-card__meta">
                          {item.content.category?.name}
                        </span>
                        <span className="sasu-result-card__summary">
                          {item.question.question_text}
                        </span>
                      </span>
                      <span className="sasu-result-card__actions">
                        <Button
                          size="sm"
                          variant="primary"
                          data-list-item={item.question.question_version_id}
                          onClick={() => {
                            memory.remember(item.question.question_version_id)
                            navigate(
                              `/learner/review/${item.content.content_id}${queryString({ questionVersionId: item.question.question_version_id, category: concept, q: q || undefined, returnTo: `/learner/library?${params}` })}`,
                              {
                                state: {
                                  context: 'REVIEW',
                                  returnTo: `/learner/library?${params}`,
                                },
                              },
                            )
                          }}
                        >
                          복습 시작
                        </Button>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
            {tab === 'cards' && actorId !== null && learnerId !== null && generation !== null ? (
              <FlashcardGallery
                cards={cards.data?.items ?? []}
                identity={{ actorId, learnerId, generation }}
                onOpenVideo={(card) => {
                  memory.remember(card.question_version_id)
                  const returnTo = `/learner/library?${params}`
                  navigate(
                    `/learner/watch/${card.content_id}${queryString({ from: 'card', questionVersionId: card.question_version_id, category: concept, returnTo })}`,
                    { state: { context: 'REVIEW', returnTo } },
                  )
                }}
              />
            ) : null}
            {active.data && (active.data.total > 0 || page > 1) ? (
              <Pagination
                page={page}
                size={tab === 'cards' ? 8 : 5}
                total={active.data.total}
                hasNext={active.data.has_next}
                disabled={active.isFetching || unsaving !== null}
                label="보관함 페이지"
                onChange={(next) => setFilter('page', String(next))}
              />
            ) : null}
          </>
        )}
      </div>
      {node}
    </div>
  )
}
