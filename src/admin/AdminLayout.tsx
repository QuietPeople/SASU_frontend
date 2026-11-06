import { Fragment } from 'react'
import { NavLink, useLocation } from 'react-router'
import type { ReactNode } from 'react'
import { SidebarLayout } from '../shared/SidebarLayout'
import { useSession } from '../state/session'
import { Button, StateBlock } from './ui'
import { ScreenLoading } from '../app/RouteContent'
import { Icon, type IconName } from './Icon'
import { RequestError } from './RequestFeedback'
import './admin.css'
import './admin-uiux.css'

interface NavItem {
  to: string
  label: string
  icon: IconName
  group?: string
}

const ADMIN_NAV: NavItem[] = [
  { to: '/admin/contents', label: '콘텐츠', icon: 'contents' },
  { to: '/admin/categories', label: '분야 관리', icon: 'categories', group: 'sub' },
  { to: '/admin/materials', label: '학습자료', icon: 'materials', group: 'sub' },
  { to: '/admin/series', label: '시리즈', icon: 'series' },
  { to: '/admin/stats', label: '통계', icon: 'stats' },
  { to: '/admin/reset', label: '초기화', icon: 'reset', group: 'tools' },
]

const contentSubmenuIds = ADMIN_NAV.filter((item) => item.group === 'sub')
  .map((item) => `admin-content-submenu-${item.icon}`)
  .join(' ')

export function AdminLayout({ children }: { children: ReactNode }) {
  const session = useSession()
  const location = useLocation()
  const contentMenuOpen = /^\/admin\/(?:contents|categories|materials)(?:\/|$)/.test(
    location.pathname,
  )
  const currentMenu =
    ADMIN_NAV.find((item) => location.pathname.startsWith(item.to))?.label ?? '관리자'

  return (
    <SidebarLayout
      scope="admin"
      menuLabel="관리자 메뉴"
      currentMenu={currentMenu}
      subtitle="ADMIN WORKSPACE"
      caption="워크스페이스"
      switchTo="/learner/feed"
      switchLabel="학습자 화면으로"
      switchAriaLabel="학습자 화면으로 이동"
      navigation={({ compact, closeMenu }) => (
        <>
          <nav className="admin-nav__list">
            {ADMIN_NAV.filter(
              (item) => item.group !== 'tools' && (item.group !== 'sub' || contentMenuOpen),
            ).map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                id={item.group === 'sub' ? `admin-content-submenu-${item.icon}` : undefined}
                onClick={closeMenu}
                aria-label={item.label}
                aria-expanded={item.to === '/admin/contents' ? contentMenuOpen : undefined}
                aria-controls={
                  item.to === '/admin/contents' && contentMenuOpen ? contentSubmenuIds : undefined
                }
                title={compact ? item.label : undefined}
                className={({ isActive }) =>
                  `admin-nav__item ${item.group === 'sub' ? 'admin-nav__item--sub' : ''} ${isActive ? 'admin-is-active' : ''}`
                }
              >
                <Icon name={item.icon} />
                <span className="admin-nav__label">{item.label}</span>
              </NavLink>
            ))}
          </nav>
          <nav className="admin-nav__tools" aria-label="운영 도구">
            <p className="admin-nav__caption">운영 도구</p>
            <NavLink
              to="/admin/reset"
              onClick={() => closeMenu()}
              aria-label="초기화"
              title={compact ? '초기화' : undefined}
              className={({ isActive }) => `admin-nav__item ${isActive ? 'admin-is-active' : ''}`}
            >
              <Icon name="reset" />
              <span className="admin-nav__label">초기화</span>
            </NavLink>
          </nav>
        </>
      )}
    >
      <main className="admin-content">
        <Fragment key={`${location.pathname}:${session.actorId}:${session.generation}`}>
          {session.backgroundError ? (
            <RequestError
              title="사용자 정보 갱신에 실패했습니다. 작성 중인 내용은 유지됩니다."
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
          ) : session.error && session.actorId === null ? (
            <RequestError
              variant="screen"
              title="서버 정보를 불러오지 못했습니다."
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
              title="관리자 사용자가 없습니다."
              text="서버에 등록된 사용자를 확인해 주세요."
            />
          ) : (
            children
          )}
        </Fragment>
      </main>
    </SidebarLayout>
  )
}
