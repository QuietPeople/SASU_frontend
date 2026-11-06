import { useEffect, useEffectEvent, useRef, useState, type ReactNode } from 'react'
import { Controls, MuteButton, PlayButton, TimeSlider } from '@videojs/react'
import { usePlayer } from '@videojs/react/video'
import {
  PauseIcon,
  PlayIcon,
  RestartIcon,
  VolumeHighIcon,
  VolumeLowIcon,
  VolumeOffIcon,
} from '@videojs/react/icons'
import { bindPlayerGestures } from './playerGestures'
import { VideoBuffering } from './VideoLoading'

interface FeedVideoPlayerProps {
  children: ReactNode
  disabled: boolean
  playPrompt: boolean
  pausedByUser: boolean
  onTogglePlayback: () => void
  onLike: () => void
}

function PlaybackOverlay({
  disabled,
  playPrompt,
  pausedByUser,
  onTogglePlayback,
}: Pick<FeedVideoPlayerProps, 'disabled' | 'playPrompt' | 'pausedByUser' | 'onTogglePlayback'>) {
  const waiting = usePlayer(
    (state) =>
      !state.error && (state.canPlay !== true || (state.waiting && state.paused === false)),
  )
  const loading = waiting && !disabled && !playPrompt
  // 사전 로딩·자동 반복 준비 중의 paused 상태는 사용자의 일시정지가 아니다.
  const showControls = pausedByUser || playPrompt

  return (
    <>
      {loading && <VideoBuffering />}
      <div
        className="content-viewer__center-controls"
        data-paused={showControls ? '' : undefined}
        hidden={disabled || loading}
      >
        <MuteButton
          className="media-button media-mute-button content-viewer__sound-button"
          disabled={disabled}
          label={(state) => (state.muted ? '음소거 해제' : '음소거')}
        >
          <VolumeOffIcon className="media-button-icon media-mute-button-off-icon" />
          <VolumeLowIcon className="media-button-icon media-mute-button-low-icon" />
          <VolumeHighIcon className="media-button-icon media-mute-button-high-icon" />
        </MuteButton>
        <PlayButton
          className="media-button media-play-button content-viewer__play-button"
          disabled={disabled}
          label={(state) => (state.ended ? '다시 재생' : state.paused ? '재생' : '일시정지')}
          render={(props) => (
            <button
              {...props}
              type="button"
              onClick={onTogglePlayback}
              onKeyDown={undefined}
              onKeyUp={undefined}
            />
          )}
        >
          <RestartIcon className="media-button-icon media-play-button-restart-icon" />
          <PlayIcon className="media-button-icon media-play-button-play-icon" />
          <PauseIcon className="media-button-icon media-play-button-pause-icon" />
        </PlayButton>
        {playPrompt ? <span className="content-viewer__play-hint">눌러서 계속 재생</span> : null}
      </div>
    </>
  )
}

export function FeedVideoPlayer({
  children,
  disabled,
  playPrompt,
  pausedByUser,
  onTogglePlayback,
  onLike,
}: FeedVideoPlayerProps) {
  const surface = useRef<HTMLDivElement>(null)
  const burstSequence = useRef(0)
  const [likeBurst, setLikeBurst] = useState<number | null>(null)
  const togglePlayback = useEffectEvent(onTogglePlayback)
  const like = useEffectEvent(() => {
    setLikeBurst(++burstSequence.current)
    onLike()
  })
  useEffect(() => {
    if (!surface.current || disabled) return
    return bindPlayerGestures(surface.current, { togglePlayback, like })
  }, [disabled])

  // 10.2.0 기본 스킨의 아이콘·슬라이더 클래스를 사용한다. 버전 변경 시 기본 CSS와 함께 확인한다.
  // 기본 스킨 전체의 배속·전체화면·탐색 제스처는 숏폼 동작과 겹치므로 포함하지 않는다.
  return (
    <div
      ref={surface}
      className="content-viewer__player-ui"
      tabIndex={0}
      aria-label="영상 플레이어"
      onKeyDown={(event) => {
        if (
          !disabled &&
          event.target === event.currentTarget &&
          event.key === ' ' &&
          !event.altKey &&
          !event.ctrlKey &&
          !event.metaKey
        ) {
          event.preventDefault()
          if (!event.repeat) onTogglePlayback()
        }
      }}
    >
      {children}
      <PlaybackOverlay
        disabled={disabled}
        playPrompt={playPrompt}
        pausedByUser={pausedByUser}
        onTogglePlayback={onTogglePlayback}
      />
      {likeBurst !== null && !disabled ? (
        <span
          key={likeBurst}
          className="content-viewer__like-burst"
          aria-hidden="true"
          onAnimationEnd={() => {
            setLikeBurst((current) => (current === likeBurst ? null : current))
          }}
        >
          <svg viewBox="0 0 24 24">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78Z" />
          </svg>
        </span>
      ) : null}
      <Controls.Root visibility="always">
        <Controls.Content className="content-viewer__controls" data-interactive>
          <TimeSlider.Root
            className="media-slider media-time-slider"
            label="영상 재생 위치"
            disabled={disabled}
            pauseOnDrag={false}
          >
            <TimeSlider.Track className="media-slider-track">
              <TimeSlider.Buffer className="media-slider-buffer" />
              <TimeSlider.Fill className="media-slider-fill" />
            </TimeSlider.Track>
            <TimeSlider.Thumb className="media-slider-thumb" />
          </TimeSlider.Root>
        </Controls.Content>
      </Controls.Root>
    </div>
  )
}
