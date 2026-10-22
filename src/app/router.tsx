import { Route, Routes } from 'react-router'

import { HomePage } from '../pages/HomePage'
import { ContentListPage } from '../pages/admin/ContentListPage'
import { FeedPage } from '../pages/learner/FeedPage'

export function AppRouter() {
  return (
    <Routes>
      {/* 모드 선택(로컬 시연용) */}
      <Route path="/" element={<HomePage />} />
      {/* 학습자 피드(화면 설계서 L02) */}
      <Route path="/learner/feed" element={<FeedPage />} />
      {/* 관리자 콘텐츠 목록(화면 설계서 A01) */}
      <Route path="/admin/contents" element={<ContentListPage />} />
    </Routes>
  )
}
