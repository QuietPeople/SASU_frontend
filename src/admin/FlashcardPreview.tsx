import { useState } from 'react'
import { Flashcard } from '../shared/Flashcard'
import type { FlashcardStyle } from '../shared/useFlashcardStyle'
export function FlashcardPreview({
  question,
  answer,
  isOX,
  style,
}: {
  question: string
  answer: string
  isOX: boolean
  style: FlashcardStyle
}) {
  const [flipped, setFlipped] = useState(false)
  return (
    <Flashcard
      question={question}
      answer={answer}
      isOX={isOX}
      style={style}
      flipped={flipped}
      onFlip={() => setFlipped((value) => !value)}
    />
  )
}
