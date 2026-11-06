import { Skeleton } from '../../shared/Skeleton'
import { useId, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { api } from '../../api/client'
import type { LearnerDashboard } from '../../api/learner'
import { useSession } from '../../state/session'
import { Thumbnail } from '../../shared/Thumbnail'
import { usePaginationScroll } from '../../shared/usePaginationScroll'
import { MenuIcon } from '../../learner/MenuIcon'
import { LearningSummary } from '../../learner/LearningSummary'
import { Pagination } from '../../learner/Pagination'
import { Button } from '../../learner/ui'
import { LearnerState as StateBlock } from '../../learner/LearnerState'
import '../../learner/dashboard.css'

const GUIDE_VIEWS = ['open', 'collapsed', 'hidden'] as const
type GuideView = (typeof GUIDE_VIEWS)[number]
function guideKey(learnerId: number | null) {
  return `sasu.dash.guide.${learnerId ?? 'anon'}`
}
function readGuideView(learnerId: number | null): GuideView {
  try {
    const value = localStorage.getItem(guideKey(learnerId))
    if (value && (GUIDE_VIEWS as readonly string[]).includes(value)) return value as GuideView
  } catch {
    /* 저장소 없이도 현재 화면의 선택은 유지한다. */
  }
  return 'collapsed'
}
function catsKey(learnerId: number | null) {
  return `sasu.dash.cats.${learnerId ?? 'anon'}`
}
function readCatsOpen(learnerId: number | null) {
  try {
    return localStorage.getItem(catsKey(learnerId)) === 'open'
  } catch {
    return false
  }
}

export function DashboardPage() {
  const { actorId, learnerId, generation } = useSession()
  return <DashboardContent key={`${actorId}:${learnerId}:${generation}`} />
}

function DashboardContent() {
  const { actorId, learnerId, generation, isPending, error, refreshSession } = useSession()
  const enabled = actorId !== null && learnerId !== null
  const dashboard = useQuery({
    queryKey: ['learner', 'dashboard', actorId, learnerId, generation],
    queryFn: ({ signal }) =>
      api<LearnerDashboard>(`/users/${learnerId}/dashboard`, { actorId, signal }),
    enabled,
  })
  const data = dashboard.data
  return (
    <div className="sasu-page learner-dashboard">
      <header className="learner-dashboard__header">
        <div className="sasu-page__head">
          <p className="sasu-eyebrow">학습자 · 대시보드</p>
          <h1 className="sasu-title">나의 학습</h1>
          <p className="sasu-sub">지금까지의 기록을 확인하고, 다음 배움을 이어가세요.</p>
        </div>
        <Link className="learner-dashboard__primary" to="/learner/feed">
          <MenuIcon name="feed" size={18} /> 학습하러 가기 <Arrow />
        </Link>
      </header>
      {isPending ? (
        <div className="learner-dashboard__loading">
          <Skeleton variant="dashboard" label="사용자를 불러오는 중" />
        </div>
      ) : error ? (
        <StateBlock
          title="사용자 정보를 불러오지 못했어요."
          error={error}
          action={<Button onClick={() => void refreshSession()}>다시 시도</Button>}
        />
      ) : !enabled ? (
        <StateBlock title="학습자를 선택해 주세요." />
      ) : dashboard.isPending ? (
        <div className="learner-dashboard__loading">
          <Skeleton variant="dashboard" label="학습 현황을 불러오는 중" />
        </div>
      ) : dashboard.error ? (
        <StateBlock
          title="학습 현황을 불러오지 못했어요."
          error={dashboard.error}
          action={<Button onClick={() => void dashboard.refetch()}>다시 시도</Button>}
        />
      ) : data ? (
        <>
          <LearningSummary data={data} />
          <div className="learner-dashboard__grid">
            <SeriesProgress series={data.curriculums} refreshKey={dashboard.dataUpdatedAt} />
            <CategoryReview data={data} />
          </div>
          <StartGuide data={data} />
        </>
      ) : null}
    </div>
  )
}

function SeriesProgress({
  series,
  refreshKey,
}: {
  series: LearnerDashboard['curriculums']
  refreshKey: number
}) {
  const [requestedPage, setPage] = useState(1)
  const pages = Math.max(1, Math.ceil(series.length / 5))
  const page = Math.min(requestedPage, pages)
  const items = series.slice((page - 1) * 5, page * 5)
  const { attach: paginationRef, preserve: preservePaginationScroll } =
    usePaginationScroll<HTMLUListElement>(series.map((item) => item.curriculum_id).join(','))
  const changePage = (next: number) => {
    preservePaginationScroll()
    setPage(next)
  }
  return (
    <section
      className="learner-dashboard__panel learner-dashboard__series"
      aria-label="진행 중인 시리즈"
    >
      <header className="learner-dashboard__panel-head">
        <div>
          <h2>
            진행 중인 시리즈 <span className="learner-dashboard__count">{series.length}</span>
          </h2>
          <p>배우던 내용부터 이어서 살펴보세요.</p>
        </div>
        <Link className="learner-dashboard__text-link" to="/learner/series">
          전체 시리즈 <Arrow />
        </Link>
      </header>
      <div
        className="learner-dashboard__series-scroll"
        role="region"
        aria-label="진행 중인 시리즈 목록"
        tabIndex={0}
      >
        {items.length ? (
          <ul ref={paginationRef} className="learner-dashboard__series-list">
            {items.map((item) => (
              <li key={item.curriculum_id}>
                <Link
                  className="learner-dashboard__series-card"
                  to={`/learner/series/${item.curriculum_id}`}
                >
                  {/* 대시보드 응답에는 thumbnail_url이 없어 기존 시리즈 이미지 API를 직접 사용한다. */}
                  <Thumbnail
                    src={`/api/curriculums/${item.curriculum_id}/thumbnail`}
                    refreshKey={refreshKey}
                  />
                  <span className="learner-dashboard__series-info">
                    <strong>{item.title}</strong>
                    {item.description && (
                      <span className="learner-dashboard__description">{item.description}</span>
                    )}
                    <span className="learner-dashboard__progress-meta">
                      <span>
                        완료 {item.completed_steps ?? '—'} / {item.total_steps}개
                      </span>
                      <strong>
                        {item.progress_percent === null ? '—' : `${item.progress_percent}%`}
                      </strong>
                    </span>
                    <progress
                      max={100}
                      value={item.progress_percent ?? undefined}
                      aria-label={`${item.title} 학습 진행률`}
                    />
                    <span className="learner-dashboard__series-bottom">
                      <span>
                        {item.available_steps
                          ? `학습 가능 ${item.available_steps}개`
                          : '현재 학습 가능한 영상이 없어요'}
                      </span>
                      <span>
                        학습 내용 <Arrow />
                      </span>
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="learner-dashboard__empty">
            <span className="learner-dashboard__empty-icon">
              <MenuIcon name="series" size={26} />
            </span>
            <h3>이어서 볼 시리즈가 없어요</h3>
            <p>관심 있는 시리즈를 골라 학습을 시작해 보세요.</p>
            <Link className="learner-dashboard__text-link" to="/learner/series">
              시리즈 둘러보기 <Arrow />
            </Link>
          </div>
        )}
      </div>
      {pages > 1 && (
        <Pagination
          page={page}
          size={5}
          total={series.length}
          hasNext={page < pages}
          label="학습 중인 시리즈 페이지"
          onChange={changePage}
        />
      )}
    </section>
  )
}

function CategoryReview({ data }: { data: LearnerDashboard }) {
  const { learnerId } = useSession()
  const [all, setAll] = useState(() => readCatsOpen(learnerId))
  const listId = useId()
  const categories = [...data.category_states].sort(
    (a, b) => b.pending_question_count - a.pending_question_count,
  )
  const needsReview = categories.filter((item) => item.state === 'NEEDS_REVIEW')
  const shown = all ? categories : needsReview
  const toggle = () => {
    setAll(!all)
    try {
      localStorage.setItem(catsKey(learnerId), all ? 'collapsed' : 'open')
    } catch {
      /* 현재 화면의 선택은 유지한다. */
    }
  }
  return (
    <section
      className="learner-dashboard__panel learner-dashboard__review"
      aria-label="분야별 복습 현황"
    >
      <header className="learner-dashboard__panel-head learner-dashboard__review-head">
        <div className="learner-dashboard__review-title">
          <h2>복습할 분야</h2>
          {categories.length > 0 && (
            <button
              className="learner-dashboard__review-toggle"
              type="button"
              role="switch"
              aria-checked={!all}
              aria-label="복습할 분야만 보기"
              aria-controls={listId}
              onClick={toggle}
            >
              <span>복습 필요만</span>
              <span className="learner-dashboard__switch" aria-hidden="true">
                <span />
              </span>
            </button>
          )}
        </div>
        <p>
          {needsReview.length
            ? `${needsReview.length}개 분야에 다시 풀 문제가 있어요.`
            : '다시 풀 문제를 분야별로 확인해요.'}
        </p>
      </header>
      {data.pending_question_count > 0 && (
        <Link className="learner-dashboard__review-action" to="/learner/library?tab=wrong">
          <span>다시 복습할 내용 {data.pending_question_count}개 보기</span>
          <Arrow />
        </Link>
      )}
      <div id={listId}>
        {shown.length ? (
          <ul className="learner-dashboard__categories">
            {shown.map((item) => (
              <li key={item.category.category_id}>
                {item.state === 'NEEDS_REVIEW' ? (
                  <Link
                    className="learner-dashboard__category"
                    to={`/learner/library?tab=wrong&concept=${item.category.category_id}`}
                  >
                    <span>
                      <strong>{item.category.name}</strong>
                      <span>
                        복습 필요 <b>{item.pending_question_count}</b>개
                      </span>
                    </span>
                    <Arrow />
                  </Link>
                ) : (
                  <div className="learner-dashboard__category learner-dashboard__category--clear">
                    <span>
                      <strong>{item.category.name}</strong>
                      <span>복습 필요 0개</span>
                    </span>
                    <span aria-hidden="true">—</span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div className="learner-dashboard__review-empty">
            <MenuIcon name="library" size={24} />
            <strong>{categories.length ? '복습 필요 0개' : '아직 분야별 기록이 없어요'}</strong>
            <p>학습 중 틀린 문항이 생기면 여기에 모여요.</p>
          </div>
        )}
      </div>
    </section>
  )
}

function StartGuide({ data }: { data: LearnerDashboard }) {
  const { learnerId, settings } = useSession()
  const [view, setView] = useState<GuideView>(() => readGuideView(learnerId))
  const listId = useId()
  const steps = [
    {
      label: '영상 끝까지 시청하기',
      done: data.completed_content_count > 0,
      to: '/learner/feed',
      action: '영상 보기',
    },
    {
      label: '퀴즈 풀어보기',
      done: data.answered_count > 0,
      to: '/learner/search',
      action: '영상 찾기',
    },
    {
      label: '관심 분야 선택하기',
      done: (settings?.interest_category_ids.length ?? 0) > 0,
      to: '/learner/settings',
      action: '분야 선택',
    },
  ]
  const done = steps.filter((step) => step.done).length
  const change = (next: GuideView) => {
    setView(next)
    try {
      localStorage.setItem(guideKey(learnerId), next)
    } catch {
      /* 현재 화면의 선택은 유지한다. */
    }
  }
  if (done === steps.length) return null
  if (view === 'hidden')
    return (
      <button
        type="button"
        className="learner-dashboard__guide-reopen"
        onClick={() => change('open')}
      >
        SASU 시작 안내 다시 보기 <Arrow />
      </button>
    )
  return (
    <section className="learner-dashboard__guide" aria-label="SASU 시작 안내">
      <div className="learner-dashboard__guide-head">
        <button
          type="button"
          className="learner-dashboard__guide-toggle"
          aria-expanded={view === 'open'}
          aria-controls={listId}
          onClick={() => change(view === 'open' ? 'collapsed' : 'open')}
        >
          <span className="learner-dashboard__guide-title">
            SASU 시작하기{' '}
            <span>
              {done} / {steps.length}
            </span>
          </span>
          <Arrow down={view !== 'open'} up={view === 'open'} />
        </button>
        <button
          type="button"
          className="learner-dashboard__guide-hide"
          onClick={() => change('hidden')}
        >
          숨기기
        </button>
      </div>
      <div id={listId} hidden={view !== 'open'}>
        <ul className="learner-dashboard__guide-list">
          {steps.map((step) => (
            <li key={step.label}>
              <span
                className="learner-dashboard__guide-mark"
                data-done={step.done || undefined}
                aria-hidden="true"
              >
                {step.done ? '✓' : '○'}
              </span>
              <span>{step.label}</span>
              {step.done ? (
                <span className="learner-dashboard__guide-done">완료</span>
              ) : (
                <Link to={step.to}>
                  {step.action}
                  <Arrow />
                </Link>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function Arrow({
  backwards = false,
  down = false,
  up = false,
}: {
  backwards?: boolean
  down?: boolean
  up?: boolean
}) {
  return (
    <svg
      className="learner-dashboard__arrow"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ transform: `rotate(${backwards ? 180 : down ? 90 : up ? -90 : 0}deg)` }}
    >
      <path d="m9 5 7 7-7 7" />
    </svg>
  )
}
