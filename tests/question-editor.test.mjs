import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  activeQuestion,
  initialQuestionDraft,
  questionBody,
  questionErrors,
  questionSignature,
} from '../src/admin/questionEditor.ts'

const complete = {
  ...initialQuestionDraft(),
  question: '질문',
  explanation: '해설',
  mcqChoices: ['하나', '둘', '셋', '넷'],
  mcqAnswer: 1,
}

test('신규 퀴즈는 정답을 자동 지정하지 않으며 모든 필수 항목을 구분한다', () => {
  const draft = initialQuestionDraft()
  assert.equal(activeQuestion(draft).answer, -1)
  assert.deepEqual(Object.keys(questionErrors(draft)), [
    'question',
    'choice-0',
    'choice-1',
    'choice-2',
    'answer',
    'explanation',
  ])
  assert.deepEqual(questionErrors(complete), {})
  assert.ok(questionErrors({ ...complete, mcqAnswer: -1 }).answer)
  assert.ok(questionErrors({ ...complete, question: '  ' }).question)
})

test('객관식에서 OX로 전환한 뒤 돌아오면 보기와 정답이 보존된다', () => {
  const ox = { ...complete, format: 'OX' }
  assert.deepEqual(activeQuestion(ox), { choices: ['O', 'X'], answer: -1 })
  const selectedOx = { ...ox, oxAnswer: 0 }
  const restored = { ...selectedOx, format: 'MCQ_3' }
  assert.deepEqual(activeQuestion(restored), { choices: ['하나', '둘', '셋'], answer: 1 })
  assert.equal(activeQuestion({ ...restored, format: 'OX' }).answer, 0)
})

test('4지에서 3지로 줄이면 숨겨진 정답을 자동 재지정하지 않고 4지 복귀 시 복원한다', () => {
  const four = { ...complete, format: 'MCQ_4', mcqAnswer: 3 }
  const three = { ...four, format: 'MCQ_3' }
  assert.equal(activeQuestion(three).answer, -1)
  assert.ok(questionErrors(three).answer)
  assert.equal(questionBody(three).options.length, 3)
  assert.deepEqual(activeQuestion({ ...three, format: 'MCQ_4' }), {
    choices: ['하나', '둘', '셋', '넷'],
    answer: 3,
  })
})

test('저장 요청에는 현재 형식의 보기와 명시적으로 선택한 정답 하나만 포함한다', () => {
  const body = questionBody({ ...complete, format: 'OX', oxAnswer: 1 })
  assert.deepEqual(body.options, [
    { option_order: 1, option_text: 'O', is_correct: false },
    { option_order: 2, option_text: 'X', is_correct: true },
  ])
  assert.equal(questionBody(complete).options.filter((option) => option.is_correct).length, 1)
})

test('공백 및 숨겨진 보기 변경만으로 중복 버전을 만들지 않는다', () => {
  assert.equal(
    questionSignature({ ...complete, question: ' 질문 ', explanation: '해설 ' }),
    questionSignature(complete),
  )
  assert.equal(
    questionSignature({ ...complete, mcqChoices: ['하나', '둘', '셋', '숨긴 값'] }),
    questionSignature(complete),
  )
  assert.notEqual(questionSignature({ ...complete, mcqAnswer: 0 }), questionSignature(complete))
})

test('서버 보기 순서를 정렬하고 OX의 정답을 객관식에 넘기지 않는다', () => {
  const initial = {
    question_type: 'OX',
    question_text: '질문',
    explanation: '해설',
    options: [
      { option_order: 2, option_text: 'X', is_correct: true },
      { option_order: 1, option_text: 'O', is_correct: false },
    ],
  }
  const draft = initialQuestionDraft(initial)
  assert.equal(activeQuestion(draft).answer, 1)
  assert.deepEqual(activeQuestion({ ...draft, format: 'MCQ_3' }), {
    choices: ['', '', ''],
    answer: -1,
  })
})
