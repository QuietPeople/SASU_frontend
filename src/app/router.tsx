import { RouteContent } from './RouteContent'
import {
  LearnerLayout,
  AdminLayout,
  FeedPage,
  WelcomePage,
  SearchPage,
  SeriesPage,
  LibraryPage,
  ReviewPage,
  FlashcardPage,
  DashboardPage,
  SettingsPage,
  ContentListPage,
  ContentFormPage,
  MaterialPage,
  SeriesBuilderPage,
  CategoryPage,
  StatsPage,
  ResetPage,
} from './lazyPages'
import { Navigate, Route, Routes } from 'react-router'

import { useSession } from '../state/session'

// 첫 이용(L01)을 아직 마치지 않았으면 피드 대신 관심 분야 안내로 보냄(공통기준 11)
function Feed({ mode }: { mode: 'feed' | 'watch' }) {
  const { settings } = useSession()
  if (mode === 'feed' && settings && !settings.interest_guide_completed)
    return <Navigate to="/learner/welcome" replace />
  return <FeedPage mode={mode} />
}

function Learner({ children }: { children: React.ReactNode }) {
  return (
    <LearnerLayout>
      <RouteContent>{children}</RouteContent>
    </LearnerLayout>
  )
}

function Admin({ children }: { children: React.ReactNode }) {
  return (
    <AdminLayout>
      <RouteContent>{children}</RouteContent>
    </AdminLayout>
  )
}

export function AppRouter() {
  return (
    <RouteContent>
      <Routes>
        <Route path="/" element={<Navigate to="/learner/feed" replace />} />

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

        {/* 알 수 없는 경로는 학습자 피드로 */}
        <Route path="*" element={<Navigate to="/learner/feed" replace />} />
      </Routes>
    </RouteContent>
  )
}
