import { useNavigate } from 'react-router'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { FeedbackProvider } from './FeedbackProvider'
import './sidebar.css'

const iconPaths = {
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

function MenuIcon({ name, size = 20 }: { name: keyof typeof iconPaths; size?: number }) {
  return (
    <svg
      className="sidebar-icon"
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
      {iconPaths[name]}
    </svg>
  )
}

interface SidebarNavigationState {
  compact: boolean
  closeMenu: () => void
}

export function SidebarLayout({
  children,
  scope,
  menuLabel,
  currentMenu,
  subtitle,
  caption,
  navigation,
  switchTo,
  switchLabel,
  switchAriaLabel = switchLabel,
}: {
  children: ReactNode
  scope: 'admin' | 'learner'
  menuLabel: string
  currentMenu: string
  subtitle: string
  caption: string
  navigation: (state: SidebarNavigationState) => ReactNode
  switchTo: string
  switchLabel: string
  switchAriaLabel?: string
}) {
  const navigate = useNavigate()
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 760px)').matches)
  const [mobileOpen, setMobileOpen] = useState(false)
  const drawerRef = useRef<HTMLDialogElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const brandRef = useRef<HTMLButtonElement>(null)
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(`sasu.${scope}.sidebarCollapsed`) === 'true'
    } catch {
      return false
    }
  })
  const compact = collapsed && !isMobile

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
      localStorage.setItem(`sasu.${scope}.sidebarCollapsed`, String(next))
    } catch {
      /* 저장소를 사용할 수 없어도 현재 화면의 접기 상태는 유지한다. */
    }
  }
  const go = (path: string) => {
    setMobileOpen(false)
    navigate(path)
  }
  const panel = (
    <>
      <div className={`${scope}-nav__header`}>
        <button
          type="button"
          className={`${scope}-nav__brand`}
          ref={brandRef}
          onClick={compact ? toggleSidebar : () => go('/')}
          aria-label={compact ? '사이드바 펼치기' : 'SASU 홈'}
          title={compact ? '사이드바 펼치기' : 'SASU 홈'}
          aria-expanded={compact ? false : undefined}
          aria-controls={compact ? `${scope}-navigation-panel` : undefined}
        >
          <span className={`${scope}-nav__mark`} aria-hidden="true">
            <span className={`${scope}-nav__mark-letter`}>S</span>
            <span className={`${scope}-nav__mark-expand`}>
              <MenuIcon name="expand" size={22} />
            </span>
          </span>
          <span className={`${scope}-nav__brand-text`}>
            SASU<span>{subtitle}</span>
          </span>
        </button>
        {!compact && (
          <button
            type="button"
            className={`${scope}-nav__toggle`}
            ref={closeRef}
            onClick={isMobile ? () => setMobileOpen(false) : toggleSidebar}
            aria-label={isMobile ? '메뉴 닫기' : '사이드바 접기'}
            title={isMobile ? '메뉴 닫기' : '사이드바 접기'}
            aria-expanded={isMobile ? undefined : true}
            aria-controls={isMobile ? undefined : `${scope}-navigation-panel`}
          >
            <MenuIcon name={isMobile ? 'close' : 'panel'} size={18} />
          </button>
        )}
      </div>
      <div className={`${scope}-nav__panel`} id={`${scope}-navigation-panel`}>
        <p className={`${scope}-nav__caption`}>{caption}</p>
        {navigation({ compact, closeMenu: () => setMobileOpen(false) })}
        <button
          type="button"
          className={`${scope}-nav__switch`}
          onClick={() => go(switchTo)}
          aria-label={switchAriaLabel}
          title={compact ? switchAriaLabel : undefined}
        >
          <MenuIcon name="arrow" size={18} />
          <span className={`${scope}-nav__label`}>{switchLabel}</span>
        </button>
      </div>
    </>
  )
  return (
    <div className={`${scope}-shell${compact ? ` ${scope}-shell--collapsed` : ''}`}>
      {isMobile ? (
        <>
          <header className={`${scope}-mobile-header`}>
            <button
              type="button"
              className={`${scope}-mobile-header__menu`}
              onClick={() => setMobileOpen(true)}
              aria-label={`${menuLabel} 열기`}
              aria-expanded={mobileOpen}
              aria-controls={`${scope}-mobile-drawer`}
            >
              <MenuIcon name="menu" size={22} />
            </button>
            <span className={`${scope}-mobile-header__brand`}>SASU</span>
            <span className={`${scope}-mobile-header__current`}>{currentMenu}</span>
          </header>
          <dialog
            ref={drawerRef}
            id={`${scope}-mobile-drawer`}
            className={`${scope}-mobile-drawer`}
            aria-label={menuLabel}
            onCancel={() => setMobileOpen(false)}
            onClose={() => setMobileOpen(false)}
            onClick={(event) => {
              if (event.target === event.currentTarget) setMobileOpen(false)
            }}
          >
            <div className={`${scope}-nav`}>{panel}</div>
          </dialog>
        </>
      ) : (
        <aside className={`${scope}-nav`} aria-label={menuLabel}>
          {panel}
        </aside>
      )}
      <FeedbackProvider>{children}</FeedbackProvider>
    </div>
  )
}
