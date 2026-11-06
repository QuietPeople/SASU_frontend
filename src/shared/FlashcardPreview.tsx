import { useState } from 'react'
import { Flashcard } from './Flashcard'
import type { FlashcardStyle } from './useFlashcardStyle'

export function FlashcardPreview({
  question,
  answer,
  isOX,
  style,
  flipped: controlledFlipped,
  onFlip,
  disabled = false,
}: {
  question: string
  answer: string
  isOX: boolean
  style: FlashcardStyle
  flipped?: boolean
  onFlip?: () => void
  disabled?: boolean
}) {
  const [localFlipped, setFlipped] = useState(false)

  return (
    <Flashcard
      question={question}
      answer={answer}
      isOX={isOX}
      style={style}
      flipped={controlledFlipped ?? localFlipped}
      onFlip={onFlip ?? (() => setFlipped((value) => !value))}
      disabled={disabled}
    />
  )
}
