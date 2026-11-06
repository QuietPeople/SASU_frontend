import { useCallback, useLayoutEffect, useRef } from 'react'

// 페이지 조회 중이나 마지막 페이지에서 목록이 짧아져도 스크롤 범위가 줄지 않게 한다.
export function usePaginationScroll<T extends HTMLElement>(scope: string) {
  const ref = useRef<T>(null)
  const attach = useCallback((element: T | null) => {
    ref.current = element
  }, [])
  const restore = useRef<(() => void) | null>(null)
  const release = useCallback(() => {
    restore.current?.()
    restore.current = null
  }, [])
  useLayoutEffect(() => {
    window.addEventListener('resize', release)
    return () => {
      window.removeEventListener('resize', release)
      release()
    }
  }, [scope, release])
  const preserve = useCallback(() => {
    const element = ref.current
    if (!element) return
    if (!restore.current) {
      const { minHeight, overflowAnchor } = element.style
      restore.current = () => {
        element.style.minHeight = minHeight
        element.style.overflowAnchor = overflowAnchor
      }
    }
    element.style.minHeight = `${Math.ceil(element.getBoundingClientRect().height)}px`
    element.style.overflowAnchor = 'none'
  }, [])
  return { attach, preserve }
}
