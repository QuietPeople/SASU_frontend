import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { EditableContent } from '../api/admin'
import {
  persistContent,
  type ContentSaveEffects,
  type ContentSaveInput,
  type SaveStage,
} from './contentSave'

export function useContentSave({
  onSuccess,
  ...effects
}: Omit<ContentSaveEffects, 'cache' | 'onStage'> & {
  onSuccess: (content: EditableContent, publish: boolean) => void
}) {
  const cache = useQueryClient()
  const savingRef = useRef(false)
  const [stage, setStage] = useState<SaveStage | null>(null)
  const mutation = useMutation({
    mutationFn: (input: ContentSaveInput) =>
      persistContent(input, { ...effects, cache, onStage: setStage }),
    onSuccess: (content, input) => onSuccess(content, input.publish),
    onSettled: () => {
      savingRef.current = false
      setStage(null)
    },
  })
  return {
    savingRef,
    stage,
    busy: mutation.isPending ? (mutation.variables.publish ? 'publish' : 'save') : null,
    error: mutation.error,
    reset: mutation.reset,
    save: (input: ContentSaveInput) => {
      if (savingRef.current) return
      savingRef.current = true
      mutation.mutate(input)
    },
  }
}
