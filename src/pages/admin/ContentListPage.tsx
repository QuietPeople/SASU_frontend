import { useState } from 'react'
import { useNavigate } from 'react-router'
import { type ApiPage, queryString } from '../../api/client'
import { type AdminContent, useAdminQuery } from '../../api/admin'
import { Badge, Button, Spinner, StateBlock } from '../../shared/ui'

export function ContentListPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('ALL')
  const [page, setPage] = useState(1)
  const list = useAdminQuery<ApiPage<AdminContent>>(
    `/contents${queryString({ q: query.trim() || undefined, status, page, size: 20 })}`,
  )
  const all = useAdminQuery<ApiPage<AdminContent>>('/contents?status=ALL&size=1')
  const published = useAdminQuery<ApiPage<AdminContent>>('/contents?status=PUBLISHED&size=1')
  const drafts = useAdminQuery<ApiPage<AdminContent>>('/contents?status=DRAFT&size=1')
  const reset = () => {
    setQuery('')
    setStatus('ALL')
    setPage(1)
  }
  return (
    <div className="sasu-page sasu-cl">
      <header className="sasu-page__head sasu-page__head--row">
        <div>
          <p className="sasu-eyebrow">관리자 · 콘텐츠</p>
          <h1 className="sasu-title">콘텐츠 목록</h1>
          <p className="sasu-sub">임시저장한 콘텐츠는 학습자에게 보이지 않아요.</p>
        </div>
        <Button variant="primary" onClick={() => navigate('/admin/contents/new')}>
          + 새 콘텐츠
        </Button>
      </header>
      <ul className="sasu-cl__counts" aria-label="상태별 콘텐츠 수">
        <li>
          <span>전체</span>
          <strong>{all.data?.total ?? '—'}</strong>
        </li>
        <li>
          <span>공개</span>
          <strong>{published.data?.total ?? '—'}</strong>
        </li>
        <li>
          <span>임시저장</span>
          <strong>{drafts.data?.total ?? '—'}</strong>
        </li>
      </ul>
      <div className="sasu-cl__toolbar">
        <label className="sasu-field">
          <span className="sasu-sr">콘텐츠 검색</span>
          <input
            className="sasu-input"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setPage(1)
            }}
            placeholder="제목·태그·핵심 내용으로 검색"
          />
        </label>
        <label className="sasu-field sasu-field--sm">
          <span className="sasu-sr">공개 상태</span>
          <select
            className="sasu-input"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value)
              setPage(1)
            }}
          >
            <option value="ALL">상태 전체</option>
            <option value="PUBLISHED">공개</option>
            <option value="DRAFT">임시저장</option>
          </select>
        </label>
      </div>
      {list.isPending ? (
        <Spinner label="목록을 불러오는 중" />
      ) : list.isError ? (
        <StateBlock
          title="목록을 불러오지 못했어요."
          text={list.error.message}
          action={<Button onClick={() => void list.refetch()}>다시 시도</Button>}
        />
      ) : !list.data.items.length ? (
        <StateBlock
          title="조건에 맞는 콘텐츠가 없어요."
          action={<Button onClick={reset}>조건 초기화</Button>}
        />
      ) : (
        <>
          <div className="sasu-table-wrap">
            <table className="sasu-table">
              <thead>
                <tr>
                  <th>제목</th>
                  <th>분야</th>
                  <th>상태</th>
                  <th>영상</th>
                  <th>퀴즈</th>
                  <th aria-label="동작" />
                </tr>
              </thead>
              <tbody>
                {list.data.items.map((c) => (
                  <tr key={c.content_id}>
                    <td>
                      <span className="sasu-table__title">{c.title || '제목 없음'}</span>
                      <span className="sasu-table__tags">
                        {c.tags.map((t) => `#${t.name}`).join(' ')}
                      </span>
                    </td>
                    <td>{c.category?.name ?? '—'}</td>
                    <td>
                      <Badge tone={c.status === 'PUBLISHED' ? 'green' : 'neutral'}>
                        {c.status === 'PUBLISHED' ? '공개' : '임시저장'}
                      </Badge>
                    </td>
                    <td>
                      {c.video_duration === null ? '미등록' : `${Math.round(c.video_duration)}초`}
                    </td>
                    <td>{c.has_quiz ? '있음' : '없음'}</td>
                    <td className="sasu-table__right">
                      <div className="sasu-table__actions">
                        <Button
                          size="sm"
                          onClick={() => navigate(`/admin/contents/${c.content_id}`)}
                        >
                          편집
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => navigate(`/admin/materials/${c.content_id}`)}
                        >
                          자료
                        </Button>
                        <Button size="sm" onClick={() => navigate(`/admin/stats/${c.content_id}`)}>
                          통계
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="sasu-row">
            <Button disabled={page === 1} onClick={() => setPage(page - 1)}>
              이전
            </Button>
            <span>
              {page}페이지 · 총 {list.data.total}개
            </span>
            <Button disabled={!list.data.has_next} onClick={() => setPage(page + 1)}>
              다음
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
