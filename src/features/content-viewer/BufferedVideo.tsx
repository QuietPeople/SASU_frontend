import { useContext, useEffect, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Container } from '@videojs/react'
import { Video, VideoPlayer } from '@videojs/react/video'
import { mediaUrl } from '../../api/client'
import {
  getLearningContent,
  getLearningQuestion,
  learningKey,
  type LearningContent,
  type LearningIdentity,
} from '../../api/learning'
import { BufferedVideoContext } from './bufferedVideoContext'
import { LEARNING_PRELOAD_STALE_MS } from './preloadPolicy'
import { retainVideoBuffer } from './videoBuffer'
import { VideoLoading } from './VideoLoading'
import { ContentVideoOverlay } from './ContentVideoOverlay'
import { FeedVideoPlayer } from './FeedVideoPlayer'
import { SwipeContext } from './swipeContext'
import '@videojs/react/video/skin.css'

interface VideoOverlayInfo {
  showSeriesBack?: boolean
  recommendationLabel?: string
  listIndex?: number
  listTotal?: number
}

// 같은 영상 요소를 미리보기에서 실제 재생까지 유지한다. 학습 처리는 children의 활성 화면만 수행한다.
export function BufferedVideo({
  identity,
  contentId,
  content,
  active,
  mediaHost,
  children,
  overlay,
}: {
  identity: LearningIdentity
  contentId: number
  content?: LearningContent
  active: boolean
  mediaHost: ReactNode
  children: ReactNode
  overlay?: VideoOverlayInfo
}) {
  const detail = useQuery({
    queryKey: learningKey(identity, 'content', contentId),
    queryFn: ({ signal }) => getLearningContent(identity, contentId, signal),
    staleTime: LEARNING_PRELOAD_STALE_MS,
    retry: false,
    refetchOnWindowFocus: false,
  })
  useQuery({
    queryKey: learningKey(identity, 'question', contentId),
    queryFn: ({ signal }) => getLearningQuestion(identity, contentId, signal),
    staleTime: LEARNING_PRELOAD_STALE_MS,
    retry: false,
    refetchOnWindowFocus: false,
  })
  const item = detail.data?.content ?? content
  return (
    <BufferedVideoElement
      key={`${item?.media_revision ?? ''}:${item?.video_url ?? ''}`}
      item={item}
      active={active}
      mediaHost={mediaHost}
      loading={detail.isPending}
      overlay={overlay}
    >
      {children}
    </BufferedVideoElement>
  )
}

function BufferedVideoElement({
  item,
  active,
  mediaHost,
  children,
  loading,
  overlay,
}: {
  item: LearningContent | undefined
  active: boolean
  mediaHost: ReactNode
  children: ReactNode
  loading: boolean
  overlay?: VideoOverlayInfo
}) {
  const [video, setVideo] = useState<HTMLVideoElement | null>(null)
  const viewport = useContext(SwipeContext)
  const source = item?.video_url ? mediaUrl(item.video_url) : undefined
  useEffect(() => {
    if (video && !active) video.pause()
  }, [video, active])
  useEffect(() => {
    if (!video || !source) return
    return retainVideoBuffer(video, source)
  }, [video, source])
  return (
    <VideoPlayer>
      <div className="sasu-player swipe-preview">
        <Container
          className="media-skin media-container content-viewer__video-player"
          data-theme="default"
          data-preset="video"
        >
          {item?.video_url ? (
            <Video
              ref={setVideo}
              src={mediaUrl(item.video_url)}
              muted={!active}
              playsInline
              preload="auto"
              tabIndex={-1}
              aria-label={item.title ?? '학습 영상'}
            />
          ) : loading && !active ? (
            <VideoLoading />
          ) : null}
          {/* 활성 화면이 붙기 전에도 영상과 정보·버튼을 같은 슬롯에서 함께 보여 준다. */}
          <div className="swipe-preview__overlay" inert aria-hidden="true">
            <FeedVideoPlayer
              disabled
              playPrompt={false}
              pausedByUser={false}
              onTogglePlayback={() => {}}
              onLike={() => {}}
            >
              <ContentVideoOverlay
                content={item}
                panelOpen={viewport?.materialPanel.open ?? false}
                {...overlay}
              />
            </FeedVideoPlayer>
          </div>
          {mediaHost}
        </Container>
      </div>
      <BufferedVideoContext value={video}>
        {active && (!item?.video_url || video) ? children : null}
      </BufferedVideoContext>
    </VideoPlayer>
  )
}
