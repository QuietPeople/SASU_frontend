import { useId, useLayoutEffect, useRef, useState } from 'react'
import type { FlashcardStyle } from './useFlashcardStyle'
import { Icon } from './Icon'
import './flashcard-preview.css'

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
  const contentId = useId()
  return (
    <div
      className={`admin-flashcard admin-flashcard--${style}${isOX ? '' : ' is-text-card'}`}
      role="button"
      tabIndex={0}
      aria-label={flipped ? '카드 앞면 보기' : '카드 뒷면 보기'}
      aria-describedby={`${contentId}-${flipped ? 'answer' : 'question'}`}
      onClick={() => setFlipped((old) => !old)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          if (!event.repeat) setFlipped((old) => !old)
        }
      }}
    >
      <div className={`admin-flashcard__turn ${flipped ? 'is-flipped' : ''}`}>
        {(['question', 'answer'] as const).map((side) => {
          const back = side === 'answer'
          const visible = flipped === back
          const text = (back ? answer : question).trim()
          const symbol = back && isOX && (text === 'O' || text === 'X') ? text : null
          return (
            <article
              key={side}
              className={`admin-flashcard__face ${back ? 'admin-flashcard__face--back' : ''}`}
              aria-hidden={!visible}
              inert={!visible}
              aria-label={back ? '플래시카드 정답' : '플래시카드 질문'}
            >
              <div className="admin-flashcard__art" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <header className="admin-flashcard__header">
                <span className="admin-flashcard__brand">
                  SASU<span>작은 배움, 오래 기억하기</span>
                </span>
                <span className="admin-flashcard__spark" aria-hidden="true">
                  ✳
                </span>
              </header>
              <div className="admin-flashcard__body" id={`${contentId}-${side}`}>
                <div className="admin-flashcard__eyebrow">
                  <span aria-hidden="true">{back ? 'A' : 'Q'}</span>
                  {back ? '정답' : '질문'}
                </div>
                {symbol ? (
                  <div className={`admin-flashcard__ox ${symbol === 'X' ? 'is-x' : 'is-o'}`}>
                    <svg viewBox="0 0 160 160" role="img" aria-label={`정답 ${symbol}`}>
                      <circle className="admin-flashcard__ox-halo" cx="80" cy="80" r="74" />
                      {symbol === 'O' ? (
                        <circle className="admin-flashcard__ox-mark" cx="80" cy="80" r="46" />
                      ) : (
                        <path
                          className="admin-flashcard__ox-mark"
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
              <footer className="admin-flashcard__footer">
                <span className="admin-flashcard__page" aria-hidden="true">
                  {back ? '02' : '01'}
                  <span> / 02</span>
                </span>
                <span className="admin-flashcard__flip-hint" aria-hidden="true">
                  <span>눌러서 뒤집기</span>
                  <Icon name="reset" size={17} />
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
    const label = body.querySelector<HTMLElement>('.admin-flashcard__eyebrow')!
    let disposed = false
    const fit = () => {
      if (disposed || !copy.clientWidth) return
      paragraph.style.removeProperty('font-size')
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
      let lower = 0.1
      for (let step = 0; step < 14; step++) {
        const size = (lower + upper) / 2
        paragraph.style.fontSize = `${size}px`
        if (fits()) lower = size
        else upper = size
      }
      paragraph.style.fontSize = `${Math.floor(lower * 100) / 100}px`
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
      className="admin-flashcard__copy"
      data-length={text.length > 200 ? 'long' : text.length > 80 ? 'medium' : 'short'}
    >
      <p className={text ? '' : 'is-placeholder'}>
        {text || (back ? '정답을 선택해 주세요' : '질문을 입력해 주세요')}
      </p>
    </div>
  )
}
