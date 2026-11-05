import { useState, type FormEvent } from 'react'
import { queryString, type ApiPage } from '../api/client'
import {
  useAdminQuery,
  type AdminContent,
  type AdminCategory,
  type EditableContent,
} from '../api/admin'
import { useAdminView } from './useAdminView'
import { adminFilters, adminPage, adminStatus, adminId } from './navigation'
import { RequestError } from './RequestFeedback'
import { Badge, Button, Spinner } from './ui'

export function ContentTargetPicker({
  target,
  disabled,
  onSelect,
}: {
  target?: string
  disabled: boolean
  onSelect: (path: string) => void
}) {
  const [params, setParams] = useAdminView('materials')
  const term = params.get('q') ?? '',
    page = adminPage(params.get('page')),
    status = adminStatus(params.get('status'))
  const category = adminId(params.get('category_id'))
  const [draft, setDraft] = useState<string | null>(null)
  const list = useAdminQuery<ApiPage<AdminContent>>(
    `/contents${queryString({ q: term || undefined, category_id: category, status, page, size: 10 })}`,
  )
  const categories = useAdminQuery<{ items: AdminCategory[] }>('/categories')
  const selected = useAdminQuery<EditableContent>(target ? `/contents/${target}?view=editor` : null)
  const change = (values: Record<string, string>) => setParams(adminFilters(params, values))
  const search = (event: FormEvent) => {
    event.preventDefault()
    change({ q: (draft ?? term).trim() })
    setDraft(null)
  }
  return (
    <section className="admin-card admin-target-picker" aria-label="학습자료 작업 대상">
      <h2 className="admin-card__title">학습자료 작업 대상</h2>
      <p className="admin-help">콘텐츠의 퀴즈 등록 상태를 확인하고 작성할 대상을 선택해 주세요.</p>
      <form className="admin-target-picker__filters" onSubmit={search}>
        <label className="admin-field">
          <span>콘텐츠 검색</span>
          <input
            className="admin-input"
            type="search"
            value={draft ?? term}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="제목·태그·핵심 내용 검색"
            disabled={disabled}
          />
        </label>
        <label className="admin-field">
          <span>분야</span>
          <select
            className="admin-input"
            value={category ?? ''}
            onChange={(event) => change({ category_id: event.target.value })}
            disabled={disabled || categories.isPending}
          >
            <option value="">전체 분야</option>
            {categories.data?.items.map((item) => (
              <option key={item.category_id} value={item.category_id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="admin-field">
          <span>공개 상태</span>
          <select
            className="admin-input"
            value={status}
            onChange={(event) => change({ status: event.target.value })}
            disabled={disabled}
          >
            <option value="ALL">전체</option>
            <option value="PUBLISHED">공개</option>
            <option value="DRAFT">임시저장</option>
          </select>
        </label>
        <Button type="submit" disabled={disabled}>
          검색
        </Button>
      </form>
      {categories.isError && (
        <RequestError
          title="분야를 불러오지 못했어요."
          error={categories.error}
          action={<Button onClick={() => void categories.refetch()}>다시 시도</Button>}
        />
      )}
      {selected.data && (
        <p className="admin-target-picker__selected">
          현재 편집: <strong>{selected.data.detail.content.title || '제목 없음'}</strong>
        </p>
      )}
      {list.isPending ? (
        <Spinner />
      ) : list.isError ? (
        <RequestError
          title="작업 대상을 불러오지 못했어요."
          error={list.error}
          action={<Button onClick={() => void list.refetch()}>다시 시도</Button>}
        />
      ) : (
        <>
          <p className="admin-help">
            검색 결과 {list.data.total}개 · {page} 페이지
          </p>
          <ul className="admin-target-picker__list">
            {list.data.items.map((item) => (
              <li key={item.content_id}>
                <div>
                  <strong>{item.title || '제목 없음'}</strong>
                  <p>
                    {item.category?.name ?? '분야 없음'} ·{' '}
                    {item.status === 'PUBLISHED' ? '공개' : '임시저장'} ·{' '}
                    <Badge tone={item.has_quiz ? 'green' : 'neutral'}>
                      퀴즈 {item.has_quiz ? '등록' : '미등록'}
                    </Badge>
                  </p>
                </div>
                <Button
                  disabled={disabled}
                  variant={String(item.content_id) === target ? 'primary' : 'ghost'}
                  onClick={() =>
                    onSelect(
                      `/admin/materials/${item.content_id}${params.size ? '?' + params : ''}`,
                    )
                  }
                >
                  {item.has_quiz ? '퀴즈 편집' : '퀴즈 작성'}
                </Button>
              </li>
            ))}
          </ul>
          {!list.data.items.length && <p className="admin-help">조건에 맞는 콘텐츠가 없어요.</p>}
          {(page > 1 || list.data.has_next) && (
            <div className="admin-row">
              <Button
                disabled={disabled || page === 1 || list.isFetching}
                onClick={() => change({ page: String(page - 1) })}
              >
                이전 대상 페이지
              </Button>
              <span>{page} 페이지</span>
              <Button
                disabled={disabled || !list.data.has_next || list.isFetching}
                onClick={() => change({ page: String(page + 1) })}
              >
                다음 대상 페이지
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  )
}
