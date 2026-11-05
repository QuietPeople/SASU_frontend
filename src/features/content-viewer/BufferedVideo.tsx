import { useEffect, useState, type ReactNode } from 'react'
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
import '@videojs/react/video/skin.css'

// 같은 영상 요소를 미리보기에서 실제 재생까지 유지한다. 학습 처리는 children의 활성 화면만 수행한다.
export function BufferedVideo({
  identity,
  contentId,
  content,
  active,
  mediaHost,
  children,
}: {
  identity: LearningIdentity
  contentId: number
  content?: LearningContent
  active: boolean
  mediaHost: ReactNode
  children: ReactNode
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
}: {
  item: LearningContent | undefined
  active: boolean
  mediaHost: ReactNode
  children: ReactNode
  loading: boolean
}) {
  const [video, setVideo] = useState<HTMLVideoElement | null>(null)
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
          {!active && <p className="swipe-preview__title">{item?.title ?? '학습 영상'}</p>}
          {mediaHost}
        </Container>
      </div>
      <BufferedVideoContext value={video}>
        {active && (!item?.video_url || video) ? children : null}
      </BufferedVideoContext>
    </VideoPlayer>
  )
}

export function SwipeEndPreview() {
  return (
    <div className="sasu-player swipe-preview__end">
      <strong>추천 영상을 모두 확인했어요.</strong>
      <p>새로운 추천을 불러올 수 있어요.</p>
    </div>
  )
}
