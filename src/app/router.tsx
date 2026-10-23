import { Navigate, Route, Routes } from 'react-router'

import { HomePage } from '../pages/HomePage'
import { AppLayout } from '../layouts/AppLayout'
import { useSession } from '../state/session'
import { FeedPage } from '../pages/learner/FeedPage'
import { WelcomePage } from '../pages/learner/WelcomePage'
import { SearchPage } from '../pages/learner/SearchPage'
import { SeriesPage } from '../pages/learner/SeriesPage'
import { LibraryPage } from '../pages/learner/LibraryPage'
import { ReviewPage } from '../pages/learner/ReviewPage'
import { FlashcardPage } from '../pages/learner/FlashcardPage'
import { DashboardPage } from '../pages/learner/DashboardPage'
import { SettingsPage } from '../pages/learner/SettingsPage'
import { ContentListPage } from '../pages/admin/ContentListPage'
import { ContentFormPage } from '../pages/admin/ContentFormPage'
import { MaterialPage } from '../pages/admin/MaterialPage'
import { SeriesBuilderPage } from '../pages/admin/SeriesBuilderPage'
import { CategoryPage } from '../pages/admin/CategoryPage'
import { StatsPage } from '../pages/admin/StatsPage'
import { ResetPage } from '../pages/admin/ResetPage'

// 첫 이용(L01)을 아직 마치지 않았으면 피드 대신 관심 분야 안내로 보냄(공통기준 11)
function Feed({ mode }: { mode: 'feed' | 'watch' }) {
  const { settings } = useSession()
  if (mode === 'feed' && settings && !settings.interest_guide_completed)
    return <Navigate to="/learner/welcome" replace />
  return <FeedPage mode={mode} />
}

function Learner({ children }: { children: React.ReactNode }) {
  return <AppLayout role="learner">{children}</AppLayout>
}

function Admin({ children }: { children: React.ReactNode }) {
  return <AppLayout role="admin">{children}</AppLayout>
}

export function AppRouter() {
  return (
    <Routes>
      {/* 모드 선택(로컬 시연용) */}
      <Route path="/" element={<HomePage />} />

      {/* 학습자 화면 L01~L09 */}
      <Route
        path="/learner/welcome"
        element={
          <Learner>
            <WelcomePage />
          </Learner>
        }
      />
      <Route
        path="/learner/feed"
        element={
          <Learner>
            <Feed mode="feed" />
          </Learner>
        }
      />
      <Route
        path="/learner/watch/:contentId"
        element={
          <Learner>
            <Feed mode="watch" />
          </Learner>
        }
      />
      <Route
        path="/learner/search"
        element={
          <Learner>
            <SearchPage />
          </Learner>
        }
      />
      <Route
        path="/learner/series"
        element={
          <Learner>
            <SeriesPage />
          </Learner>
        }
      />
      <Route
        path="/learner/series/:id"
        element={
          <Learner>
            <SeriesPage />
          </Learner>
        }
      />
      <Route
        path="/learner/library"
        element={
          <Learner>
            <LibraryPage />
          </Learner>
        }
      />
      <Route
        path="/learner/review/:contentId"
        element={
          <Learner>
            <ReviewPage />
          </Learner>
        }
      />
      <Route
        path="/learner/cards"
        element={
          <Learner>
            <FlashcardPage />
          </Learner>
        }
      />
      <Route
        path="/learner/dashboard"
        element={
          <Learner>
            <DashboardPage />
          </Learner>
        }
      />
      <Route
        path="/learner/settings"
        element={
          <Learner>
            <SettingsPage />
          </Learner>
        }
      />

      {/* 관리자 화면 A01~A07 */}
      <Route
        path="/admin/contents"
        element={
          <Admin>
            <ContentListPage />
          </Admin>
        }
      />
      <Route
        path="/admin/contents/new"
        element={
          <Admin>
            <ContentFormPage />
          </Admin>
        }
      />
      <Route
        path="/admin/contents/:id"
        element={
          <Admin>
            <ContentFormPage />
          </Admin>
        }
      />
      <Route
        path="/admin/materials"
        element={
          <Admin>
            <MaterialPage />
          </Admin>
        }
      />
      <Route
        path="/admin/materials/:id"
        element={
          <Admin>
            <MaterialPage />
          </Admin>
        }
      />
      <Route
        path="/admin/series"
        element={
          <Admin>
            <SeriesBuilderPage />
          </Admin>
        }
      />
      <Route
        path="/admin/categories"
        element={
          <Admin>
            <CategoryPage />
          </Admin>
        }
      />
      <Route
        path="/admin/stats"
        element={
          <Admin>
            <StatsPage />
          </Admin>
        }
      />
      <Route
        path="/admin/stats/:id"
        element={
          <Admin>
            <StatsPage />
          </Admin>
        }
      />
      <Route
        path="/admin/reset"
        element={
          <Admin>
            <ResetPage />
          </Admin>
        }
      />

      {/* 알 수 없는 경로는 홈으로 */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
