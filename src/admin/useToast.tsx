import { useEffect, useRef, useState } from 'react'

// 성공·안내용 짧은 상태 알림. 자동으로 사라지며 사용자 화면 이동은 하지 않음(화면 설계서 1-2 알림)
export function useToast() {
  const [toast, setToast] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const show = (text: string, tone: 'ok' | 'error' = 'ok') => {
    window.clearTimeout(timer.current)
    setToast({ text, tone })
    timer.current = window.setTimeout(() => setToast(null), 2600)
  }
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const node = toast ? (
    <div className={`admin-toast admin-toast--${toast.tone}`} role="status" aria-live="polite">
      {toast.text}
    </div>
  ) : null
  return { show, node }
}
