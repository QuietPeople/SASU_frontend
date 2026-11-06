import { useState, type ReactNode } from 'react'
import { FeedbackHosts } from './feedbackContext'
import './feedback.css'

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<HTMLDivElement | null>(null)
  const [snackbar, setSnackbar] = useState<HTMLDivElement | null>(null)
  return (
    <FeedbackHosts.Provider value={{ toast, snackbar }}>
      {children}
      <div
        ref={setToast}
        popover="manual"
        className="sasu-feedback-stack sasu-feedback-stack--toast"
      />
      <div
        ref={setSnackbar}
        popover="manual"
        className="sasu-feedback-stack sasu-feedback-stack--snackbar"
      />
    </FeedbackHosts.Provider>
  )
}
