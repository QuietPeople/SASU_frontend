import type { ReactNode, Ref } from 'react'
import type { LearningContent } from '../../api/learning'

interface ContentVideoOverlayProps {
  content?: LearningContent
  viewCount?: number
  watched?: boolean | null
  recommendationLabel?: string
  listIndex?: number
  listTotal?: number
  panelOpen: boolean
  panelId?: string
  panelToggle?: Ref<HTMLButtonElement>
  reactionPending?: boolean
  showSeriesBack?: boolean
  navigationPending?: boolean
  onBackToSeries?: () => void
  onLike?: () => void
  onSave?: () => void
  onTogglePanel?: () => void
  children?: ReactNode
}

// 사전 로딩 화면과 활성 영상이 같은 정보·버튼 배치를 사용한다.
export function ContentVideoOverlay({
  content,
  viewCount,
  watched = content?.watch_completed,
  recommendationLabel,
  listIndex,
  listTotal,
  panelOpen,
  panelId,
  panelToggle,
  reactionPending = false,
  showSeriesBack = false,
  navigationPending = false,
  onBackToSeries,
  onLike,
  onSave,
  onTogglePanel,
  children,
}: ContentVideoOverlayProps) {
  return (
    <>
      <header className="sasu-feed__head">
        <h1 className="sasu-title">{content?.title ?? '제목 없음'}</h1>
        <div className="content-viewer__metadata">
          <div className="sasu-metaline">
            <span className="sasu-metaline__cat">{content?.category?.name ?? '미지정'}</span>
            {content?.tags.map((tag) => (
              <span className="sasu-metaline__tag" key={tag.name}>
                #{tag.name}
              </span>
            ))}
          </div>
          <span className="content-viewer__views">
            조회수 {viewCount ?? content?.view_count ?? 0}
          </span>
        </div>
      </header>
      {children}
      <div className="sasu-ov-top">
        <div className="content-viewer__status">
          {listIndex && listTotal ? (
            <span className="sasu-ov-pill sasu-ov-pill--idx">
              {listIndex} / {listTotal}
            </span>
          ) : null}
          <span className="sasu-ov-pill">{watched ? '시청 완료' : '시청 전'}</span>
        </div>
        {recommendationLabel ? (
          <div className="content-viewer__recommendation">{recommendationLabel}</div>
        ) : null}
      </div>

      <div className="sasu-ov">
        {showSeriesBack && (
          <div className="sasu-ov__item">
            <button
              type="button"
              className="sasu-ov__btn"
              aria-label="시리즈로 돌아가기"
              title="시리즈로 돌아가기"
              disabled={navigationPending}
              onClick={onBackToSeries}
            >
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                <path d="m10 5-7 7 7 7M3 12h18" />
              </svg>
            </button>
            <span className="sasu-ov__count">돌아가기</span>
          </div>
        )}
        <div className="sasu-ov__item">
          <button
            type="button"
            className={`sasu-ov__btn sasu-ov__btn--like ${content?.liked ? 'is-on' : ''}`}
            aria-pressed={content?.liked ?? false}
            aria-label="좋아요"
            disabled={reactionPending}
            onClick={onLike}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78Z" />
            </svg>
          </button>
          <span className="sasu-ov__count">{content?.like_count ?? 0}</span>
        </div>
        <div className="sasu-ov__item">
          <button
            type="button"
            className={`sasu-ov__btn sasu-ov__btn--save ${content?.saved ? 'is-on' : ''}`}
            aria-pressed={content?.saved ?? false}
            aria-label={content?.saved ? '보관함에 저장됨' : '보관함에 저장'}
            disabled={reactionPending}
            onClick={onSave}
          >
            <svg viewBox="0 0 24 24" width="22" height="22">
              <path d="M6 3h12a1 1 0 0 1 1 1v16l-7-4-7 4V4a1 1 0 0 1 1-1z" />
            </svg>
          </button>
          <span className="sasu-ov__count">저장</span>
        </div>
        <div className="sasu-ov__item">
          <button
            type="button"
            className={`sasu-ov__btn sasu-ov__btn--materials ${panelOpen ? 'is-on' : ''}`}
            ref={panelToggle}
            aria-controls={panelId}
            aria-expanded={panelOpen}
            aria-label={panelOpen ? '학습자료 접기' : '학습자료 펼치기'}
            onClick={onTogglePanel}
          >
            <svg
              className="content-viewer__materials-icon"
              viewBox="0 0 24 24"
              width="22"
              height="22"
              aria-hidden="true"
            >
              <path d="M3 4.5c3.2-1.2 6-.7 9 1.2v15c-3-1.9-5.8-2.4-9-1.2zM21 4.5c-3.2-1.2-6-.7-9 1.2v15c3-1.9 5.8-2.4 9-1.2z" />
            </svg>
          </button>
          <span className="sasu-ov__count">학습자료</span>
        </div>
      </div>
    </>
  )
}
