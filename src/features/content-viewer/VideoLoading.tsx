import { Skeleton } from '../../shared/Skeleton'
import './content-viewer.css'

export function VideoLoading() {
  return (
    <div className="content-viewer__video-loading">
      <Skeleton variant="video" label="영상 불러오는 중" />
    </div>
  )
}

export function VideoLoadingFrame() {
  return (
    <div className="sasu-page sasu-feed content-viewer is-lp-closed">
      <div className="sasu-feed__main">
        <div className="sasu-feed__stage">
          <div className="sasu-player" aria-busy="true">
            <VideoLoading />
          </div>
        </div>
      </div>
    </div>
  )
}

export function VideoBuffering() {
  return (
    <div className="content-viewer__video-loading" role="status">
      <span className="content-viewer__loading-ring" aria-hidden="true" />
      <span className="sasu-sr">영상 재생 준비 중</span>
    </div>
  )
}
