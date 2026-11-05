export type PlaybackIntent = 'play' | 'pause'

interface PlaybackOptions {
  canPlay: () => boolean
  onBlocked: () => void
  onIntentChange?: (intent: PlaybackIntent) => void
}

// 재생 의도는 영상마다 새로 시작한다. 브라우저의 일시 정지는 사용자 선택과 구분한다.
export function bindVideoPlayback(video: HTMLVideoElement, options: PlaybackOptions) {
  const document = video.ownerDocument
  const window = document.defaultView
  let wantsPlayback = true
  let disposed = false
  let requestId = 0
  let pending = false

  const canResume = () =>
    !disposed && wantsPlayback && document.visibilityState !== 'hidden' && options.canPlay()

  const suspend = () => {
    requestId += 1
    pending = false
    video.pause()
  }

  const resume = async () => {
    if (!canResume() || pending || (!video.paused && !video.ended)) return
    const request = ++requestId
    const isCurrent = () => request === requestId && canResume()
    pending = true
    try {
      await video.play()
    } catch (error) {
      if (!isCurrent() || (error instanceof Error && error.name === 'AbortError')) return
      if (error instanceof Error && error.name === 'NotAllowedError' && !video.muted) {
        // 소리 있는 자동 재생이 차단되면 음소거로 한 번 재시도한다.
        video.muted = true
        try {
          await video.play()
        } catch (retryError) {
          if (isCurrent() && !(retryError instanceof Error && retryError.name === 'AbortError'))
            options.onBlocked()
        }
      } else {
        options.onBlocked()
      }
    } finally {
      if (request === requestId) pending = false
    }
  }

  const visibilityChanged = () => {
    if (document.visibilityState === 'hidden') suspend()
    else void resume()
  }
  const pageShown = () => void resume()
  document.addEventListener('visibilitychange', visibilityChanged)
  window?.addEventListener('pagehide', suspend)
  window?.addEventListener('pageshow', pageShown)

  return {
    resume,
    suspend,
    toggle: () => {
      if (disposed || !options.canPlay()) return
      if (video.paused || video.ended) {
        wantsPlayback = true
        options.onIntentChange?.('play')
        void resume()
      } else {
        wantsPlayback = false
        options.onIntentChange?.('pause')
        suspend()
      }
    },
    dispose: () => {
      disposed = true
      document.removeEventListener('visibilitychange', visibilityChanged)
      window?.removeEventListener('pagehide', suspend)
      window?.removeEventListener('pageshow', pageShown)
      suspend()
    },
  }
}
