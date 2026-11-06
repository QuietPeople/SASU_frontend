import { useId, useLayoutEffect, useRef } from 'react'
import type { FlashcardStyle } from './useFlashcardStyle'
import './flashcard.css'

export function Flashcard({
  question,
  answer,
  isOX,
  style,
  flipped,
  onFlip,
  onOpen,
  disabled = false,
}: {
  question: string
  answer: string
  isOX: boolean
  style: FlashcardStyle
  flipped: boolean
  disabled?: boolean
} & ({ onFlip: () => void; onOpen?: never } | { onOpen: () => void; onFlip?: never })) {
  const contentId = useId()
  return (
    <div
      className={`sasu-flashcard sasu-flashcard--${style}${isOX ? '' : ' is-text-card'}`}
      role="button"
      aria-disabled={disabled}
      tabIndex={0}
      aria-label={onOpen ? '플래시카드 열기' : flipped ? '카드 앞면 보기' : '카드 뒷면 보기'}
      aria-haspopup={onOpen ? 'dialog' : undefined}
      aria-describedby={`${contentId}-${flipped ? 'answer' : 'question'}`}
      onClick={() => {
        if (!disabled) (onOpen ?? onFlip)()
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          if (!event.repeat && !disabled) (onOpen ?? onFlip)()
        }
      }}
    >
      <div className={`sasu-flashcard__turn ${flipped ? 'is-flipped' : ''}`}>
        {(['question', 'answer'] as const).map((side) => {
          const back = side === 'answer'
          const visible = flipped === back
          const text = (back ? answer : question).trim()
          const symbol = back && isOX && (text === 'O' || text === 'X') ? text : null
          return (
            <article
              key={side}
              className={`sasu-flashcard__face ${back ? 'sasu-flashcard__face--back' : ''}`}
              aria-hidden={!visible}
              inert={!visible}
              aria-label={back ? '플래시카드 정답' : '플래시카드 질문'}
            >
              <div className="sasu-flashcard__art" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <header className="sasu-flashcard__header">
                <span className="sasu-flashcard__brand">
                  SASU<span>작은 배움, 오래 기억하기</span>
                </span>
                <span className="sasu-flashcard__spark" aria-hidden="true">
                  ✳
                </span>
              </header>
              <div className="sasu-flashcard__body" id={`${contentId}-${side}`}>
                <div className="sasu-flashcard__eyebrow">
                  <span aria-hidden="true">{back ? 'A' : 'Q'}</span>
                  {back ? '정답' : '질문'}
                </div>
                {symbol ? (
                  <div className={`sasu-flashcard__ox ${symbol === 'X' ? 'is-x' : 'is-o'}`}>
                    <svg viewBox="0 0 160 160" role="img" aria-label={`정답 ${symbol}`}>
                      <circle className="sasu-flashcard__ox-halo" cx="80" cy="80" r="74" />
                      {symbol === 'O' ? (
                        <circle className="sasu-flashcard__ox-mark" cx="80" cy="80" r="46" />
                      ) : (
                        <path
                          className="sasu-flashcard__ox-mark"
                          d="M47 47 113 113M113 47 47 113"
                        />
                      )}
                    </svg>
                    <p>{symbol === 'O' ? '맞는 설명이에요' : '틀린 설명이에요'}</p>
                  </div>
                ) : (
                  <FittedCardText text={text} back={back} />
                )}
              </div>
              <footer className="sasu-flashcard__footer">
                <span className="sasu-flashcard__page" aria-hidden="true">
                  {back ? '02' : '01'}
                  <span> / 02</span>
                </span>
                <span className="sasu-flashcard__flip-hint" aria-hidden="true">
                  <span>{onOpen ? '카드 열기' : '눌러서 뒤집기'}</span>
                  <span aria-hidden="true">{onOpen ? '↗' : '↻'}</span>
                </span>
              </footer>
            </article>
          )
        })}
      </div>
    </div>
  )
}

function FittedCardText({ text, back }: { text: string; back: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const copy = ref.current!
    const paragraph = copy.querySelector('p')!
    const body = copy.parentElement!
    const label = body.querySelector<HTMLElement>('.sasu-flashcard__eyebrow')!
    let disposed = false
    const fit = () => {
      if (disposed || !copy.clientWidth) return
      paragraph.style.removeProperty('font-size')
      copy.style.overflowY = 'hidden'
      const bodyStyle = getComputedStyle(body)
      const available = Math.max(
        1,
        body.clientHeight -
          parseFloat(bodyStyle.paddingTop) -
          parseFloat(bodyStyle.paddingBottom) -
          label.offsetHeight -
          parseFloat(bodyStyle.rowGap) -
          1,
      )
      copy.style.maxHeight = `${available}px`
      const fits = () =>
        paragraph.scrollHeight <= available && paragraph.scrollWidth <= copy.clientWidth
      let upper = parseFloat(getComputedStyle(paragraph).fontSize)
      if (fits()) return
      let lower = Math.min(12, upper)
      for (let step = 0; step < 14; step++) {
        const size = (lower + upper) / 2
        paragraph.style.fontSize = `${size}px`
        if (fits()) lower = size
        else upper = size
      }
      paragraph.style.fontSize = `${Math.floor(lower * 100) / 100}px`
      copy.style.overflowY = fits() ? 'hidden' : 'auto'
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(body)
    void document.fonts.ready.then(fit)
    return () => {
      disposed = true
      observer.disconnect()
    }
  }, [text, back])
  return (
    <div
      ref={ref}
      className="sasu-flashcard__copy"
      data-length={text.length > 200 ? 'long' : text.length > 80 ? 'medium' : 'short'}
    >
      <p className={text ? '' : 'is-placeholder'}>
        {text || (back ? '정답을 선택해 주세요' : '질문을 입력해 주세요')}
      </p>
    </div>
  )
}
