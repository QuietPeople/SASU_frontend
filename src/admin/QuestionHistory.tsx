import { useState } from 'react'
import { useAdminQuery, type QuestionVersion, type VersionSummary } from '../api/admin'
import type { ApiPage } from '../api/client'
import { Icon } from './Icon'
import { RequestError } from './RequestFeedback'
import { Button, Spinner } from './ui'
import './question-history.css'

const dateFormat = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})
const formats = { OX: 'O / X', MCQ_3: '3지 선다', MCQ_4: '4지 선다' }

export function QuestionHistory({ current }: { current: QuestionVersion }) {
  const [open, setOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<number | null>(null)
  const history = useAdminQuery<ApiPage<VersionSummary>>(
    open ? `/questions/${current.question_id}/versions?page=${page}&size=10` : null,
  )
  const detail = useAdminQuery<QuestionVersion>(
    open && selected ? `/questions/${current.question_id}/versions/${selected}` : null,
  )
  const changePage = (next: number) => {
    setSelected(null)
    setPage(next)
  }
  return (
    <details className="admin-history" onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary className="admin-history__header">
        <span className="admin-history__heading">
          <span className="admin-history__icon">
            <Icon name="draft" size={18} />
          </span>
          <strong>수정 이력</strong>
          <span className="admin-history__current">현재 v{current.version_no}</span>
        </span>
        <span className="admin-history__toggle">
          <span>{open ? '접기' : '펼치기'}</span>
          <Icon name="chevronDown" size={18} />
        </span>
      </summary>
      {open && (
        <div className="admin-history__body">
          <p className="admin-history__note">이전 문항과 당시 응답은 그대로 보존돼요.</p>
          {history.isPending ? (
            <div className="admin-history__loading">
              <Spinner />
            </div>
          ) : history.isError ? (
            <RequestError
              title="이력을 불러오지 못했어요."
              error={history.error}
              action={<Button onClick={() => void history.refetch()}>다시 시도</Button>}
            />
          ) : (
            <>
              {history.data.items.length === 0 ? (
                <p className="admin-history__empty">아직 저장된 수정 이력이 없어요.</p>
              ) : (
                <ol className="admin-history__list">
                  {history.data.items.map((version) => {
                    const expanded = selected === version.question_version_id
                    const panelId = `question-history-${version.question_version_id}`
                    return (
                      <li
                        key={version.question_version_id}
                        className={`admin-history__item ${expanded ? 'is-expanded' : ''}`}
                      >
                        <button
                          type="button"
                          className="admin-history__version"
                          aria-expanded={expanded}
                          aria-controls={expanded ? panelId : undefined}
                          onClick={() => setSelected(expanded ? null : version.question_version_id)}
                        >
                          <span
                            className={`admin-history__number ${version.is_current ? 'is-current' : ''}`}
                          >
                            v{version.version_no}
                          </span>
                          <span className="admin-history__meta">
                            <span className="admin-history__version-title">
                              {version.is_current ? '현재 적용 중' : '이전 버전'}
                            </span>
                            <time dateTime={version.created_at}>
                              {dateFormat.format(new Date(version.created_at))}
                            </time>
                          </span>
                          <span className="admin-history__responses">
                            응답 <strong>{version.response_count.toLocaleString('ko-KR')}</strong>
                            <span>개</span>
                          </span>
                          <span className="admin-history__detail-toggle">
                            <span>{expanded ? '닫기' : '상세'}</span>
                            <Icon name="chevronDown" size={16} />
                          </span>
                        </button>
                        {expanded && (
                          <div
                            id={panelId}
                            className="admin-history__detail"
                            role="region"
                            aria-label={`v${version.version_no} 문항 상세`}
                          >
                            {detail.isPending ? (
                              <div className="admin-history__loading">
                                <Spinner />
                              </div>
                            ) : detail.isError ? (
                              <RequestError
                                title="버전을 불러오지 못했어요."
                                error={detail.error}
                                action={
                                  <Button onClick={() => void detail.refetch()}>다시 시도</Button>
                                }
                              />
                            ) : (
                              <>
                                <div className="admin-history__detail-head">
                                  <span>{formats[detail.data.question_type]}</span>
                                  <span>저장 당시 내용</span>
                                </div>
                                <div className="admin-history__detail-grid">
                                  <section>
                                    <h3>질문</h3>
                                    <p className="admin-history__question">
                                      {detail.data.question_text}
                                    </p>
                                    <ol className="admin-history__options">
                                      {[...detail.data.options]
                                        .sort((a, b) => a.option_order - b.option_order)
                                        .map((option) => (
                                          <li
                                            key={option.option_id}
                                            className={option.is_correct ? 'is-correct' : ''}
                                          >
                                            <span className="admin-history__option-number">
                                              {option.option_order}
                                            </span>
                                            <span className="admin-history__option-text">
                                              {option.option_text}
                                            </span>
                                            {option.is_correct && (
                                              <span className="admin-history__answer">
                                                <Icon name="check" size={14} />
                                                정답
                                              </span>
                                            )}
                                          </li>
                                        ))}
                                    </ol>
                                  </section>
                                  <section className="admin-history__explanation">
                                    <h3>해설</h3>
                                    <p>{detail.data.explanation}</p>
                                  </section>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ol>
              )}
              {(page > 1 || history.data.has_next) && (
                <nav className="admin-history__pagination" aria-label="수정 이력 페이지">
                  <button
                    type="button"
                    aria-label="이전 이력 페이지"
                    disabled={page === 1}
                    onClick={() => changePage(page - 1)}
                  >
                    <Icon name="chevronLeft" size={17} />
                  </button>
                  <span>
                    <strong>{page}</strong> 페이지
                  </span>
                  <button
                    type="button"
                    aria-label="다음 이력 페이지"
                    disabled={!history.data.has_next}
                    onClick={() => changePage(page + 1)}
                  >
                    <Icon name="chevronRight" size={17} />
                  </button>
                </nav>
              )}
            </>
          )}
        </div>
      )}
    </details>
  )
}
