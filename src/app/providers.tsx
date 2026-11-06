import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, type PropsWithChildren } from 'react'
import { BrowserRouter } from 'react-router'
import { FeedbackProvider } from '../shared/FeedbackProvider'
import { SessionProvider } from '../state/SessionProvider'

export function AppProviders({ children }: PropsWithChildren) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <FeedbackProvider>
          <SessionProvider>{children}</SessionProvider>
        </FeedbackProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
