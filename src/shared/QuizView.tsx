import { useEffect, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router'
import { ApiError } from '../api/client'
import {
  createLearningAttempt,
  learningKey,
  recordLearningEvent,
  submitLearningAttempt,
  type LearningAttempt,
  type LearningIdentity,
  type LearningQuestion,
  type LearningResult,
  type LearningResponse,
  type ResponsePath,
} from '../api/learning'
import { Button } from './ui'

interface QuizViewProps {
  identity: LearningIdentity
  question: LearningQuestion
  responsePath: ResponsePath
  context?: string
  attemptId?: string
  restoredAttempt?: LearningAttempt
  eventId?: string
  initialSubmission?: { optionId: number | null } | null
  onSubmission?: (optionId: number | null) => void
  onReady?: () => void
  onResponse?: (response: LearningResponse) => void
  onUnavailable?: () => void
  footer?: (result: LearningResult | null) => ReactNode
}

// 학습자·기록 세대·문항 버전이 바뀌면 이전 풀이 상태를 분리한다.
export function QuizView(props: QuizViewProps) {
  return (
    <AttemptView
      key={`${props.identity.actorId}:${props.identity.learnerId}:${props.identity.generation}:${props.question.question_version_id}:${props.responsePath}:${props.attemptId ?? 'new'}`}
      {...props}
    />
  )
}

function AttemptView({
  identity,
  question,
  responsePath,
  context,
  footer,
  attemptId: providedAttemptId,
  restoredAttempt,
  eventId: providedEventId,
  initialSubmission,
  onSubmission,
  onReady,
  onResponse,
  onUnavailable,
}: QuizViewProps) {
  const queryClient = useQueryClient()
  const [newAttemptId] = useState(() => crypto.randomUUID())
  const attemptId = providedAttemptId ?? newAttemptId
  const [newEventId] = useState(() => crypto.randomUUID())
  const eventId = providedEventId ?? newEventId
  const choiceKey = learningKey(identity, 'attempt-choice', attemptId)
  const submissionKey = learningKey(identity, 'attempt-submission', attemptId)
  const [picked, setPicked] = useState<number | null>(
    () => queryClient.getQueryData<number>(choiceKey) ?? null,
  )
  // 응답을 받지 못했어도 서버 저장은 끝났을 수 있어 같은 답으로 재전송한다.
  const [submittedChoice, setSubmittedChoice] = useState<{ optionId: number | null } | null>(
    () =>
      queryClient.getQueryData<{ optionId: number | null }>(submissionKey) ??
      initialSubmission ??
      null,
  )
  const attempt = useQuery({
    queryKey: learningKey(identity, 'attempt', attemptId),
    initialData: restoredAttempt,
    queryFn: async ({ signal }) => {
      const result = await createLearningAttempt(
        identity,
        attemptId,
        question,
        responsePath,
        signal,
      )
      if (responsePath !== 'WRONG_NOTE' && !result.submitted) {
        await recordLearningEvent(
          identity,
          eventId,
          {
            event_type: responsePath === 'VIDEO_QUIZ' ? 'VIDEO_QUIZ_SHOWN' : 'FEED_REVIEW_SHOWN',
            attempt_id: attemptId,
          },
          signal,
        )
      }
      return result
    },
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })
  const submission = useMutation({
    mutationFn: (optionId: number | null) => submitLearningAttempt(identity, attemptId, optionId),
    onSuccess: (response) => {
      // 원본 영상으로 바로 이동해도 확정된 결과가 같은 풀이 캐시에 남는다.
      queryClient.setQueryData<LearningAttempt>(
        learningKey(identity, 'attempt', attemptId),
        (previous) => (previous ? { ...previous, submitted: true, response } : previous),
      )
      void queryClient.invalidateQueries({
        predicate: (query) =>
          !query.queryKey.includes('wrong-review') && !query.queryKey.includes('attempt'),
      })
    },
  })
  const response = submission.data ?? attempt.data?.response
  useEffect(() => {
    if (attempt.data) onReady?.()
    if (response) onResponse?.(response)
  }, [attempt.data, response, onReady, onResponse])
  const locked = Boolean(response) || submittedChoice !== null
  const displayedQuestion = response?.question ?? attempt.data?.question ?? question
  const submit = (optionId: number | null) => {
    if (!attempt.isSuccess || submission.isPending || response) return
    const choice = submittedChoice ?? { optionId }
    onSubmission?.(choice.optionId)
    setSubmittedChoice(choice)
    queryClient.setQueryData(submissionKey, choice)
    submission.mutate(choice.optionId)
  }

  const requiresNewQuestion =
    attempt.error instanceof ApiError &&
    [
      'VERSION_CONFLICT',
      'QUESTION_VERSION_CHANGED',
      'ATTEMPT_NOT_ELIGIBLE',
      'QUESTION_NOT_FOUND',
    ].includes(attempt.error.code)

  return (
    <div className="sasu-quiz">
      {context ? <p className="sasu-quiz__context">{context}</p> : null}
      <p className="sasu-quiz__q">{displayedQuestion.question_text}</p>
      <ul className="sasu-quiz__choices" role="radiogroup" aria-label="보기">
        {displayedQuestion.options.map((option) => {
          const isPicked = (response?.selected_option_id ?? picked) === option.option_id
          const isCorrect =
            response &&
            response.result !== 'SKIP' &&
            response.correct_option_id === option.option_id
          return (
            <li key={option.option_id}>
              <button
                type="button"
                role="radio"
                aria-checked={isPicked}
                disabled={locked || !attempt.isSuccess}
                className={`sasu-choice ${isPicked ? 'is-picked' : ''} ${isCorrect ? 'is-answer' : ''} ${response?.result === 'WRONG' && isPicked ? 'is-wrong' : ''}`}
                onClick={() => {
                  setPicked(option.option_id)
                  queryClient.setQueryData(choiceKey, option.option_id)
                }}
              >
                <span className="sasu-choice__letter" aria-hidden="true">
                  {displayedQuestion.question_type === 'OX'
                    ? option.option_text
                    : String.fromCharCode(64 + option.option_order)}
                </span>
                <span className="sasu-choice__text">{option.option_text}</span>
                {isCorrect ? <span className="sasu-choice__mark">✓ 정답</span> : null}
              </button>
            </li>
          )
        })}
      </ul>
      {attempt.isPending ? <p role="status">문항을 준비하고 있어요.</p> : null}
      {attempt.isError ? (
        <div role="alert">
          <p>{attempt.error.message}</p>
          {requiresNewQuestion ? (
            <>
              <p>현재 목록에서 문항을 다시 선택해 주세요.</p>
              {onUnavailable ? <Button onClick={onUnavailable}>다음 영상으로</Button> : null}
              <Link
                className="sasu-link"
                to={
                  responsePath === 'WRONG_NOTE' ? '/learner/library?tab=wrong' : '/learner/search'
                }
              >
                {responsePath === 'WRONG_NOTE' ? '현재 오답 목록 확인' : '현재 콘텐츠 목록 확인'}
              </Link>
            </>
          ) : (
            <Button onClick={() => void attempt.refetch()}>다시 불러오기</Button>
          )}
        </div>
      ) : null}
      {submission.isError ? (
        <p className="sasu-quiz__error" role="alert">
          {submission.error.message} 같은 답으로 다시 제출할 수 있어요.
        </p>
      ) : null}
      {!response && attempt.isSuccess ? (
        <div className="sasu-row">
          {submittedChoice === null ? (
            <Button onClick={() => submit(null)} disabled={submission.isPending}>
              건너뛰기
            </Button>
          ) : null}
          <Button
            variant="primary"
            loading={submission.isPending}
            disabled={submittedChoice === null && picked === null}
            onClick={() => submit(picked)}
          >
            {submission.isError ? '같은 답 다시 제출' : '제출'}
          </Button>
        </div>
      ) : null}
      {response ? (
        <div
          className={`sasu-result ${response.result === 'CORRECT' ? 'is-correct' : response.result === 'WRONG' ? 'is-wrong' : ''}`}
          role="status"
        >
          <p className="sasu-result__title">
            {response.result === 'CORRECT'
              ? '✓ 정답이에요'
              : response.result === 'WRONG'
                ? '다시 확인해 보세요'
                : '건너뛰었어요'}
          </p>
          {response.result === 'SKIP' ? (
            <p>건너뛴 기록을 저장했어요. 오답으로 기록하지 않아요.</p>
          ) : (
            <>
              <dl className="sasu-result__dl">
                <dt>내 답</dt>
                <dd>
                  {displayedQuestion.options.find(
                    (option) => option.option_id === response.selected_option_id,
                  )?.option_text ?? '—'}
                </dd>
                <dt>정답</dt>
                <dd>{response.correct_answer}</dd>
              </dl>
              <p className="sasu-result__exp">
                <strong>해설</strong> {response.explanation}
              </p>
            </>
          )}
          {footer ? <div className="sasu-result__foot">{footer(response.result)}</div> : null}
        </div>
      ) : null}
    </div>
  )
}
