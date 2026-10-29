import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router'
import { api, queryString, type ApiPage } from '../../api/client'
import {
  categoryId,
  pageNumber,
  useCategories,
  type SavedContent,
  type WrongAnswer,
  type Flashcard,
} from '../../api/learner'
import { useSession } from '../../state/session'
import { Badge, Button, StateBlock } from '../../shared/ui'
import { useToast } from '../../shared/useToast'

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
  const [unsaving, setUnsaving] = useState<number | null>(null)
  const tab = (
    TABS.some((item) => item.id === params.get('tab')) ? params.get('tab') : 'saved'
  ) as Tab
  const concept = categoryId(params.get('concept'))
  const page = pageNumber(params.get('page'))
  const categories = useCategories(actorId, generation)
  const enabled = actorId !== null && learnerId !== null
  const filters = queryString({ category_id: concept, page, size: 20 })
  // 탭마다 개수를 함께 보여 주기 위해 세 목록을 모두 조회한다.
  const saved = useQuery({
    queryKey: ['learner', 'saved', actorId, learnerId, generation, concept, page],
    queryFn: ({ signal }) =>
      api<ApiPage<SavedContent>>(`/users/${learnerId}/saved-contents${filters}`, {
        actorId,
        signal,
      }),
    enabled,
  })
  const wrong = useQuery({
    queryKey: ['learner', 'wrong', actorId, learnerId, generation, concept, page],
    queryFn: ({ signal }) =>
      api<ApiPage<WrongAnswer>>(
        `/users/${learnerId}/reviews/wrong-answers${queryString({ category_id: concept, status: 'PENDING', page, size: 20 })}`,
        { actorId, signal },
      ),
    enabled,
  })
  const cards = useQuery({
    queryKey: ['learner', 'cards', actorId, learnerId, generation, concept, page],
    queryFn: ({ signal }) =>
      api<ApiPage<Flashcard>>(`/users/${learnerId}/reviews/flashcards${filters}`, {
        actorId,
        signal,
      }),
    enabled,
  })
  const active = tab === 'saved' ? saved : tab === 'wrong' ? wrong : cards
  const countOf = (id: Tab) =>
    (id === 'saved' ? saved : id === 'wrong' ? wrong : cards).data?.total
  const conceptName = concept
    ? (categories.data?.items.find((item) => item.category_id === concept)?.name ?? '선택한 분야')
    : ''
  const setFilter = (name: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(name, value)
    else next.delete(name)
    if (name !== 'page') next.delete('page')
    setParams(next)
  }
  const unsave = async (id: number) => {
    if (unsaving !== null || actorId === null || learnerId === null || generation === null) return
    setUnsaving(id)
    try {
      await api(`/users/${learnerId}/contents/${id}/saved`, {
        method: 'DELETE',
        actorId,
        generation,
      })
      await queryClient.invalidateQueries()
      if (saved.data?.items.length === 1 && page > 1) setFilter('page', String(page - 1))
      show('저장을 해제했어요.')
    } catch (error) {
      show(error instanceof Error ? error.message : '저장 해제를 반영하지 못했어요.', 'error')
      await refreshSettings()
    } finally {
      setUnsaving(null)
    }
  }
  const openVideo = (id: number) =>
    navigate(`/learner/watch/${id}`, {
      state: { context: 'LIBRARY', returnTo: `/learner/library?${params}` },
    })
  return (
    <div className="sasu-page sasu-library">
      <header className="sasu-page__head">
        <p className="sasu-eyebrow">학습자 · 보관함</p>
        <h1 className="sasu-title">보관함</h1>
        <p className="sasu-sub">저장한 영상과 복습할 문항, 플래시카드를 모아 둬요.</p>
      </header>
      <div className="sasu-tabs" role="tablist" aria-label="보관함 탭">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            disabled={unsaving !== null}
            className={`sasu-tabs__tab ${tab === item.id ? 'is-active' : ''}`}
            onClick={() => setFilter('tab', item.id)}
          >
            {item.label}
            {countOf(item.id) !== undefined ? (
              <span className="sasu-tabs__count">{countOf(item.id)}</span>
            ) : null}
          </button>
        ))}
      </div>
      <label className="sasu-field sasu-field--sm">
        <span>분야</span>
        <select
          className="sasu-input"
          value={concept ?? ''}
          onChange={(event) => setFilter('concept', event.target.value)}
          disabled={categories.isPending || unsaving !== null}
        >
          <option value="">분야 전체</option>
          {categories.data?.items.map((category) => (
            <option key={category.category_id} value={category.category_id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>
      {categories.error ? (
        <StateBlock
          title="분야를 불러오지 못했어요."
          action={<Button onClick={() => void categories.refetch()}>다시 시도</Button>}
        />
      ) : null}
      {isPending ? (
        <StateBlock title="사용자를 불러오는 중이에요." />
      ) : sessionError ? (
        <StateBlock title="사용자 정보를 불러오지 못했어요." text={sessionError.message} />
      ) : !enabled ? (
        <StateBlock title="학습자를 선택해 주세요." />
      ) : active.isPending ? (
        <StateBlock title="목록을 불러오는 중이에요." />
      ) : active.error ? (
        <StateBlock
          title="목록을 불러오지 못했어요."
          text={active.error.message}
          action={<Button onClick={() => void active.refetch()}>다시 시도</Button>}
        />
      ) : (
        <>
          <p className="sasu-search__summary">
            전체 {active.data?.total ?? 0}개{conceptName ? ` · ${conceptName}` : ' · 분야 전체'}
          </p>
          {active.data?.items.length === 0 ? (
            <StateBlock
              title={
                tab === 'saved'
                  ? '저장한 영상이 없어요.'
                  : tab === 'wrong'
                    ? '현재 미해결 오답이 없어요.'
                    : '이용할 수 있는 카드가 없어요.'
              }
              text={
                concept
                  ? '다른 분야를 선택하거나 전체 목록을 확인해 주세요.'
                  : tab === 'saved'
                    ? '영상을 보다가 저장하면 여기에 모여요.'
                    : tab === 'wrong'
                      ? '퀴즈에서 틀린 문항이 생기면 여기에서 다시 풀 수 있어요.'
                      : '퀴즈가 등록된 영상을 시청하면 카드가 만들어져요.'
              }
              action={
                concept ? (
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
                    <span className="sasu-result-card__thumb" aria-hidden="true">
                      {content.tags[0]?.name ?? content.title?.slice(0, 2)}
                    </span>
                    <span className="sasu-result-card__body">
                      <span className="sasu-result-card__title">{content.title}</span>
                      <span className="sasu-result-card__meta">{content.category?.name}</span>
                    </span>
                    <span className="sasu-result-card__actions">
                      <Button
                        size="sm"
                        variant="primary"
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
                    <span className="sasu-result-card__body">
                      <span className="sasu-result-card__title">{item.content.title}</span>
                      <span className="sasu-result-card__meta">
                        {item.content.category?.name} · <Badge tone="amber">미해결</Badge>
                      </span>
                      <span className="sasu-result-card__summary">
                        {item.question.question_text}
                      </span>
                    </span>
                    <span className="sasu-result-card__actions">
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() =>
                          navigate(
                            `/learner/review/${item.content.content_id}?questionVersionId=${item.question.question_version_id}`,
                            {
                              state: { context: 'REVIEW', returnTo: `/learner/library?${params}` },
                            },
                          )
                        }
                      >
                        복습 시작
                      </Button>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
          {tab === 'cards' ? (
            <ul className="sasu-result-list">
              {cards.data?.items.map((card) => (
                <li key={card.question_version_id}>
                  <div className="sasu-result-card sasu-result-card--static">
                    <span className="sasu-result-card__body">
                      <span className="sasu-result-card__title">{card.content_title}</span>
                      <span className="sasu-result-card__meta">{card.category.name}</span>
                      <span className="sasu-result-card__summary">{card.front}</span>
                    </span>
                    <span className="sasu-result-card__actions">
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() =>
                          navigate(
                            `/learner/cards${queryString({ questionVersionId: card.question_version_id, category: concept })}`,
                            { state: { returnTo: `/learner/library?${params}` } },
                          )
                        }
                      >
                        카드 보기
                      </Button>
                      <Button size="sm" onClick={() => openVideo(card.content_id)}>
                        원본 영상
                      </Button>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
          {active.data && (page > 1 || active.data.has_next) ? (
            <div className="sasu-row" aria-label="보관함 페이지">
              <Button
                disabled={page === 1 || active.isFetching || unsaving !== null}
                onClick={() => setFilter('page', String(page - 1))}
              >
                이전
              </Button>
              <span>{active.data.page} 페이지</span>
              <Button
                disabled={!active.data.has_next || active.isFetching || unsaving !== null}
                onClick={() => setFilter('page', String(page + 1))}
              >
                다음
              </Button>
            </div>
          ) : null}
        </>
      )}
      {node}
    </div>
  )
}