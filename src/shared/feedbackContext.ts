import { createContext, useContext } from 'react'
export const FeedbackHosts = createContext<{
  toast: HTMLDivElement | null
  snackbar: HTMLDivElement | null
}>({ toast: null, snackbar: null })
export function useFeedbackHost(kind: 'toast' | 'snackbar') {
  return useContext(FeedbackHosts)[kind]
}
