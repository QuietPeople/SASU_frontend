import type { ReactNode } from 'react'
import './feed-end.css'

export function FeedEndCard({ empty, children }: { empty: boolean; children?: ReactNode }) {
  return (
    <div className="sasu-player feed-end">
      <div className="feed-end__body">
        <span className="feed-end__icon" aria-hidden="true">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {empty ? (
              <>
                <rect x="3" y="4" width="18" height="16" rx="4" />
                <path d="m10 8 6 4-6 4z" />
              </>
            ) : (
              <path d="m6 12 4 4 8-8" />
            )}
          </svg>
        </span>
        <h2>{empty ? '지금은 추천 영상이 없어요' : '추천 목록을 모두 둘러봤어요'}</h2>
        <p>
          {empty
            ? '추천을 다시 불러오거나 검색에서 다른 영상을 찾아보세요.'
            : '새로운 추천을 불러오거나 이전 영상으로 돌아갈 수 있어요.'}
        </p>
        {children && <div className="feed-end__actions">{children}</div>}
      </div>
    </div>
  )
}
