import { Skeleton } from '../../shared/Skeleton'
import { useState } from 'react'
import { usePaginationScroll } from '../../shared/usePaginationScroll'
import { useParams } from 'react-router'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useSession } from '../../state/session'
import { api, type ApiPage, queryString } from '../../api/client'
import {
  useAdminQuery,
  type AdminResponse,
  type AdminStatistics,
  type EditableContent,
  type Rate,
} from '../../api/admin'
import type { ContentSubview } from '../../admin/contentSubview'
import { RequestError } from '../../admin/RequestFeedback'
import { StatsContentPicker } from '../../admin/StatsContentPicker'
import { StatisticsRing } from '../../admin/StatisticsRing'
import { SegmentedControl } from '../../admin/SegmentedControl'
import { Icon } from '../../admin/Icon'
import { pageNumbers } from '../../admin/pagination'
import { Button } from '../../admin/ui'
import { ResultBadge } from '../../admin/ResultBadge'
import { ResponseDetail } from '../../admin/ResponseDetail'
import '../../admin/content-editor.css'
import '../../admin/statistics.css'

const PATH_LABEL = {
  VIDEO_QUIZ: '영상 퀴즈',
  FEED_REVIEW: '이전 피드 퀴즈',
  WRONG_NOTE: '오답 복습',
}
const RESULT_OPTIONS = [
  { id: 'ALL', label: '전체' },
  { id: 'CORRECT', label: '정답' },
  { id: 'WRONG', label: '오답' },
  { id: 'SKIP', label: '건너뜀' },
] as const
const SIZE = 5
const number = (value: number) => value.toLocaleString('ko-KR')
const dateText = (value: string) =>
  new Date(value).toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

function LearningCard({
  title,
  subtitle,
  accuracy,
  participation,
  participationLabel,
  skipped,
  tone,
}: {
  title: string
  subtitle: string
  accuracy: Rate
  participation: Rate
  participationLabel: string
  skipped: number
  tone: 'blue' | 'orange'
}) {
  return (
    <section className={`admin-stats__panel admin-stats__learning admin-stats__learning--${tone}`}>
      <header>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </header>
      <div className="admin-stats__metrics">
        <div className="admin-stats__metric">
          <StatisticsRing rate={accuracy} label={`${title} 정답률`} tone={tone} />
          <h3>정답률</h3>
          <p>
            {accuracy.percent === null
              ? '아직 채점된 응답이 없어요.'
              : `정답 ${number(accuracy.numerator)} / 채점 응답 ${number(accuracy.denominator)}`}
          </p>
        </div>
        <div className="admin-stats__metric">
          <StatisticsRing
            rate={participation}
            label={`${title} ${participationLabel}`}
            tone="gold"
          />
          <h3>{participationLabel}</h3>
          <p>
            {participation.percent === null
              ? '아직 노출 기록이 없어요.'
              : `응답 ${number(participation.numerator)} / 노출 ${number(participation.denominator)}`}
          </p>
        </div>
      </div>
      <footer className="admin-stats__learning-footer">
        <span>건너뜀</span>
        <strong>
          {number(skipped)}
          <small>회</small>
        </strong>
      </footer>
    </section>
  )
}

function ResponseItem({
  response: r,
  expanded,
  toggle,
  pending,
}: {
  response: AdminResponse
  pending: boolean
  expanded: boolean
  toggle: () => void
}) {
  return (
    <li className="admin-stats__response">
      <button
        type="button"
        className="admin-stats__response-toggle"
        disabled={pending}
        aria-expanded={expanded}
        aria-controls={expanded ? `response-${r.response_id}` : undefined}
        onClick={toggle}
      >
        <span className="admin-stats__question">
          <strong>{r.question.question_text}</strong>
          <span className="admin-stats__response-meta">
            <span>{PATH_LABEL[r.response_path]}</span>
            <time dateTime={r.submitted_at}>{dateText(r.submitted_at)}</time>
          </span>
        </span>
        <ResultBadge result={r.result} />
        <span className="admin-stats__expand">
          <Icon name="chevronDown" size={17} />
        </span>
      </button>
      {expanded && <ResponseDetail response={r} />}
    </li>
  )
}

export function StatsPage({ embedded }: { embedded?: ContentSubview } = {}) {
  const { id: routeId } = useParams()
  const { actorId, generation } = useSession()
  const id = embedded ? String(embedded.contentId) : routeId
  return (
    <div className="admin-page admin-stats">
      {!embedded && (
        <>
          <header className="admin-page__head">
            <p className="admin-eyebrow">관리자 · 통계</p>
            <h1 className="admin-title">콘텐츠 반응·학습 통계</h1>
            <p className="admin-sub">콘텐츠 이용 현황과 학습자의 풀이 결과를 확인해요.</p>
          </header>
          <StatsContentPicker key={`${actorId}:${generation}`} target={id} />
        </>
      )}
      <Statistics
        key={`${actorId}:${generation}:${id ?? 'all'}`}
        target={id}
        embedded={!!embedded}
      />
    </div>
  )
}

function Statistics({ target, embedded }: { target?: string; embedded: boolean }) {
  const { actorId, generation } = useSession()
  const [page, setPage] = useState(1)
  const [result, setResult] = useState<AdminResponse['result'] | 'ALL'>('ALL')
  const [expanded, setExpanded] = useState<number | null>(null)
  const { attach: paginationRef, preserve: preservePaginationScroll } =
    usePaginationScroll<HTMLElement>(`${actorId}:${generation}:${target}:${result}`)
  const statistics = useAdminQuery<AdminStatistics>(
    target ? `/contents/${target}/statistics` : '/statistics',
  )
  const responsePath = `/responses${queryString({ content_id: target, result: result === 'ALL' ? undefined : result, page, size: SIZE })}`
  const responses = useQuery({
    queryKey: ['admin', actorId, generation, responsePath],
    queryFn: ({ signal }) => api<ApiPage<AdminResponse>>(responsePath, { actorId, signal }),
    enabled: actorId !== null,
    placeholderData: keepPreviousData,
  })
  const displayedPage = responses.data?.page ?? page
  const selectedContent = useAdminQuery<EditableContent>(
    target ? `/contents/${target}?view=editor` : null,
  )
  const data = statistics.data
  const delta =
    data?.quiz.first_accuracy.percent != null && data.feed_review.accuracy.percent != null
      ? Math.round((data.feed_review.accuracy.percent - data.quiz.first_accuracy.percent) * 100) /
        100
      : null
  const changePage = (next: number) => {
    if (next === page) return
    preservePaginationScroll()
    setPage(next)
    setExpanded(null)
  }
  return (
    <div className="admin-stats__body">
      <div className="admin-stats__target" role="status">
        <span className="admin-stats__target-icon">
          <Icon name="stats" size={20} />
        </span>
        <div>
          <span>집계 대상</span>
          <strong>
            {target
              ? (selectedContent.data?.detail.content.title ?? `콘텐츠 #${target}`)
              : '전체 콘텐츠'}
          </strong>
        </div>
        {!embedded && <p>{target ? '선택한 콘텐츠' : '전체 콘텐츠'}의 학습 기록을 집계해요.</p>}
      </div>
      <nav className="admin-stats-jumps" aria-label="통계 영역 이동">
        <a href="#stats-summary">이용 요약</a>
        <a href="#stats-learning">학습 지표</a>
        <a href="#stats-responses">응답 상세</a>
      </nav>
      {statistics.isPending ? (
        <Skeleton variant="dashboard" label="통계를 불러오는 중" />
      ) : statistics.isError ? (
        <RequestError
          title="통계를 불러오지 못했어요."
          variant="screen"
          error={statistics.error}
          action={<Button onClick={() => void statistics.refetch()}>다시 시도</Button>}
        />
      ) : (
        data && (
          <>
            <ul id="stats-summary" className="admin-stats__summary" aria-label="시청·이용 반응">
              <li>
                <span className="admin-stats__summary-label">
                  <i className="admin-stats__dot admin-stats__dot--blue" />
                  조회수
                </span>
                <strong>
                  {number(data.reactions.view_count)}
                  <small>회</small>
                </strong>
              </li>
              <li>
                <span className="admin-stats__summary-label">
                  <i className="admin-stats__dot admin-stats__dot--orange" />
                  좋아요
                </span>
                <strong>
                  {number(data.reactions.like_count)}
                  <small>개</small>
                </strong>
              </li>
              <li>
                <span className="admin-stats__summary-label">
                  <i className="admin-stats__dot admin-stats__dot--gold" />
                  저장
                </span>
                <strong>
                  {number(data.reactions.saved_count)}
                  <small>개</small>
                </strong>
              </li>
              <li className="admin-stats__completion">
                <StatisticsRing
                  rate={data.reactions.watch_completion}
                  label="시청 완료율"
                  compact
                />
                <div>
                  <span className="admin-stats__summary-label">시청 완료율</span>
                  <p>
                    {data.reactions.watch_completion.percent === null
                      ? '아직 시청 기록이 없어요.'
                      : `완료 ${number(data.reactions.watch_completion.numerator)} / 대상 ${number(data.reactions.watch_completion.denominator)}`}
                  </p>
                </div>
              </li>
            </ul>
            <div id="stats-learning" className="admin-stats__comparison">
              <LearningCard
                title="최초 풀이"
                subtitle="영상의 학습자료에서 제출한 첫 퀴즈 응답"
                accuracy={data.quiz.first_accuracy}
                participation={data.quiz.participation}
                participationLabel="퀴즈 참여율"
                skipped={data.quiz.skipped_count}
                tone="blue"
              />
              <LearningCard
                title="이전 피드 퀴즈"
                subtitle="답을 제출하던 방식의 기록이에요. 현재 복기 카드 이용은 플래시카드에 집계돼요."
                accuracy={data.feed_review.accuracy}
                participation={data.feed_review.response_rate}
                participationLabel="퀴즈 응답률"
                skipped={data.feed_review.skipped_count}
                tone="orange"
              />
            </div>
            <div className="admin-stats__difference">
              <div>
                <span>이전 피드 퀴즈 정답률 − 최초 풀이 정답률</span>
                <strong>
                  {delta === null
                    ? '비교할 응답이 부족해요'
                    : `${delta > 0 ? '+' : ''}${number(delta)}%p`}
                </strong>
              </div>
            </div>
            <div className="admin-stats__comparison admin-stats__comparison--review">
              <section className="admin-stats__panel">
                <header>
                  <h2>오답 복습</h2>
                  <p>오답 노트에서 다시 푼 결과</p>
                </header>
                <div className="admin-stats__review">
                  <div className="admin-stats__metric">
                    <StatisticsRing
                      rate={data.wrong_review.accuracy}
                      label="오답 복습 정답률"
                      tone="orange"
                    />
                    <h3>정답률</h3>
                    <p>
                      {data.wrong_review.accuracy.percent === null
                        ? '아직 채점된 응답이 없어요.'
                        : `정답 ${number(data.wrong_review.accuracy.numerator)} / 채점 응답 ${number(data.wrong_review.accuracy.denominator)}`}
                    </p>
                  </div>
                  <dl className="admin-stats__counts">
                    <div>
                      <dt>다시 풀 문제</dt>
                      <dd>
                        {number(data.wrong_review.pending_count)}
                        <small>개</small>
                      </dd>
                    </div>
                    <div>
                      <dt>해결 문항</dt>
                      <dd>
                        {number(data.wrong_review.resolved_count)}
                        <small>개</small>
                      </dd>
                    </div>
                  </dl>
                </div>
              </section>
              <section className="admin-stats__panel">
                <header>
                  <h2>플래시카드</h2>
                  <p>피드 복기 카드와 보관함 플래시카드의 열람·답 펼침 기록</p>
                </header>
                <dl className="admin-stats__counts admin-stats__counts--cards">
                  <div>
                    <dt>
                      <Icon name="materials" size={19} />
                      카드 열람
                    </dt>
                    <dd>
                      {number(data.flashcards.viewed_count)}
                      <small>회</small>
                    </dd>
                  </div>
                  <div>
                    <dt>
                      <Icon name="check" size={19} />답 펼침
                    </dt>
                    <dd>
                      {number(data.flashcards.flipped_count)}
                      <small>회</small>
                    </dd>
                  </div>
                </dl>
              </section>
            </div>
          </>
        )
      )}
      <section
        ref={paginationRef}
        id="stats-responses"
        className="admin-stats__panel admin-stats__responses"
        aria-busy={responses.isFetching}
      >
        <header>
          <h2>
            응답 상세{' '}
            {responses.data && (
              <span className="admin-stats__count">{number(responses.data.total)}</span>
            )}
          </h2>
          <p>응답을 누르면 제출 당시의 문항과 해설을 확인할 수 있어요.</p>
          <SegmentedControl
            label="응답 결과 필터"
            value={result}
            options={[...RESULT_OPTIONS]}
            onChange={(next) => {
              setResult(next)
              setPage(1)
              setExpanded(null)
            }}
          />
          <div className="admin-sr" role="status">
            {responses.isFetching && (
              <span>
                응답을 불러오는 중이에요{responses.isPlaceholderData ? ' · 이전 결과 표시 중' : ''}
              </span>
            )}
          </div>
        </header>
        {responses.isPending ? (
          <Skeleton variant="list" label="응답을 불러오는 중" />
        ) : responses.isError ? (
          <RequestError
            title="응답을 불러오지 못했어요."
            variant="screen"
            error={responses.error}
            action={<Button onClick={() => void responses.refetch()}>다시 시도</Button>}
          />
        ) : !responses.data.items.length ? (
          <div className="admin-stats__empty">
            <Icon name="materials" size={28} />
            <strong>
              {result === 'ALL'
                ? '아직 응답이 없어요.'
                : `${RESULT_OPTIONS.find((option) => option.id === result)?.label} 응답이 없어요.`}
            </strong>
            <p>
              {result === 'ALL'
                ? '학습자가 퀴즈를 풀면 여기에 표시돼요.'
                : '다른 결과를 선택해 확인해 보세요.'}
            </p>
          </div>
        ) : (
          <>
            <ul className="admin-stats__response-list">
              {responses.data.items.map((r) => (
                <ResponseItem
                  key={r.response_id}
                  response={r}
                  pending={responses.isPlaceholderData}
                  expanded={expanded === r.response_id}
                  toggle={() => setExpanded(expanded === r.response_id ? null : r.response_id)}
                />
              ))}
            </ul>
          </>
        )}
        {responses.data && responses.data.total > 0 && (
          <footer className="admin-stats__footer">
            <p>
              총 {number(responses.data.total)}개 중{' '}
              <strong>
                {number((displayedPage - 1) * SIZE + 1)}–
                {number(Math.min(displayedPage * SIZE, responses.data.total))}
              </strong>
            </p>
            <nav className="admin-stats__pagination" aria-label="응답 목록 페이지">
              <button
                type="button"
                aria-label="이전 페이지"
                disabled={responses.isPlaceholderData || displayedPage === 1}
                onClick={() => changePage(page - 1)}
              >
                <Icon name="chevronLeft" size={17} />
              </button>
              {pageNumbers(displayedPage, Math.ceil(responses.data.total / SIZE)).map((p) =>
                typeof p === 'number' ? (
                  <button
                    key={p}
                    type="button"
                    aria-label={`${p}페이지`}
                    disabled={responses.isPlaceholderData}
                    aria-current={displayedPage === p ? 'page' : undefined}
                    onClick={() => changePage(p)}
                  >
                    {p}
                  </button>
                ) : (
                  <span key={p}>…</span>
                ),
              )}
              <button
                type="button"
                aria-label="다음 페이지"
                disabled={responses.isPlaceholderData || !responses.data.has_next}
                onClick={() => changePage(page + 1)}
              >
                <Icon name="chevronRight" size={17} />
              </button>
            </nav>
          </footer>
        )}
      </section>
    </div>
  )
}
