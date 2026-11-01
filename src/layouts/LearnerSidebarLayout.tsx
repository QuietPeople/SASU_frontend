import { NavLink, useLocation, useNavigate } from 'react-router'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import './learner-sidebar.css'

interface MenuItem {
  to: string
  label: string
}

const iconPaths: Record<string, ReactNode> = {
  feed: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <path d="m10 8 6 4-6 4z" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 5 5" />
    </>
  ),
  series: (
    <>
      <rect x="8" y="3" width="13" height="5" rx="1.5" />
      <rect x="8" y="16" width="13" height="5" rx="1.5" />
      <path d="M3 5v13h5M3 5h5M14 8v8" />
    </>
  ),
  library: (
    <>
      <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1Z" />
      <path d="M9 8h6" />
    </>
  ),
  dashboard: <path d="M4 3v17h17M9 15V9M14 15V5M19 15v-4" />,
  settings: (
    <>
      <path d="M4 7h16M4 17h16" />
      <circle cx="9" cy="7" r="2" fill="white" />
      <circle cx="15" cy="17" r="2" fill="white" />
    </>
  ),
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  expand: <path d="m10 6 6 6-6 6" />,
  panel: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
    </>
  ),
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
}

function MenuIcon({ name, size = 20 }: { name: string; size?: number }) {
  return (
    <svg
      className="learner-nav__icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {iconPaths[name] ?? iconPaths.feed}
    </svg>
  )
}

export function LearnerSidebarLayout({
  children,
  items,
  switchTo,
  switchLabel,
}: {
  children: ReactNode
  items: readonly MenuItem[]
  switchTo: string
  switchLabel: string
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 760px)').matches)
  const [mobileOpen, setMobileOpen] = useState(false)
  const drawerRef = useRef<HTMLDialogElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const brandRef = useRef<HTMLButtonElement>(null)
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('sasu.learner.sidebarCollapsed') === 'true'
    } catch {
      return false
    }
  })
  const compact = collapsed && !isMobile
  const currentMenu = items.find((item) => location.pathname.startsWith(item.to))?.label ?? '학습'

  useEffect(() => {
    const media = window.matchMedia('(max-width: 760px)')
    const change = () => {
      setIsMobile(media.matches)
      setMobileOpen(false)
    }
    media.addEventListener('change', change)
    return () => media.removeEventListener('change', change)
  }, [])

  useEffect(() => {
    const dialog = drawerRef.current
    if (!dialog) return
    if (mobileOpen && isMobile) {
      dialog.showModal()
      closeRef.current?.focus()
    } else dialog.close()
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

  const toggleSidebar = () => {
    const next = !collapsed
    setCollapsed(next)
    if (next) brandRef.current?.focus()
    try {
      localStorage.setItem('sasu.learner.sidebarCollapsed', String(next))
    } catch {
      /* 저장소를 사용할 수 없어도 현재 화면의 접기 상태는 유지한다. */
    }
  }
  const go = (path: string) => {
    setMobileOpen(false)
    navigate(path)
  }
  const navigation = (
    <>
      <div className="learner-nav__header">
        <button
          type="button"
          className="learner-nav__brand"
          ref={brandRef}
          onClick={compact ? toggleSidebar : () => go('/')}
          aria-label={compact ? '사이드바 펼치기' : 'SASU 홈'}
          title={compact ? '사이드바 펼치기' : 'SASU 홈'}
          aria-expanded={compact ? false : undefined}
          aria-controls={compact ? 'learner-navigation-panel' : undefined}
        >
          <span className="learner-nav__mark" aria-hidden="true">
            <span className="learner-nav__mark-letter">S</span>
            <span className="learner-nav__mark-expand">
              <MenuIcon name="expand" size={22} />
            </span>
          </span>
          <span className="learner-nav__brand-text">
            SASU<span>LEARNING SPACE</span>
          </span>
        </button>
        {!compact && (
          <button
            type="button"
            className="learner-nav__toggle"
            ref={closeRef}
            onClick={isMobile ? () => setMobileOpen(false) : toggleSidebar}
            aria-label={isMobile ? '메뉴 닫기' : '사이드바 접기'}
            title={isMobile ? '메뉴 닫기' : '사이드바 접기'}
            aria-expanded={isMobile ? undefined : true}
            aria-controls={isMobile ? undefined : 'learner-navigation-panel'}
          >
            <MenuIcon name={isMobile ? 'close' : 'panel'} size={18} />
          </button>
        )}
      </div>
      <div className="learner-nav__panel" id="learner-navigation-panel">
        <p className="learner-nav__caption">내 학습 공간</p>
        <nav className="learner-nav__list">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              aria-label={item.label}
              title={compact ? item.label : undefined}
              className={({ isActive }) => `learner-nav__item${isActive ? ' is-active' : ''}`}
            >
              <MenuIcon name={item.to.split('/').at(-1) ?? 'feed'} />
              <span className="learner-nav__label">{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <button
          type="button"
          className="learner-nav__switch"
          onClick={() => go(switchTo)}
          aria-label={`${switchLabel} →`}
          title={compact ? switchLabel : undefined}
        >
          <MenuIcon name="arrow" size={18} />
          <span className="learner-nav__label">{switchLabel}</span>
        </button>
      </div>
    </>
  )
  return (
    <div className={`learner-shell${compact ? ' learner-shell--collapsed' : ''}`}>
      {isMobile ? (
        <>
          <header className="learner-mobile-header">
            <button
              type="button"
              className="learner-mobile-header__menu"
              onClick={() => setMobileOpen(true)}
              aria-label="학습자 메뉴 열기"
              aria-expanded={mobileOpen}
              aria-controls="learner-mobile-drawer"
            >
              <MenuIcon name="menu" size={22} />
            </button>
            <span className="learner-mobile-header__brand">SASU</span>
            <span className="learner-mobile-header__current">{currentMenu}</span>
          </header>
          <dialog
            ref={drawerRef}
            id="learner-mobile-drawer"
            className="learner-mobile-drawer"
            aria-label="학습자 메뉴"
            onCancel={() => setMobileOpen(false)}
            onClose={() => setMobileOpen(false)}
            onClick={(event) => {
              if (event.target === event.currentTarget) setMobileOpen(false)
            }}
          >
            <div className="learner-nav">{navigation}</div>
          </dialog>
        </>
      ) : (
        <aside className="learner-nav" aria-label="학습자 메뉴">
          {navigation}
        </aside>
      )}
      {children}
    </div>
  )
}
