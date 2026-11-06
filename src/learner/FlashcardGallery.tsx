import { useState } from 'react'
import type { LearningFlashcard, LearningIdentity } from '../api/learning'
import { Flashcard } from '../shared/Flashcard'
import { useFlashcardStyle } from '../shared/useFlashcardStyle'
import { FlashcardDetailDialog } from './FlashcardDetailDialog'
import './flashcard-gallery.css'

export function FlashcardGallery({
  cards,
  identity,
  onOpenVideo,
}: {
  cards: LearningFlashcard[]
  identity: LearningIdentity
  onOpenVideo: (card: LearningFlashcard) => void
}) {
  return (
    <ul className="learner-flashcards" aria-label="플래시카드 갤러리">
      {cards.map((card) => (
        <li
          key={`${identity.actorId}:${identity.learnerId}:${identity.generation}:${card.question_version_id}`}
        >
          <GalleryCard card={card} identity={identity} onOpenVideo={() => onOpenVideo(card)} />
        </li>
      ))}
    </ul>
  )
}

function GalleryCard({
  card,
  identity,
  onOpenVideo,
}: {
  card: LearningFlashcard
  identity: LearningIdentity
  onOpenVideo: () => void
}) {
  const [open, setOpen] = useState(false)
  const style = useFlashcardStyle()
  return (
    <>
      <article
        className="learner-flashcards__item"
        aria-label={card.content_title}
        data-list-item={card.question_version_id}
        tabIndex={-1}
      >
        <header className="learner-flashcards__heading">
          <span>{card.category.name}</span>
          <h2>{card.content_title}</h2>
        </header>
        <div className="learner-flashcards__surface">
          <Flashcard
            question={card.front}
            answer=""
            isOX={false}
            style={style}
            flipped={false}
            onOpen={() => setOpen(true)}
          />
        </div>
      </article>
      {open && (
        <FlashcardDetailDialog
          card={card}
          identity={identity}
          style={style}
          onClose={() => setOpen(false)}
          onOpenVideo={onOpenVideo}
        />
      )}
    </>
  )
}
