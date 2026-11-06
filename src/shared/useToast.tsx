import { useCallback, useState } from 'react'
import { Notification } from './Notification'

export function useToast() {
  const [toast, setToast] = useState<{ id: number; text: string; tone: 'ok' | 'error' } | null>(
    null,
  )
  const show = useCallback((text: string, tone: 'ok' | 'error' = 'ok') => {
    setToast((current) => ({ id: (current?.id ?? 0) + 1, text, tone }))
  }, [])
  return {
    show,
    node: toast ? <Notification key={toast.id} title={toast.text} tone={toast.tone} /> : null,
  }
}
