import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { clearView, readView, writeView } from './state'

interface ListPosition {
  scroll: number
  selected?: number
}

export function useListMemory(scope: string, area: string, query: string, ready: boolean) {
  const key = `${scope}:${area}:${query}`
  const restored = useRef('')
  const keepNextPosition = useRef(false)
  const positions = useRef(new Map<string, ListPosition>())
  useLayoutEffect(() => {
    if (!ready) return
    if (keepNextPosition.current) {
      keepNextPosition.current = false
      restored.current = key
      positions.current.set(key, { scroll: window.scrollY })
      return
    }
    if (restored.current === key) return
    const saved = readView<ListPosition>(key)
    const point = positions.current.get(key) ?? {
      scroll: saved && Number.isFinite(saved.scroll) && saved.scroll >= 0 ? saved.scroll : 0,
      selected: saved?.selected,
    }
    positions.current.set(key, point)
    const frame = requestAnimationFrame(() => {
      restored.current = key
      window.scrollTo(0, point.scroll)
      if (point && Number.isFinite(point.scroll) && point.scroll >= 0) {
        if (Number.isSafeInteger(point.selected))
          document
            .querySelector<HTMLElement>(`[data-list-item="${point.selected}"]`)
            ?.focus({ preventScroll: true })
      }
      point.scroll = window.scrollY
    })
    return () => cancelAnimationFrame(frame)
  }, [key, ready])
  useEffect(() => {
    if (!ready) return
    const point = positions.current.get(key) ?? { scroll: window.scrollY }
    positions.current.set(key, point)
    const rememberScroll = () => {
      point.scroll = window.scrollY
    }
    const save = () => writeView(key, point)
    window.addEventListener('scroll', rememberScroll, { passive: true })
    window.addEventListener('pagehide', save)
    return () => {
      window.removeEventListener('scroll', rememberScroll)
      window.removeEventListener('pagehide', save)
      save()
    }
  }, [key, ready])
  const remember = useCallback(
    (selected: number) => {
      const point = { scroll: window.scrollY, selected }
      const current = positions.current.get(key)
      if (current) Object.assign(current, point)
      else positions.current.set(key, point)
      writeView(key, point)
    },
    [key],
  )
  const reset = useCallback(() => {
    keepNextPosition.current = false
    clearView(key)
    const point = positions.current.get(key)
    if (point) {
      point.scroll = 0
      delete point.selected
    }
    window.scrollTo(0, 0)
  }, [key])
  const preserveScroll = useCallback(() => {
    keepNextPosition.current = true
  }, [])
  return { remember, reset, preserveScroll }
}
