import { Route, Routes } from 'react-router'

import styles from './App.module.css'

export function AppRouter() {
  return (
    <Routes>
      {/* 실제 화면을 작성하면 pages의 컴포넌트를 여기에 연결합니다. */}
      <Route
        path="/"
        element={
          <main className={styles.placeholder}>
            <h1>SASU</h1>
          </main>
        }
      />
    </Routes>
  )
}
