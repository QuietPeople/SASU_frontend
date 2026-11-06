import type { CSSProperties } from 'react'
import { Link } from 'react-router'
import type { LearnerDashboard } from '../api/learner'

export function LearningSummary({ data }: { data: LearnerDashboard }) {
  const completion =
    data.watched_content_count > 0
      ? (data.completed_content_count / data.watched_content_count) * 100
      : null
  return (
    <section className="learner-dashboard__summary" aria-label="학습 요약">
      <div className="learner-dashboard__summary-head">
        <h2>지금까지의 학습</h2>
        <span>누적 기록</span>
      </div>
      <ul className="learner-dashboard__metrics">
        <SummaryMetric
          tone="blue"
          label="시청 완료"
          value={data.completed_content_count.toLocaleString()}
          unit="개"
          percent={completion}
          description={`전체 시청 ${data.watched_content_count.toLocaleString()}개 중`}
          detail="영상의 90% 이상 시청 기준"
        />
        <SummaryMetric
          tone="orange"
          label="최초 퀴즈 정답률"
          value={
            data.first_quiz_accuracy.percent === null
              ? '—'
              : String(data.first_quiz_accuracy.percent)
          }
          unit={data.first_quiz_accuracy.percent === null ? undefined : '%'}
          percent={data.first_quiz_accuracy.percent}
          description={
            data.first_quiz_accuracy.denominator
              ? `정답 ${data.first_quiz_accuracy.numerator} / 제출 ${data.first_quiz_accuracy.denominator}`
              : '아직 퀴즈 제출 기록이 없어요'
          }
          detail="최초 퀴즈 응답 기준"
        />
        <PendingQuestions count={data.pending_question_count} />
      </ul>
    </section>
  )
}

function PendingQuestions({ count }: { count: number }) {
  const value = count.toLocaleString()
  return (
    <li className="learner-dashboard__metric learner-dashboard__metric--yellow">
      <div
        className="learner-dashboard__pending-visual"
        role="img"
        aria-label={`다시 풀 문제 ${value}문항`}
      >
        <div className="learner-dashboard__pending-sheet" aria-hidden="true">
          <svg
            className="learner-dashboard__pending-mark"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            focusable="false"
          >
            <path d="M5 6h2m4 0h8M5 12h2m4 0h8M5 18h2m4 0h5" />
          </svg>
          <div className="learner-dashboard__pending-number">
            <strong
              className={value.length > 3 ? 'learner-dashboard__pending-number--long' : undefined}
            >
              {value}
            </strong>
            <span>문항</span>
          </div>
        </div>
      </div>
      <div className="learner-dashboard__metric-copy">
        <h3>
          <span aria-hidden="true" />
          다시 풀 문제
        </h3>
        {count > 0 ? (
          <Link className="learner-dashboard__pending-link" to="/learner/library?tab=wrong">
            복습하러 가기 <span aria-hidden="true">→</span>
          </Link>
        ) : (
          <p>복습 필요 0개</p>
        )}
        <span>{count > 0 ? '한 문제씩 다시 풀어보세요' : '지금은 다시 풀 문제가 없어요'}</span>
      </div>
    </li>
  )
}

function SummaryMetric({
  tone,
  label,
  value,
  unit,
  percent,
  description,
  detail,
}: {
  tone: 'blue' | 'orange'
  label: string
  value: string
  unit?: string
  percent: number | null
  description: string
  detail: string
}) {
  const ratio =
    percent != null && Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : 0
  return (
    <li className={`learner-dashboard__metric learner-dashboard__metric--${tone}`}>
      <div
        className="learner-dashboard__ring"
        role="img"
        aria-label={`${label} ${value}${unit ?? ''}${percent != null ? `, 비율 ${Number(ratio.toFixed(1))}%` : ''}`}
      >
        <svg viewBox="0 0 120 120" aria-hidden="true" focusable="false">
          <circle
            className="learner-dashboard__ring-track"
            cx="60"
            cy="60"
            r="50"
            fill="none"
            strokeWidth="9"
          />
          {ratio > 0 && (
            <circle
              className="learner-dashboard__ring-value"
              cx="60"
              cy="60"
              r="50"
              fill="none"
              strokeWidth="9"
              pathLength="100"
              strokeDasharray="100"
              strokeDashoffset={100 - ratio}
              style={{ '--ring-offset': 100 - ratio } as CSSProperties}
              strokeLinecap="round"
              transform="rotate(-90 60 60)"
            />
          )}
        </svg>
        <div className="learner-dashboard__ring-center" aria-hidden="true">
          <strong className={value.length > 5 ? 'learner-dashboard__ring-number--long' : undefined}>
            {value}
          </strong>
          {unit && <span>{unit}</span>}
        </div>
      </div>
      <div className="learner-dashboard__metric-copy">
        <h3>
          <span aria-hidden="true" />
          {label}
        </h3>
        <p>{description}</p>
        <span>{detail}</span>
      </div>
    </li>
  )
}
