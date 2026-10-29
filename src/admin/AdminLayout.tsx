import { NavLink, useLocation, useNavigate } from 'react-router'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useSession } from '../state/session'
import { Button, Spinner, StateBlock } from './ui'
import { Icon, type IconName } from './Icon'
import { RequestFeedback, RequestError } from './RequestFeedback'
import './admin.css'

interface NavItem {
  to: string
  label: string
  icon: IconName
}

const ADMIN_NAV: NavItem[] = [
  { to: '/admin/contents', label: '콘텐츠', icon: 'contents' },
  { to: '/admin/materials', label: '학습자료', icon: 'materials' },
  { to: '/admin/series', label: '시리즈', icon: 'series' },
  { to: '/admin/categories', label: '분야', icon: 'categories' },
  { to: '/admin/stats', label: '통계', icon: 'stats' },
  { to: '/admin/reset', label: '초기화', icon: 'reset' },
]

export function AdminLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const session = useSession()
  const location = useLocation()
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 760px)').matches)
  const [mobileOpen, setMobileOpen] = useState(false)
  const drawerRef = useRef<HTMLDialogElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const currentMenu =
    ADMIN_NAV.find((item) => location.pathname.startsWith(item.to))?.label ?? '관리자'

  useEffect(() => {
    const media = window.matchMedia('(max-width: 760px)')
    const onChange = () => {
      setIsMobile(media.matches)
      setMobileOpen(false)
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    const dialog = drawerRef.current
    if (!dialog) return
    if (mobileOpen && isMobile) {
      dialog.showModal()
      closeRef.current?.focus()
    } else {
      dialog.close()
    }
  }, [mobileOpen, isMobile])

  useEffect(() => {
    if (!mobileOpen || !isMobile) return
    const scrollY = window.scrollY
    const body = document.body
    const previous = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      overflow: body.style.overflow,
    }
    Object.assign(body.style, {
      position: 'fixed',
      top: `-${scrollY}px`,
      width: '100%',
      overflow: 'hidden',
    })
    return () => {
      Object.assign(body.style, previous)
      window.scrollTo(0, scrollY)
    }
  }, [mobileOpen, isMobile])
  const brandRef = useRef<HTMLButtonElement>(null)
  const [collapsed, setCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem('sasu.admin.sidebarCollapsed')
      if (saved !== null) return saved === 'true'
    } catch {
      /* 브라우저 저장소를 사용할 수 없어도 메뉴는 동작한다. */
    }
    return false
  })
  const toggleSidebar = () => {
    const next = !collapsed
    setCollapsed(next)
    if (next) brandRef.current?.focus()
    try {
      localStorage.setItem('sasu.admin.sidebarCollapsed', String(next))
    } catch {
      /* 접기 상태는 현재 화면에서 유지한다. */
    }
  }

  const compact = !isMobile && collapsed
  const navigation = (
    <>
      <div className="admin-nav__header">
        <button
          type="button"
          className="admin-nav__brand"
          ref={brandRef}
          onClick={compact ? toggleSidebar : () => navigate('/')}
          aria-label={compact ? '사이드바 펼치기' : 'SASU 홈'}
          aria-expanded={compact ? false : undefined}
          aria-controls={compact ? 'admin-navigation-panel' : undefined}
          title={compact ? '사이드바 펼치기' : 'SASU 홈'}
        >
          <span className="admin-nav__mark" aria-hidden="true">
            <span className="admin-nav__mark-letter">S</span>
            <span className="admin-nav__mark-expand">
              <Icon name="chevronRight" size={22} />
            </span>
          </span>
          <span className="admin-nav__brand-text">
            SASU<span>ADMIN WORKSPACE</span>
          </span>
        </button>
        {!compact && (
          <button
            type="button"
            className="admin-nav__toggle"
            ref={closeRef}
            onClick={isMobile ? () => setMobileOpen(false) : toggleSidebar}
            aria-expanded={isMobile ? undefined : true}
            aria-controls={isMobile ? undefined : 'admin-navigation-panel'}
            aria-label={isMobile ? '메뉴 닫기' : '사이드바 접기'}
            title={isMobile ? '메뉴 닫기' : '사이드바 접기'}
          >
            <Icon name={isMobile ? 'close' : 'panel'} size={18} />
          </button>
        )}
      </div>
      <div className="admin-nav__panel" id="admin-navigation-panel">
        <p className="admin-nav__caption">워크스페이스</p>
        <nav className="admin-nav__list">
          {ADMIN_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              aria-label={item.label}
              title={compact ? item.label : undefined}
              className={({ isActive }) => `admin-nav__item ${isActive ? 'admin-is-active' : ''}`}
            >
              <Icon name={item.icon} />
              <span className="admin-nav__label">{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <button
          type="button"
          className="admin-nav__switch"
          onClick={() => navigate('/learner/search')}
          aria-label="학습자 화면으로 이동"
          title={compact ? '학습자 화면으로 이동' : undefined}
        >
          <Icon name="arrow" size={18} />
          <span className="admin-nav__label">학습자 화면으로</span>
        </button>
      </div>
    </>
  )

  return (
    <div className={`admin-shell${compact ? ' admin-shell--collapsed' : ''}`}>
      {isMobile ? (
        <>
          <header className="admin-mobile-header">
            <button
              type="button"
              className="admin-mobile-header__menu"
              onClick={() => setMobileOpen(true)}
              aria-label="관리자 메뉴 열기"
              aria-expanded={mobileOpen}
              aria-controls="admin-mobile-drawer"
            >
              <Icon name="menu" size={22} />
            </button>
            <span className="admin-mobile-header__brand">SASU</span>
            <span className="admin-mobile-header__current">{currentMenu}</span>
          </header>
          <dialog
            ref={drawerRef}
            id="admin-mobile-drawer"
            className="admin-mobile-drawer"
            aria-label="관리자 메뉴"
            onCancel={() => setMobileOpen(false)}
            onClose={() => setMobileOpen(false)}
            onClick={(event) => {
              if (event.target === event.currentTarget) setMobileOpen(false)
            }}
          >
            <div className="admin-nav">{navigation}</div>
          </dialog>
        </>
      ) : (
        <aside className="admin-nav" aria-label="관리자 메뉴">
          {navigation}
        </aside>
      )}
      <main className="admin-content">
        <RequestFeedback key={`${location.pathname}:${session.actorId}:${session.generation}`}>
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
            <Spinner label="사용자 정보 불러오는 중" />
          ) : session.error && session.actorId === null ? (
            <RequestError
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
        </RequestFeedback>
      </main>
    </div>
  )
}
