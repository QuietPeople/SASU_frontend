import type { AdminResponse } from '../api/admin'
import { QuestionPreview } from './QuestionPreview'
import { DisclosureSummary } from '../shared/DisclosureSummary'

const formats = { OX: 'O / X', MCQ_3: '3지 선다', MCQ_4: '4지 선다' }

export function ResponseDetail({ response }: { response: AdminResponse }) {
  const selected =
    response.result === 'SKIP'
      ? '선택한 답 없음'
      : (response.question.options.find(
          (option) => option.option_id === response.selected_option_id,
        )?.option_text ?? '선택 정보 없음')
  return (
    <div className="admin-stats__response-detail" id={`response-${response.response_id}`}>
      <section className="admin-stats__response-question" aria-label="제출 당시 문항">
        <div className="admin-stats__detail-heading">
          <h3>제출 당시 문항</h3>
          <span>{formats[response.question.question_type]}</span>
        </div>
        <QuestionPreview
          question={response.question.question_text}
          options={response.question.options}
          selectedOptionId={response.result === 'SKIP' ? null : response.selected_option_id}
          correctOptionId={response.correct_option_id}
        />
      </section>
      <section className="admin-stats__response-record" aria-label="제출 결과와 해설">
        <h3>제출 기록</h3>
        <dl className="admin-stats__answers">
          <div
            className={`admin-stats__answer admin-stats__answer--${response.result.toLowerCase()}`}
          >
            <dt>제출한 답</dt>
            <dd>{selected}</dd>
          </div>
          <div className="admin-stats__answer admin-stats__answer--correct">
            <dt>당시 정답</dt>
            <dd>{response.correct_answer}</dd>
          </div>
        </dl>
        <div className="admin-stats__explanation">
          <h3>해설</h3>
          <p>{response.explanation || '등록된 해설이 없어요.'}</p>
        </div>
      </section>
      <details className="admin-stats__identifiers">
        <DisclosureSummary>내부 식별 정보</DisclosureSummary>
        <p>
          응답 #{response.response_id} · 학습자 #{response.user_id} · 문항 #
          {response.question.question_id} · 버전 #{response.question.question_version_id}
        </p>
      </details>
    </div>
  )
}
