import { useEffect, useRef, type PropsWithChildren } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocation } from 'react-router'
import { clearOldFeedSessions } from '../features/feed/session'
import { api, GENERATION_MISMATCH_EVENT } from '../api/client'
import { SessionContext, type User, type UserSettings } from './session'

export function SessionProvider({ children }: PropsWithChildren) {
  const { pathname } = useLocation()
  const client = useQueryClient()
  const users = useQuery({
    queryKey: ['session', 'users'],
    queryFn: ({ signal }) => api<{ items: User[] }>('/users', { signal }),
  })
  const learnerId = users.data?.items.find((user) => user.role === 'LEARNER')?.user_id ?? null
  const adminId = users.data?.items.find((user) => user.role === 'ADMIN')?.user_id ?? null
  const actorId = pathname.startsWith('/admin') ? adminId : learnerId
  const settings = useQuery({
    queryKey: ['session', 'settings', learnerId],
    queryFn: ({ signal }) =>
      api<UserSettings>(`/users/${learnerId}/settings`, { actorId: learnerId, signal }),
    enabled: learnerId !== null,
  })
  const generation = settings.data?.record_generation ?? null
  const previousGeneration = useRef<number | null>(null)
  const generationChannel = useRef<BroadcastChannel | null>(null)

  useEffect(() => {
    const refresh = () => {
      void client.invalidateQueries({ queryKey: ['session', 'settings'] })
    }
    window.addEventListener(GENERATION_MISMATCH_EVENT, refresh)
    return () => window.removeEventListener(GENERATION_MISMATCH_EVENT, refresh)
  }, [client])

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return
    const channel = new BroadcastChannel('sasu:record-generation')
    generationChannel.current = channel
    channel.onmessage = (event: MessageEvent<{ userId?: number; generation?: number }>) => {
      if (event.data?.userId === learnerId && Number.isSafeInteger(event.data.generation)) {
        void client.invalidateQueries({ queryKey: ['session', 'settings', learnerId] })
      }
    }
    return () => {
      generationChannel.current = null
      channel.close()
    }
  }, [client, learnerId])

  useEffect(() => {
    if (learnerId !== null && generation !== null) clearOldFeedSessions(learnerId, generation)
    if (
      previousGeneration.current !== null &&
      generation !== null &&
      previousGeneration.current !== generation
    ) {
      generationChannel.current?.postMessage({ userId: learnerId, generation })
      const otherQueries = {
        predicate: (query: { queryKey: readonly unknown[] }) => query.queryKey[0] !== 'session',
      }
      void client.cancelQueries(otherQueries).then(() => client.invalidateQueries(otherQueries))
    }
    previousGeneration.current = generation
  }, [client, generation, learnerId])

  return (
    <SessionContext.Provider
      value={{
        actorId,
        learnerId,
        adminId,
        generation,
        settings: settings.data,
        users: users.data?.items ?? [],
        isPending: users.isPending || (learnerId !== null && settings.isPending),
        error: (!users.data ? users.error : null) ?? (!settings.data ? settings.error : null),
        backgroundError:
          (users.data ? users.error : null) ?? (settings.data ? settings.error : null),
        refreshSettings: () => settings.refetch(),
        refreshSession: async () => {
          await users.refetch()
          return settings.refetch()
        },
      }}
    >
      <SessionBoundary key={`${actorId}:${pathname.startsWith('/admin') ? 'admin' : generation}`}>
        {children}
      </SessionBoundary>
    </SessionContext.Provider>
  )
}

function SessionBoundary({ children }: PropsWithChildren) {
  return children
}
