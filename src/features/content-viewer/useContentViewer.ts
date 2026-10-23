import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { accumulateWatchSample, createWatchTracking } from './watchTracking'
import {
  sendWatchReport,
  type LearningIdentity,
  type WatchContext,
  type WatchResult,
} from '../../api/learning'

interface WatchOptions {
  identity: LearningIdentity
  contentId: number
  mediaRevision: string
  duration: number
  context: WatchContext
}

// 방문별 연속 시청 구간을 누적 보고한다. 탐색 구간은 포함하지 않는다.
export function useContentViewer({
  identity,
  contentId,
  mediaRevision,
  duration,
  context,
}: WatchOptions) {
  const queryClient = useQueryClient()
  const [visitId] = useState(() => crypto.randomUUID())
  const active = useRef(false)
  const tracking = useRef(createWatchTracking())
  const [result, setResult] = useState<WatchResult | null>(null)
  const [error, setError] = useState('')

  const report = useCallback(
    async (keepalive = false) => {
      const state = tracking.current
      if (!state.ranges.length || state.played <= 0) return
      // 일반 보고는 순서대로 보내고, 화면을 떠날 때는 최신 누적 구간을 별도 전송한다.
      if (state.pending && !keepalive) return
      const body = {
        visit_id: visitId,
        media_revision: mediaRevision,
        actual_played_seconds: state.played,
        watched_segments: state.ranges.map((range) => [...range]),
        context,
      }
      const signature = JSON.stringify(body)
      if (signature === state.sent) return
      state.pending = true
      try {
        const next = await sendWatchReport(identity, contentId, body, keepalive)
        state.sent = signature
        if (active.current) {
          setResult(next)
          setError('')
        }
        // 서버에 반영된 진도와 저장 목록, 통계를 갱신한다.
        void queryClient.invalidateQueries()
      } catch (cause) {
        if (active.current)
          setError(cause instanceof Error ? cause.message : '시청 기록을 저장하지 못했어요.')
      } finally {
        state.pending = false
      }
    },
    [visitId, mediaRevision, context, identity, contentId, queryClient],
  )

  useEffect(() => {
    active.current = true
    const timer = window.setInterval(() => {
      void report()
    }, 5000)
    const leave = () => {
      void report(true)
    }
    window.addEventListener('pagehide', leave)
    return () => {
      active.current = false
      window.clearInterval(timer)
      window.removeEventListener('pagehide', leave)
      void report(true)
    }
  }, [report])

  const sample = (video: HTMLVideoElement) => {
    accumulateWatchSample(tracking.current, {
      currentTime: video.currentTime,
      playbackRate: video.playbackRate,
      seeking: video.seeking,
      wallTime: performance.now(),
      duration,
    })
  }

  return {
    result,
    error,
    retry: () => {
      void report()
    },
    onPlay: (video: HTMLVideoElement) => {
      tracking.current.position = video.currentTime
      tracking.current.wallTime = performance.now()
      tracking.current.playing = true
    },
    onTimeUpdate: sample,
    onWaiting: (video: HTMLVideoElement) => {
      sample(video)
      tracking.current.playing = false
    },
    onRateChange: (video: HTMLVideoElement) => {
      // 현재 시청 보고 계약은 고유 구간 길이가 실제 재생 시간을 넘는 것을 거부한다.
      // 배속을 지원하려면 서버 계약도 함께 바꿔야 하므로 지금은 1배속만 제공한다.
      tracking.current.position = null
      if (video.playbackRate !== 1) video.playbackRate = 1
    },
    onPause: (video: HTMLVideoElement) => {
      sample(video)
      tracking.current.playing = false
      void report()
    },
    onSeeking: () => {
      tracking.current.position = null
    },
    onSeeked: (video: HTMLVideoElement) => {
      tracking.current.position = video.currentTime
      tracking.current.wallTime = performance.now()
    },
    onEnded: (video: HTMLVideoElement) => {
      sample(video)
      tracking.current.playing = false
      void report()
    },
  }
}
