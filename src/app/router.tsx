import { Link, Route, Routes } from 'react-router'

import { ContentListPage } from '../pages/admin/ContentListPage'
import { FeedPage } from '../pages/learner/FeedPage'
import styles from './App.module.css'

export function AppRouter() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <main className={styles.placeholder}>
            <h1>SASU</h1>
            <p>
              <Link to="/learner/feed">학습자 피드</Link>
            </p>
            <p>
              <Link to="/admin/contents">관리자 콘텐츠 목록</Link>
            </p>
          </main>
        }
      />
      <Route path="/learner/feed" element={<FeedPage />} />
      <Route path="/admin/contents" element={<ContentListPage />} />
    </Routes>
  )
}
