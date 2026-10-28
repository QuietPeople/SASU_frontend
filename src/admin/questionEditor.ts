import type { QuestionType, QuestionVersion } from '../api/admin'

export interface QuestionDraft {
  format: QuestionType
  question: string
  explanation: string
  mcqChoices: string[]
  mcqAnswer: number
  oxAnswer: number
}

export function initialQuestionDraft(initial?: QuestionVersion): QuestionDraft {
  const options = [...(initial?.options ?? [])].sort((a, b) => a.option_order - b.option_order)
  const answer = options.findIndex((option) => option.is_correct)
  return {
    format: initial?.question_type ?? 'MCQ_3',
    question: initial?.question_text ?? '',
    explanation: initial?.explanation ?? '',
    mcqChoices: Array.from({ length: 4 }, (_, index) =>
      initial?.question_type === 'OX' ? '' : (options[index]?.option_text ?? ''),
    ),
    mcqAnswer: initial?.question_type === 'OX' ? -1 : answer,
    oxAnswer: initial?.question_type === 'OX' ? answer : -1,
  }
}

export function activeQuestion(draft: QuestionDraft) {
  const choices =
    draft.format === 'OX' ? ['O', 'X'] : draft.mcqChoices.slice(0, draft.format === 'MCQ_3' ? 3 : 4)
  const selected = draft.format === 'OX' ? draft.oxAnswer : draft.mcqAnswer
  return { choices, answer: selected >= 0 && selected < choices.length ? selected : -1 }
}

export function questionBody(draft: QuestionDraft) {
  const { choices, answer } = activeQuestion(draft)
  return {
    question_type: draft.format,
    question_text: draft.question.trim(),
    explanation: draft.explanation.trim(),
    options: choices.map((text, index) => ({
      option_order: index + 1,
      option_text: text.trim(),
      is_correct: index === answer,
    })),
  }
}

export function questionErrors(draft: QuestionDraft): Record<string, string> {
  const { choices, answer } = activeQuestion(draft)
  const errors: Record<string, string> = {}
  if (!draft.question.trim()) errors.question = '질문을 입력해 주세요.'
  choices.forEach((choice, index) => {
    if (!choice.trim()) errors[`choice-${index}`] = `${index + 1}번 보기를 입력해 주세요.`
  })
  if (answer < 0) errors.answer = '정답을 하나 선택해 주세요.'
  if (!draft.explanation.trim()) errors.explanation = '해설을 입력해 주세요.'
  return errors
}

export function questionSignature(draft: QuestionDraft) {
  return JSON.stringify(questionBody(draft))
}
