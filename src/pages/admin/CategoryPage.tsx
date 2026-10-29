import { CategoryManager } from '../../admin/CategoryManager'
import '../../admin/content-editor.css'

export function CategoryPage() {
  return (
    <div className="admin-page admin-categories">
      <header className="admin-page__head">
        <p className="admin-eyebrow">관리자 · 분야</p>
        <h1 className="admin-title">분야 관리</h1>
        <p className="admin-sub">콘텐츠의 분류 현황을 확인하고 분야를 관리해요.</p>
      </header>
      <CategoryManager standalone />
    </div>
  )
}
