import type { ReactNode } from 'react'

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
}

export function MenuIcon({ name, size = 20 }: { name: string; size?: number }) {
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
