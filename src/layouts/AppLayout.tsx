import { NavLink, useNavigate } from 'react-router';
import type { ReactNode } from 'react';

// 공통 레이아웃: 왼쪽 내비게이션 + 본문(화면 설계서 1-1·1-2).
// 학습자/관리자 전환은 로컬 데모의 작업 구분이며 로그인·권한 기능이 아님(화면 설계서 1-1).

interface NavItem {
  to: string;
  label: string;
}

const LEARNER_NAV: NavItem[] = [
  { to: '/learner/feed', label: '피드' },
  { to: '/learner/search', label: '검색' },
  { to: '/learner/series', label: '시리즈' },
  { to: '/learner/library', label: '보관함' },
  { to: '/learner/dashboard', label: '대시보드' },
  { to: '/learner/settings', label: '설정' },
];

const ADMIN_NAV: NavItem[] = [
  { to: '/admin/contents', label: '콘텐츠' },
  { to: '/admin/materials', label: '학습자료' },
  { to: '/admin/series', label: '시리즈' },
  { to: '/admin/categories', label: '분야' },
  { to: '/admin/stats', label: '통계' },
  { to: '/admin/reset', label: '초기화' },
];

export function AppLayout({ role, children }: { role: 'learner' | 'admin'; children: ReactNode }) {
  const navigate = useNavigate();
  const items = role === 'learner' ? LEARNER_NAV : ADMIN_NAV;
  const switchTo = role === 'learner' ? '/admin/contents' : '/learner/feed';
  const switchLabel = role === 'learner' ? '관리자 화면' : '학습자 화면';

  return (
    <div className="sasu-shell">
      <aside className="sasu-nav" aria-label={role === 'learner' ? '학습자 메뉴' : '관리자 메뉴'}>
        <button type="button" className="sasu-nav__brand" onClick={() => navigate(switchTo === '/admin/contents' ? '/learner/feed' : '/admin/contents')} aria-label="SASU 홈">
          SASU
        </button>
        <nav className="sasu-nav__list">
          {items.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => `sasu-nav__item ${isActive ? 'is-active' : ''}`}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <button type="button" className="sasu-nav__switch" onClick={() => navigate(switchTo)}>
          {switchLabel} →
        </button>
      </aside>
      <main className="sasu-content">{children}</main>
    </div>
  );
}
