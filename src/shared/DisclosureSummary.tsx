import type { ReactNode } from 'react'
import './disclosure.css'

export function DisclosureSummary({ children, meta }: { children: ReactNode; meta?: ReactNode }) {
  return (
    <summary className="sasu-disclosure-summary">
      <span className="sasu-disclosure-summary__label">{children}</span>
      {meta != null && <span className="sasu-disclosure-summary__meta">{meta}</span>}
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="m7 10 5 5 5-5" />
      </svg>
    </summary>
  )
}
