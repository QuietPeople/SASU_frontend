import { useContext, useEffectEvent, useLayoutEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { SwipeContext } from './swipeContext'
import type { VideoDirection } from './viewerSession'

// 활성 항목만 플레이어·학습 훅을 실행하고, 스크롤 영역과 항목 슬롯은 상위에서 유지한다.
export function SwipeScene({
  media,
  panel,
  children,
  panelPending = false,
  review = false,
  onNavigate,
  onInteraction,
}: {
  media: ReactNode
  panel?: ReactNode
  children?: ReactNode
  panelPending?: boolean
  review?: boolean
  onNavigate?: (direction: VideoDirection) => Promise<boolean>
  onInteraction?: (active: boolean) => void
}) {
  const host = useContext(SwipeContext)
  if (!host) throw new Error('SwipeScene에는 SwipeViewport가 필요합니다.')
  const navigate = useEffectEvent(async (direction: VideoDirection) =>
    onNavigate ? onNavigate(direction) : false,
  )
  const interaction = useEffectEvent((active: boolean) => onInteraction?.(active))
  const { bind, setAppearance } = host
  const hasPanel = panel != null
  useLayoutEffect(() => bind({ navigate, interaction }), [bind])
  useLayoutEffect(() => {
    setAppearance({ hasPanel, panelPending, review })
  }, [setAppearance, hasPanel, panelPending, review])
  return (
    <>
      {host.media && createPortal(media, host.media)}
      {host.extras && createPortal(children, host.extras)}
      {host.panel && createPortal(panel, host.panel)}
    </>
  )
}
