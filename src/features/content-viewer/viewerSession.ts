export type VideoDirection = 'next' | 'previous'

interface PlaybackPreferences {
  muted: boolean
  volume: number
}

// 음량·음소거만 공유한다. 일시정지는 현재 영상에만 적용한다.
export function createViewerSession(scope = '') {
  let preferences: PlaybackPreferences = {
    muted: false,
    volume: 1,
  }
  return {
    scope,
    read: (): Readonly<PlaybackPreferences> => preferences,
    update: (change: Partial<PlaybackPreferences>) => {
      preferences = { ...preferences, ...change }
    },
  }
}
export type ViewerSession = ReturnType<typeof createViewerSession>
