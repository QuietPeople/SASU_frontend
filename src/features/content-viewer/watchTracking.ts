export interface WatchTracking {
  position: number | null
  wallTime: number
  playing: boolean
  played: number
  ranges: number[][]
  sent: string
  pending: boolean
}

export function createWatchTracking(): WatchTracking {
  return {
    position: null,
    wallTime: 0,
    playing: false,
    played: 0,
    ranges: [],
    sent: '',
    pending: false,
  }
}

export interface WatchSample {
  currentTime: number
  playbackRate: number
  seeking: boolean
  wallTime: number
  duration: number
}

// 탐색으로 건너뛴 구간은 제외하고 실제 재생한 연속 구간만 합친다.
export function accumulateWatchSample(state: WatchTracking, sample: WatchSample): void {
  const current = Math.min(sample.duration, Math.max(0, sample.currentTime))
  if (state.playing && !sample.seeking && state.position !== null && sample.playbackRate > 0) {
    const delta = current - state.position
    const expected = ((sample.wallTime - state.wallTime) / 1000) * sample.playbackRate
    if (delta > 0 && delta <= expected + 0.5) {
      state.played += delta / sample.playbackRate
      const ranges = [...state.ranges, [state.position, current]].sort((a, b) => a[0] - b[0])
      const merged: number[][] = []
      for (const range of ranges) {
        const last = merged[merged.length - 1]
        if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1])
        else merged.push([...range])
      }
      state.ranges = merged
    }
  }
  state.position = current
  state.wallTime = sample.wallTime
}
