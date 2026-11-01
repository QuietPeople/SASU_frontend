import { useRef, useState } from 'react'
import { useParams } from 'react-router'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useSession } from '../../state/session'
import { api, type ApiPage, queryString } from '../../api/client'
import { useAdminQuery, type AdminResponse, type AdminStatistics, type Rate } from '../../api/admin'
import type { ContentSubview } from '../../admin/contentSubview'
import { RequestError } from '../../admin/RequestFeedback'
import { StatsContentPicker } from '../../admin/StatsContentPicker'
import { SegmentedControl } from '../../admin/SegmentedControl'
import { Icon } from '../../admin/Icon'
import { pageNumbers } from '../../admin/pagination'
import { Badge, Button, Spinner } from '../../admin/ui'
import '../../admin/content-editor.css'
import '../../admin/statistics.css'

const PATH_LABEL = { VIDEO_QUIZ: '영상 퀴즈', FEED_REVIEW: '피드 복습', WRONG_NOTE: '오답 복습' }
const RESULT_OPTIONS = [
  { id: 'ALL', label: '전체' },
  { id: 'CORRECT', label: '정답' },
  { id: 'WRONG', label: '오답' },
  { id: 'SKIP', label: '건너뜀' },
] as const
const SIZE = 10
const number = (value: number) => value.toLocaleString('ko-KR')
const rateText = (rate: Rate) => (rate.percent === null ? '—' : `${number(rate.percent)}%`)
const dateText = (value: string) =>
  new Date(value).toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

function RateBar({ rate, label }: { rate: Rate; label: string }) {
  return (
    <div
      className={`admin-stats__bar ${rate.percent === null ? 'admin-stats__bar--empty' : ''}`}
      role="img"
      aria-label={`${label}: ${rate.percent === null ? '기록 없음' : rateText(rate)}`}
    >
      <span style={{ width: `${Math.max(0, Math.min(100, rate.percent ?? 0))}%` }} />
    </div>
  )
}

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
  tone: string
}) {
  return (
    <section className={`admin-stats__panel admin-stats__learning admin-stats__learning--${tone}`}>
      <header>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </header>
      <div className="admin-stats__accuracy">
        <span>정답률</span>
        <strong>{rateText(accuracy)}</strong>
      </div>
      <RateBar rate={accuracy} label={`${title} 정답률`} />
      <p className="admin-stats__sample">
        {accuracy.percent === null
          ? '아직 채점된 응답이 없어요.'
          : `정답 ${number(accuracy.numerator)} / 채점 응답 ${number(accuracy.denominator)}`}
        <span>건너뜀 {number(skipped)}</span>
      </p>
      <div className="admin-stats__participation">
        <span>{participationLabel}</span>
        <strong>{rateText(participation)}</strong>
      </div>
      <RateBar rate={participation} label={participationLabel} />
      <p className="admin-stats__sample">
        {participation.percent === null
          ? '아직 노출 기록이 없어요.'
          : `응답 ${number(participation.numerator)} / 노출 ${number(participation.denominator)}`}
      </p>
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
  const selected =
    r.result === 'SKIP'
      ? '건너뜀'
      : (r.question.options.find((o) => o.option_id === r.selected_option_id)?.option_text ??
        '선택 정보 없음')
  return (
    <li className="admin-stats__response">
      <button
        type="button"
        className="admin-stats__response-toggle"
        disabled={pending}
        aria-expanded={expanded}
        aria-controls={`response-${r.response_id}`}
        onClick={toggle}
      >
        <span className="admin-stats__question">
          <strong>{r.question.question_text}</strong>
          <span className="admin-stats__response-meta">
            <span>{PATH_LABEL[r.response_path]}</span>
            <time dateTime={r.submitted_at}>{dateText(r.submitted_at)}</time>
          </span>
        </span>
        <Badge tone={r.result === 'CORRECT' ? 'green' : r.result === 'WRONG' ? 'red' : 'neutral'}>
          {r.result === 'CORRECT' ? '정답' : r.result === 'WRONG' ? '오답' : '건너뜀'}
        </Badge>
        <span className="admin-stats__expand">
          <Icon name="chevronDown" size={17} />
        </span>
      </button>
      {expanded && (
        <div className="admin-stats__response-detail" id={`response-${r.response_id}`}>
          <p className="admin-stats__detail-label">
            제출 당시 문항{' '}
            <span>
              문항 #{r.question.question_id} · 버전 ID {r.question.question_version_id}
            </span>
          </p>
          <p className="admin-stats__detail-question">{r.question.question_text}</p>
          <ol className="admin-stats__options">
            {[...r.question.options]
              .sort((a, b) => a.option_order - b.option_order)
              .map((o) => (
                <li
                  key={o.option_id}
                  className={o.option_id === r.selected_option_id ? 'is-selected' : undefined}
                >
                  {o.option_text}
                  {o.option_id === r.selected_option_id && <span>선택</span>}
                </li>
              ))}
          </ol>
          <dl>
            <div className={`admin-stats__answer admin-stats__answer--${r.result.toLowerCase()}`}>
              <dt>제출한 답</dt>
              <dd>{selected}</dd>
            </div>
            <div className="admin-stats__answer admin-stats__answer--correct">
              <dt>당시 정답</dt>
              <dd>{r.correct_answer}</dd>
            </div>
            <div className="admin-stats__explanation">
              <dt>해설</dt>
              <dd>{r.explanation || '등록된 해설이 없어요.'}</dd>
            </div>
          </dl>
        </div>
      )}
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
      <Statistics key={`${actorId}:${generation}:${id ?? 'all'}`} target={id} />
    </div>
  )
}

function Statistics({ target }: { target?: string }) {
  const { actorId, generation } = useSession()
  const [page, setPage] = useState(1)
  const [result, setResult] = useState<AdminResponse['result'] | 'ALL'>('ALL')
  const [expanded, setExpanded] = useState<number | null>(null)
  const responseHeading = useRef<HTMLHeadingElement>(null)
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
  const data = statistics.data
  const delta =
    data?.quiz.first_accuracy.percent != null && data.feed_review.accuracy.percent != null
      ? Math.round((data.feed_review.accuracy.percent - data.quiz.first_accuracy.percent) * 100) /
        100
      : null
  const changePage = (next: number) => {
    setPage(next)
    setExpanded(null)
    responseHeading.current?.focus({ preventScroll: true })
    responseHeading.current?.scrollIntoView({ block: 'start' })
  }
  return (
    <div className="admin-stats__body">
      {statistics.isPending ? (
        <Spinner label="통계를 불러오는 중" />
      ) : statistics.isError ? (
        <RequestError
          title="통계를 불러오지 못했어요."
          error={statistics.error}
          action={<Button onClick={() => void statistics.refetch()}>다시 시도</Button>}
        />
      ) : (
        data && (
          <>
            <ul className="admin-stats__summary" aria-label="시청·이용 반응">
              <li>
                <span>조회수</span>
                <strong>
                  {number(data.reactions.view_count)}
                  <small>회</small>
                </strong>
              </li>
              <li>
                <span>좋아요</span>
                <strong>
                  {number(data.reactions.like_count)}
                  <small>개</small>
                </strong>
              </li>
              <li>
                <span>저장</span>
                <strong>
                  {number(data.reactions.saved_count)}
                  <small>개</small>
                </strong>
              </li>
              <li className="admin-stats__completion">
                <span>시청 완료율</span>
                <strong>{rateText(data.reactions.watch_completion)}</strong>
                <p>
                  {data.reactions.watch_completion.percent === null
                    ? '아직 시청 기록이 없어요.'
                    : `완료 ${number(data.reactions.watch_completion.numerator)} / 대상 ${number(data.reactions.watch_completion.denominator)}`}
                </p>
              </li>
            </ul>
            <div className="admin-stats__comparison">
              <LearningCard
                title="최초 풀이"
                subtitle="영상 종료 후 첫 퀴즈 응답"
                accuracy={data.quiz.first_accuracy}
                participation={data.quiz.participation}
                participationLabel="퀴즈 참여율"
                skipped={data.quiz.skipped_count}
                tone="blue"
              />
              <LearningCard
                title="피드 복습"
                subtitle="피드에서 제출한 모든 복습 응답"
                accuracy={data.feed_review.accuracy}
                participation={data.feed_review.response_rate}
                participationLabel="복습 응답률"
                skipped={data.feed_review.skipped_count}
                tone="green"
              />
            </div>
            <div className="admin-stats__difference">
              <div>
                <span>
                  정답률 차이 <small>복습 − 최초</small>
                </span>
                <strong>
                  {delta === null
                    ? '비교할 응답이 부족해요'
                    : `${delta > 0 ? '+' : ''}${number(delta)}%p`}
                </strong>
              </div>
              <p>응답 대상과 표본 수가 달라, 이 차이만으로 학습 효과를 판단할 수는 없어요.</p>
            </div>
            <div className="admin-stats__comparison">
              <section className="admin-stats__panel">
                <header>
                  <h2>오답 복습</h2>
                  <p>오답 노트에서 다시 푼 결과</p>
                </header>
                <div className="admin-stats__review-rate">
                  <span>정답률</span>
                  <strong>{rateText(data.wrong_review.accuracy)}</strong>
                </div>
                <RateBar rate={data.wrong_review.accuracy} label="오답 복습 정답률" />
                <p className="admin-stats__sample">
                  {data.wrong_review.accuracy.percent === null
                    ? '아직 채점된 응답이 없어요.'
                    : `정답 ${number(data.wrong_review.accuracy.numerator)} / 채점 응답 ${number(data.wrong_review.accuracy.denominator)}`}
                </p>
                <dl className="admin-stats__counts">
                  <div>
                    <dt>미해결 문항</dt>
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
              </section>
              <section className="admin-stats__panel">
                <header>
                  <h2>플래시카드</h2>
                  <p>질문을 확인하고 답을 펼쳐 본 기록</p>
                </header>
                <dl className="admin-stats__counts admin-stats__counts--cards">
                  <div>
                    <dt>카드 열람</dt>
                    <dd>
                      {number(data.flashcards.viewed_count)}
                      <small>회</small>
                    </dd>
                  </div>
                  <div>
                    <dt>답 펼침</dt>
                    <dd>
                      {number(data.flashcards.flipped_count)}
                      <small>회</small>
                    </dd>
                  </div>
                </dl>
                <p className="admin-stats__note">
                  답 펼침은 정답 제출이나 오답 해결로 계산하지 않아요.
                </p>
              </section>
            </div>
          </>
        )
      )}
      <section
        className="admin-stats__panel admin-stats__responses"
        aria-busy={responses.isFetching}
      >
        <header>
          <h2 ref={responseHeading} tabIndex={-1}>
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
          <div className="admin-stats__loading-status" role="status">
            {responses.isFetching && (
              <span>
                응답을 불러오는 중이에요{responses.isPlaceholderData ? ' · 이전 결과 표시 중' : ''}
              </span>
            )}
          </div>
        </header>
        {responses.isPending ? (
          <Spinner label="응답을 불러오는 중" />
        ) : responses.isError ? (
          <RequestError
            title="응답을 불러오지 못했어요."
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
