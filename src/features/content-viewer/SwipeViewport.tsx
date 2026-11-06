import { Skeleton } from '../../shared/Skeleton'
import {
  useCallback,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { bindScrollNavigation } from './swipeNavigation'
import { SwipeContext, type MaterialPanelState, type SwipeSceneHandlers } from './swipeContext'
import type { VideoDirection } from './viewerSession'
import { videoPreloadWindow } from './preloadPolicy'
import './content-viewer.css'
import './swipe-viewport.css'

export interface SwipeItem {
  key: string
  preview?: ReactNode
  renderVideo?: (mediaHost: ReactNode, activeContent: ReactNode, active: boolean) => ReactNode
}

export function SwipeViewport({
  items,
  activeKey,
  children,
}: {
  items: SwipeItem[]
  activeKey: string
  children: ReactNode
}) {
  const viewport = useRef<HTMLDivElement>(null)
  const controller = useRef<ReturnType<typeof bindScrollNavigation> | null>(null)
  const handlers = useRef<SwipeSceneHandlers | null>(null)
  const [mediaSlot, setMediaSlot] = useState<{ key: string; node: HTMLDivElement } | null>(null)
  const media = mediaSlot?.key === activeKey ? mediaSlot.node : null
  const setMedia = useCallback(
    (node: HTMLDivElement | null) => {
      setMediaSlot(node ? { key: activeKey, node } : null)
    },
    [activeKey],
  )
  const [extras, setExtras] = useState<HTMLDivElement | null>(null)
  const [panel, setPanel] = useState<HTMLDivElement | null>(null)
  const [materialPanel, setMaterialPanel] = useState<MaterialPanelState>({
    open: false,
    tab: 'core',
  })
  const [appearance, setAppearance] = useState({
    hasPanel: false,
    panelPending: false,
    review: false,
  })
  const panelOpen =
    materialPanel.open && !appearance.review && (appearance.hasPanel || appearance.panelPending)
  const [pending, setPending] = useState(false)
  const index = Math.max(
    0,
    items.findIndex((item) => item.key === activeKey),
  )
  const preload = videoPreloadWindow(
    items.map((item) => Boolean(item.renderVideo)),
    index,
  )
  const activeIndex = useEffectEvent(() => index)
  const count = useEffectEvent(() => items.length)
  const navigate = useEffectEvent(async (direction: VideoDirection) =>
    handlers.current ? handlers.current.navigate(direction) : false,
  )
  const onInteraction = useEffectEvent((active: boolean) => handlers.current?.interaction(active))
  const bind = useCallback((value: SwipeSceneHandlers) => {
    handlers.current = value
    return () => {
      if (handlers.current === value) handlers.current = null
    }
  }, [])
  useLayoutEffect(() => {
    if (!viewport.current) return
    const navigation = bindScrollNavigation(viewport.current, {
      activeIndex,
      count,
      navigate,
      onInteraction,
      onPending: setPending,
    })
    controller.current = navigation
    const resize = new ResizeObserver(navigation.resize)
    resize.observe(viewport.current)
    return () => {
      resize.disconnect()
      navigation.dispose()
      controller.current = null
    }
  }, [])
  useLayoutEffect(() => {
    controller.current?.sync()
  }, [activeKey, index])
  const host = useMemo(
    () => ({ media, extras, panel, materialPanel, setMaterialPanel, bind, setAppearance }),
    [media, extras, panel, materialPanel, bind],
  )

  return (
    <SwipeContext value={host}>
      <div
        className={`sasu-page sasu-feed content-viewer ${panelOpen ? '' : 'is-lp-closed'} ${appearance.review ? 'feed-review' : ''}`}
      >
        <div className="sasu-feed__main">
          <div className="sasu-feed__stage">
            <div className="swipe-viewport">
              <div
                ref={viewport}
                className="swipe-viewport__scroll"
                role="region"
                aria-label="영상 및 복기 카드"
                tabIndex={0}
                aria-busy={pending || undefined}
              >
                {items.map((item, itemIndex) => {
                  const isActive = item.key === activeKey
                  const mediaHost = (
                    <div className="swipe-viewport__media" ref={isActive ? setMedia : undefined} />
                  )
                  const activeContent = isActive && media && extras && panel ? children : null
                  return (
                    <div
                      key={item.key}
                      className="swipe-viewport__slot"
                      data-active={item.key === activeKey || undefined}
                      aria-hidden={item.key !== activeKey || undefined}
                      inert={item.key !== activeKey}
                    >
                      {item.renderVideo ? (
                        preload.has(itemIndex) ? (
                          item.renderVideo(mediaHost, activeContent, isActive)
                        ) : null
                      ) : (
                        <>
                          {mediaHost}
                          {isActive
                            ? activeContent
                            : Math.abs(itemIndex - index) <= 1
                              ? item.preview
                              : null}
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
              {pending && (
                <div className="swipe-viewport__pending">
                  <Skeleton variant="text" label="다음 항목 준비 중" />
                </div>
              )}
            </div>
          </div>
          <div className="swipe-viewport__extras" ref={setExtras} />
        </div>
        <div className="swipe-viewport__panel" ref={setPanel}>
          {panelOpen && appearance.panelPending && !appearance.hasPanel && (
            <>
              <button
                type="button"
                className="content-viewer__panel-backdrop"
                aria-label="학습자료 닫기"
                onClick={() => setMaterialPanel((previous) => ({ ...previous, open: false }))}
              />
              <aside
                className="sasu-lp"
                aria-label="학습자료"
                aria-busy="true"
                onKeyDown={(event) => {
                  if (event.key === 'Escape')
                    setMaterialPanel((previous) => ({ ...previous, open: false }))
                }}
              >
                <div className="sasu-lp__head">
                  <h2 className="sasu-lp__title">학습자료</h2>
                </div>
                <div className="content-viewer__panel-loading">
                  <Skeleton variant="form" label="학습자료 불러오는 중" />
                </div>
              </aside>
            </>
          )}
        </div>
      </div>
    </SwipeContext>
  )
}
