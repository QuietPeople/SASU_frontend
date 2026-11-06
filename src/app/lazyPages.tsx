import { lazy } from 'react'

export const LearnerLayout = lazy(() =>
  import('../learner/LearnerLayout').then((module) => ({ default: module.LearnerLayout })),
)
export const AdminLayout = lazy(() =>
  import('../admin/AdminLayout').then((module) => ({ default: module.AdminLayout })),
)
export const FeedPage = lazy(() =>
  import('../pages/learner/FeedPage').then((module) => ({ default: module.FeedPage })),
)
export const WelcomePage = lazy(() =>
  import('../pages/learner/WelcomePage').then((module) => ({ default: module.WelcomePage })),
)
export const SearchPage = lazy(() =>
  import('../pages/learner/SearchPage').then((module) => ({ default: module.SearchPage })),
)
export const SeriesPage = lazy(() =>
  import('../pages/learner/SeriesPage').then((module) => ({ default: module.SeriesPage })),
)
export const LibraryPage = lazy(() =>
  import('../pages/learner/LibraryPage').then((module) => ({ default: module.LibraryPage })),
)
export const ReviewPage = lazy(() =>
  import('../pages/learner/ReviewPage').then((module) => ({ default: module.ReviewPage })),
)
export const DashboardPage = lazy(() =>
  import('../pages/learner/DashboardPage').then((module) => ({ default: module.DashboardPage })),
)
export const SettingsPage = lazy(() =>
  import('../pages/learner/SettingsPage').then((module) => ({ default: module.SettingsPage })),
)
export const ContentListPage = lazy(() =>
  import('../pages/admin/ContentListPage').then((module) => ({ default: module.ContentListPage })),
)
export const ContentFormPage = lazy(() =>
  import('../pages/admin/ContentFormPage').then((module) => ({ default: module.ContentFormPage })),
)
export const MaterialPage = lazy(() =>
  import('../pages/admin/MaterialPage').then((module) => ({ default: module.MaterialPage })),
)
export const SeriesBuilderPage = lazy(() =>
  import('../pages/admin/SeriesBuilderPage').then((module) => ({
    default: module.SeriesBuilderPage,
  })),
)
export const CategoryPage = lazy(() =>
  import('../pages/admin/CategoryPage').then((module) => ({ default: module.CategoryPage })),
)
export const StatsPage = lazy(() =>
  import('../pages/admin/StatsPage').then((module) => ({ default: module.StatsPage })),
)
export const ResetPage = lazy(() =>
  import('../pages/admin/ResetPage').then((module) => ({ default: module.ResetPage })),
)
