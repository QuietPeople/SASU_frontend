import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import type { Content, ContentStatus } from '../../types/sasu';
import { categoryName, quizOf, request } from '../../state/sasuSample';
import { useStore } from '../../state/store';
import { Badge, Button, Spinner, StateBlock } from '../../shared/ui';

/**
 * A01 관리자 콘텐츠 목록(공통기준 04·05·06).
 * - 검색(제목·태그)과 공개 상태로 거름
 * - 행: 제목·분야·태그·상태(임시저장/공개)·검토일·퀴즈 연결 유무
 * - 동작: 새 콘텐츠(A02 신규), 편집(A02), 학습자료(A03), 통계(A06)
 * - 임시저장 콘텐츠는 학습자 피드에 보이지 않음
 */
type LoadState = 'loading' | 'ready' | 'failed';
type StatusFilter = 'ALL' | ContentStatus;

const STATUS_LABEL: Record<ContentStatus, string> = { DRAFT: '임시저장', PUBLISHED: '공개' };

export function ContentListPage() {
  const { state } = useStore();
  const navigate = useNavigate();
  const [load, setLoad] = useState<LoadState>('loading');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('ALL');

  // 초기값이 이미 'loading'이라 효과에서는 성공·실패만 반영함
  useEffect(() => {
    let alive = true;
    request('list', null, 350)
      .then(() => alive && setLoad('ready'))
      .catch(() => alive && setLoad('failed'));
    return () => {
      alive = false;
    };
  }, []);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return state.contents
      .filter((c) => status === 'ALL' || c.status === status)
      .filter((c) => !q || c.title.toLowerCase().includes(q) || c.tags.some((t) => t.toLowerCase().includes(q)))
      .sort((a, b) => b.id - a.id);
  }, [state.contents, query, status]);

  const counts = useMemo(
    () => ({
      all: state.contents.length,
      published: state.contents.filter((c) => c.status === 'PUBLISHED').length,
      draft: state.contents.filter((c) => c.status === 'DRAFT').length,
    }),
    [state.contents],
  );

  const reset = () => {
    setQuery('');
    setStatus('ALL');
  };

  return (
    <div className="sasu-page sasu-cl">
      <header className="sasu-page__head sasu-page__head--row">
        <div>
          <p className="sasu-eyebrow">관리자 · 콘텐츠</p>
          <h1 className="sasu-title">콘텐츠 목록</h1>
          <p className="sasu-sub">임시저장한 콘텐츠는 학습자 피드에 보이지 않아요.</p>
        </div>
        <Button variant="primary" onClick={() => navigate('/admin/contents/new')}>
          + 새 콘텐츠
        </Button>
      </header>

      {load === 'loading' ? (
        <div className="sasu-card">
          <Spinner label="목록을 불러오는 중" />
        </div>
      ) : load === 'failed' ? (
        <StateBlock title="목록을 불러오지 못했어요." text="잠시 후 다시 시도해 주세요." action={<Button variant="primary" onClick={() => window.location.reload()}>다시 시도</Button>} />
      ) : state.contents.length === 0 ? (
        <StateBlock title="아직 등록한 콘텐츠가 없어요." action={<Button variant="primary" onClick={() => navigate('/admin/contents/new')}>첫 콘텐츠 등록</Button>} />
      ) : (
        <>
          <ul className="sasu-cl__counts" aria-label="상태별 콘텐츠 수">
            <li>
              <span>전체</span>
              <strong>{counts.all}</strong>
            </li>
            <li>
              <span>공개</span>
              <strong>{counts.published}</strong>
            </li>
            <li>
              <span>임시저장</span>
              <strong>{counts.draft}</strong>
            </li>
          </ul>

          <div className="sasu-cl__toolbar">
            <label className="sasu-field">
              <span className="sasu-sr">콘텐츠 검색</span>
              <input className="sasu-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="제목·태그로 검색" />
            </label>
            <label className="sasu-field sasu-field--sm">
              <span className="sasu-sr">공개 상태</span>
              <select className="sasu-input" value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
                <option value="ALL">상태 전체</option>
                <option value="PUBLISHED">공개</option>
                <option value="DRAFT">임시저장</option>
              </select>
            </label>
          </div>

          {rows.length === 0 ? (
            <StateBlock title="조건에 맞는 콘텐츠가 없어요." action={<Button onClick={reset}>조건 초기화</Button>} />
          ) : (
            <div className="sasu-table-wrap">
              <table className="sasu-table">
                <thead>
                  <tr>
                    <th>제목</th>
                    <th>분야</th>
                    <th>상태</th>
                    <th>검토일</th>
                    <th>퀴즈</th>
                    <th aria-label="동작" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c: Content) => (
                    <tr key={c.id}>
                      <td>
                        <span className="sasu-table__title">{c.title}</span>
                        {c.tags.length ? <span className="sasu-table__tags">{c.tags.map((t) => `#${t}`).join(' ')}</span> : null}
                      </td>
                      <td>{categoryName(c.categoryId)}</td>
                      <td>
                        <Badge tone={c.status === 'PUBLISHED' ? 'green' : 'neutral'}>{STATUS_LABEL[c.status]}</Badge>
                      </td>
                      <td>{c.reviewedAt || '—'}</td>
                      <td>{quizOf(c.id) ? '있음' : '없음'}</td>
                      <td className="sasu-table__right">
                        <div className="sasu-table__actions">
                          <Button size="sm" onClick={() => navigate(`/admin/contents/${c.id}`)}>
                            편집
                          </Button>
                          <Button size="sm" onClick={() => navigate(`/admin/materials/${c.id}`)}>
                            자료
                          </Button>
                          <Button size="sm" onClick={() => navigate(`/admin/stats/${c.id}`)}>
                            통계
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
