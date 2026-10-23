import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, type PropsWithChildren } from 'react'
import { BrowserRouter } from 'react-router'
import { AppStoreProvider } from '../state/store'

export function AppProviders({ children }: PropsWithChildren) {
  const [queryClient] = useState(() => new QueryClient())

  return (
    <QueryClientProvider client={queryClient}>
      <AppStoreProvider>
        <BrowserRouter>{children}</BrowserRouter>
      </AppStoreProvider>
    </QueryClientProvider>
  )
}
