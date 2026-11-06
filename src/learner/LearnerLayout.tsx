import { NavLink, useLocation } from 'react-router'
import type { ReactNode } from 'react'
import { useSession } from '../state/session'
import { SidebarLayout } from '../shared/SidebarLayout'
import { ScreenLoading } from '../app/RouteContent'
import { Button, StateBlock } from './ui'
import { ErrorFeedback } from '../shared/ErrorFeedback'
import { MenuIcon } from './MenuIcon'
import './learner.css'
import './sidebar.css'
import './thumbnail.css'

const LEARNER_NAV: { to: string; label: string }[] = [
  { to: '/learner/feed', label: '피드' },
  { to: '/learner/search', label: '검색' },
  { to: '/learner/series', label: '시리즈' },
  { to: '/learner/library', label: '보관함' },
  { to: '/learner/dashboard', label: '대시보드' },
  { to: '/learner/settings', label: '설정' },
]

export function LearnerLayout({ children }: { children: ReactNode }) {
  const session = useSession()
  const location = useLocation()
  const currentMenu =
    LEARNER_NAV.find((item) => location.pathname.startsWith(item.to))?.label ?? '학습'

  return (
    <SidebarLayout
      scope="learner"
      menuLabel="학습자 메뉴"
      currentMenu={currentMenu}
      subtitle="LEARNING SPACE"
      caption="내 학습 공간"
      switchTo="/admin/contents"
      switchLabel="관리자 화면"
      switchAriaLabel="관리자 화면 →"
      navigation={({ compact, closeMenu }) => (
        <nav className="learner-nav__list">
          {LEARNER_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={closeMenu}
              aria-label={item.label}
              title={compact ? item.label : undefined}
              className={({ isActive }) => `learner-nav__item${isActive ? ' is-active' : ''}`}
            >
              <MenuIcon name={item.to.split('/').at(-1) ?? 'feed'} />
              <span className="learner-nav__label">{item.label}</span>
            </NavLink>
          ))}
        </nav>
      )}
    >
      <main className="sasu-content">
        {session.backgroundError ? (
          <ErrorFeedback
            title="사용자 정보를 갱신하지 못했어요."
            text="작성 중인 내용은 유지돼요."
            error={session.backgroundError}
            action={
              <Button
                onClick={() => {
                  void session.refreshSession()
                }}
              >
                다시 확인
              </Button>
            }
          />
        ) : null}
        {session.isPending ? (
          <ScreenLoading label="사용자 정보 불러오는 중" />
        ) : session.error && (session.actorId === null || !session.settings) ? (
          <ErrorFeedback
            variant="screen"
            title="서버 정보를 불러오지 못했어요."
            error={session.error}
            action={
              <Button
                onClick={() => {
                  void session.refreshSession()
                }}
              >
                다시 시도
              </Button>
            }
          />
        ) : session.actorId === null ? (
          <StateBlock
            title="학습자 사용자가 없습니다."
            text="서버에 등록된 사용자를 확인해 주세요."
          />
        ) : (
          children
        )}
      </main>
    </SidebarLayout>
  )
}
