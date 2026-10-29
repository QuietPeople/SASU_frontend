import { useEffect, useState } from 'react'

export const FLASHCARD_STYLES = [
  'aurora',
  'paper',
  'midnight',
  'botanical',
  'citrus',
  'blueprint',
] as const
export type FlashcardStyle = (typeof FLASHCARD_STYLES)[number]
const RECENT_STYLE_KEY = 'sasu.admin.recentFlashcardStyle'

export function useFlashcardStyle() {
  const [style] = useState<FlashcardStyle>(() => {
    let previous: string | null = null
    try {
      previous = sessionStorage.getItem(RECENT_STYLE_KEY)
    } catch {
      /* 저장소 없이도 무작위 표시한다. */
    }
    const candidates = FLASHCARD_STYLES.filter((candidate) => candidate !== previous)
    return candidates[Math.floor(Math.random() * candidates.length)]!
  })
  useEffect(() => {
    // 직전 디자인의 연속 추첨만 방지한다. 콘텐츠에 스타일을 저장하거나 연결하지 않는다.
    try {
      sessionStorage.setItem(RECENT_STYLE_KEY, style)
    } catch {
      /* 현재 화면의 스타일은 유지한다. */
    }
  }, [style])
  return style
}
