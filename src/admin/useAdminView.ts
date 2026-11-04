import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router'
import { useSession } from '../state/session'
import { readAdminView, writeAdminView } from './navigation'

export function useAdminView(area: string) {
  const { actorId, generation } = useSession()
  const [params, setParams] = useSearchParams()
  const key = `${actorId}:${generation}:${area}`
  const initialized = useRef('')
  const value = params.toString()
  useEffect(() => {
    if (actorId === null || generation === null) return
    if (initialized.current !== key) {
      initialized.current = key
      const saved = readAdminView(key)
      if (!value && saved) {
        setParams(saved, { replace: true })
        return
      }
    }
    writeAdminView(key, value)
  }, [actorId, generation, key, value, setParams])
  const update = (next: URLSearchParams, replace = false) => {
    writeAdminView(key, next.toString())
    setParams(next, { replace })
  }
  return [params, update] as const
}
