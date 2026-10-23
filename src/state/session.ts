import { createContext, useContext } from 'react'

export interface User {
  user_id: number
  name: string
  role: 'LEARNER' | 'ADMIN'
}

export interface UserSettings {
  user_id: number
  interest_category_ids: number[]
  interest_guide_completed: boolean
  review_interval: number
  record_generation: number
}

export interface Session {
  actorId: number | null
  learnerId: number | null
  adminId: number | null
  generation: number | null
  settings: UserSettings | undefined
  users: User[]
  isPending: boolean
  error: Error | null
  backgroundError: Error | null
  refreshSettings: () => Promise<unknown>
  refreshSession: () => Promise<unknown>
}

export const SessionContext = createContext<Session | null>(null)

export function useSession(): Session {
  const session = useContext(SessionContext)
  if (!session) throw new Error('SessionProvider가 필요합니다.')
  return session
}
