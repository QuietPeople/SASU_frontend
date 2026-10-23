import { Fragment, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { type ApiPage, queryString } from '../../api/client'
import {
  useAdminPages,
  useAdminQuery,
  type AdminContent,
  type AdminResponse,
  type AdminStatistics,
  type Rate,
} from '../../api/admin'
import { Badge, Button, Spinner, StateBlock } from '../../shared/ui'

const PATH_LABEL = { VIDEO_QUIZ: '영상 퀴즈', FEED_REVIEW: '피드 복습', WRONG_NOTE: '오답 복습' }
const rateText = (rate: Rate) => (rate.percent === null ? '—' : `${rate.percent}%`)

export function StatsPage() {
  const { id } = useParams()
  return <Statistics key={id ?? 'all'} target={id} />
}

function Statistics({ target }: { target?: string }) {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [expanded, setExpanded] = useState<number | null>(null)
  const contents = useAdminPages<AdminContent>('/contents?status=ALL')
  const statistics = useAdminQuery<AdminStatistics>(
    target ? `/contents/${target}/statistics` : '/statistics',
  )
  const responses = useAdminQuery<ApiPage<AdminResponse>>(
    `/responses${queryString({ content_id: target, page, size: 20 })}`,
  )
  const data = statistics.data
  const delta =
    data?.quiz.first_accuracy.percent != null && data.feed_review.accuracy.percent != null
      ? Math.round((data.feed_review.accuracy.percent - data.quiz.first_accuracy.percent) * 100) /
        100
      : null
  return (
    <div className="sasu-page sasu-stats">
      <header className="sasu-page__head">
        <p className="sasu-eyebrow">관리자 · 통계</p>
        <h1 className="sasu-title">콘텐츠 반응·학습 통계</h1>
      </header>
      <label className="sasu-field sasu-field--block">
        <span className="sasu-field__label">대상 콘텐츠</span>
        <select
          className="sasu-input"
          value={target ?? ''}
          onChange={(e) =>
            navigate(e.target.value ? `/admin/stats/${e.target.value}` : '/admin/stats')
          }
        >
          <option value="">전체 콘텐츠</option>
          {contents.data?.map((c) => (
            <option key={c.content_id} value={c.content_id}>
              {c.title || '제목 없음'}
            </option>
          ))}
        </select>
      </label>
      {contents.isError ? (
        <StateBlock
          title="콘텐츠 목록을 불러오지 못했어요."
          action={<Button onClick={() => void contents.refetch()}>다시 시도</Button>}
        />
      ) : null}
      {statistics.isPending ? (
        <Spinner label="통계를 불러오는 중" />
      ) : statistics.isError ? (
        <StateBlock
          title="통계를 불러오지 못했어요."
          text={statistics.error.message}
          action={<Button onClick={() => void statistics.refetch()}>다시 시도</Button>}
        />
      ) : data ? (
        <>
          <ul className="sasu-stat-row" aria-label="시청·이용 반응">
            <li className="sasu-stat">
              <span className="sasu-stat__label">조회수</span>
              <strong className="sasu-stat__value">{data.reactions.view_count}</strong>
            </li>
            <li className="sasu-stat">
              <span className="sasu-stat__label">좋아요</span>
              <strong className="sasu-stat__value">{data.reactions.like_count}</strong>
            </li>
            <li className="sasu-stat">
              <span className="sasu-stat__label">저장</span>
              <strong className="sasu-stat__value">{data.reactions.saved_count}</strong>
            </li>
            <li className="sasu-stat">
              <span className="sasu-stat__label">시청 완료율</span>
              <strong className="sasu-stat__value">
                {rateText(data.reactions.watch_completion)}
              </strong>
              <span className="sasu-stat__sub">
                완료 {data.reactions.watch_completion.numerator} / 대상{' '}
                {data.reactions.watch_completion.denominator}
              </span>
            </li>
          </ul>
          <div className="sasu-form__grid">
            <section className="sasu-card">
              <h2 className="sasu-card__title">최초 풀이(영상 종료)</h2>
              <p className="sasu-stat__big">{rateText(data.quiz.first_accuracy)}</p>
              <p className="sasu-muted">
                정답 {data.quiz.first_accuracy.numerator} / 응답{' '}
                {data.quiz.first_accuracy.denominator} · 건너뜀 {data.quiz.skipped_count}
              </p>
            </section>
            <section className="sasu-card">
              <h2 className="sasu-card__title">피드 복습 · 모든 응답</h2>
              <p className="sasu-stat__big">{rateText(data.feed_review.accuracy)}</p>
              <p className="sasu-muted">
                정답 {data.feed_review.accuracy.numerator} / 응답{' '}
                {data.feed_review.accuracy.denominator} · 건너뜀 {data.feed_review.skipped_count}
              </p>
            </section>
          </div>
          <table className="sasu-table">
            <thead>
              <tr>
                <th>학습 지표</th>
                <th>표시</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>영상 종료 퀴즈 참여율</td>
                <td>
                  {rateText(data.quiz.participation)}{' '}
                  <span className="sasu-muted">
                    (응답 {data.quiz.participation.numerator} / 노출{' '}
                    {data.quiz.participation.denominator})
                  </span>
                </td>
              </tr>
              <tr>
                <td>피드 복습 응답률</td>
                <td>
                  {rateText(data.feed_review.response_rate)}{' '}
                  <span className="sasu-muted">
                    (응답 {data.feed_review.response_rate.numerator} / 노출{' '}
                    {data.feed_review.response_rate.denominator})
                  </span>
                </td>
              </tr>
              <tr>
                <td>정답률 변화(복습 − 최초)</td>
                <td>{delta === null ? '— (비교 불가)' : `${delta > 0 ? '+' : ''}${delta}%p`}</td>
              </tr>
            </tbody>
          </table>
          <p className="sasu-help">
            분모가 0이면 —로 표시해요. 표본·분모가 다른 정답률 차이를 학습 효과로 단정하지 않아요.
          </p>
          <section className="sasu-card">
            <h2 className="sasu-card__title">복습·카드 이용</h2>
            <ul className="sasu-stats__misc">
              <li>
                오답 복습: 정답률 {rateText(data.wrong_review.accuracy)} · 미해결{' '}
                {data.wrong_review.pending_count}개 · 해결 {data.wrong_review.resolved_count}개
              </li>
              <li>
                카드 열람 {data.flashcards.viewed_count}회 · 답 펼침 {data.flashcards.flipped_count}
                회
              </li>
            </ul>
            <p className="sasu-help">카드 답 펼침은 정답 제출·문항 해결로 계산하지 않아요.</p>
          </section>
        </>
      ) : null}
      <section className="sasu-card">
        <h2 className="sasu-card__title">응답 상세</h2>
        {responses.isPending ? (
          <Spinner />
        ) : responses.isError ? (
          <StateBlock
            title="응답을 불러오지 못했어요."
            text={responses.error.message}
            action={<Button onClick={() => void responses.refetch()}>다시 시도</Button>}
          />
        ) : !responses.data.items.length ? (
          <p className="sasu-muted">아직 응답이 없어요.</p>
        ) : (
          <>
            <div className="sasu-table-wrap">
              <table className="sasu-table">
                <thead>
                  <tr>
                    <th>문항</th>
                    <th>풀이 경로</th>
                    <th>정오</th>
                    <th>제출 시각</th>
                    <th aria-label="상세" />
                  </tr>
                </thead>
                <tbody>
                  {responses.data.items.map((r) => (
                    <Fragment key={r.response_id}>
                      <tr>
                        <td>{r.question.question_text}</td>
                        <td>{PATH_LABEL[r.response_path]}</td>
                        <td>
                          <Badge
                            tone={
                              r.result === 'CORRECT'
                                ? 'green'
                                : r.result === 'WRONG'
                                  ? 'red'
                                  : 'neutral'
                            }
                          >
                            {r.result === 'CORRECT'
                              ? '정답'
                              : r.result === 'WRONG'
                                ? '오답'
                                : '건너뜀'}
                          </Badge>
                        </td>
                        <td>{new Date(r.submitted_at).toLocaleString()}</td>
                        <td>
                          <Button
                            size="sm"
                            onClick={() =>
                              setExpanded(expanded === r.response_id ? null : r.response_id)
                            }
                          >
                            {expanded === r.response_id ? '접기' : '상세'}
                          </Button>
                        </td>
                      </tr>
                      {expanded === r.response_id ? (
                        <tr>
                          <td colSpan={5}>
                            <p>
                              제출 당시 선택:{' '}
                              {r.question.options.find((o) => o.option_id === r.selected_option_id)
                                ?.option_text ?? '건너뜀'}
                            </p>
                            <p>당시 정답: {r.correct_answer}</p>
                            <p>해설: {r.explanation}</p>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="sasu-row">
              <Button disabled={page === 1} onClick={() => setPage(page - 1)}>
                이전
              </Button>
              <span>
                {page}페이지 · 총 {responses.data.total}개
              </span>
              <Button disabled={!responses.data.has_next} onClick={() => setPage(page + 1)}>
                다음
              </Button>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
