import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import type { Content, ContentStatus } from '../../types/sasu';
import { categoryName, quizOf, request, sampleCategories, sampleContents } from '../../state/sasuSample';
import '../../styles/sasu-pages.css';

/**
 * 관리자 콘텐츠 목록(화면 설계서 A01)
 * - 검색(제목·태그)과 공개 상태로 거름
 * - 행: 제목·카테고리·태그·상태·검토일·퀴즈 연결 유무
 * - 동작: 새 콘텐츠(A02 신규), 편집(A02), 학습자료(A03), 통계(A06)
 * - 목록 로딩·실패·재시도, 목록 없음, 조건에 맞는 결과 없음을 구분해서 보여 줌
 * - 임시저장 콘텐츠는 학습자 피드에 보이지 않음
 *
 * 이동할 화면(A02·A03·A06)이 아직 없으므로, 연결 함수를 넘기지 않으면 어떤 화면으로 갈지 안내만 띄움.
 */

type LoadState = 'loading' | 'ready' | 'failed';
type StatusFilter = 'ALL' | ContentStatus;

interface ContentListPageProps {
  onNew?: () => void;
  onEdit?: (contentId: number) => void;
  onMaterial?: (contentId: number) => void;
  onStats?: (contentId: number) => void;
}

const STATUS_LABEL: Record<ContentStatus, string> = { DRAFT: '임시저장', PUBLISHED: '공개' };

export function ContentListPage({ onNew, onEdit, onMaterial, onStats }: ContentListPageProps = {}) {
  const [contents, setContents] = useState<Content[]>([]);
  const [load, setLoad] = useState<LoadState>('loading');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [notice, setNotice] = useState('');
  const noticeTimer = useRef<number | undefined>(undefined);

  const fetchList = useCallback(async () => {
    setLoad('loading');
    try {
      const list = await request('list', sampleContents, 400);
      setContents(list);
      setLoad('ready');
    } catch {
      setLoad('failed');
    }
  }, []);

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  useEffect(() => () => window.clearTimeout(noticeTimer.current), []);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return contents
      .filter((c) => status === 'ALL' || c.status === status)
      .filter((c) => !q || c.title.toLowerCase().includes(q) || c.tags.some((t) => t.toLowerCase().includes(q)))
      .sort((a, b) => b.id - a.id);
  }, [contents, query, status]);

  const counts = useMemo(
    () => ({
      all: contents.length,
      published: contents.filter((c) => c.status === 'PUBLISHED').length,
      draft: contents.filter((c) => c.status === 'DRAFT').length,
    }),
    [contents],
  );

  // 연결할 화면이 아직 없을 때 안내
  const announce = (message: string) => {
    window.clearTimeout(noticeTimer.current);
    setNotice(message);
    noticeTimer.current = window.setTimeout(() => setNotice(''), 2600);
  };
  const titleOf = (id: number) => contents.find((c) => c.id === id)?.title ?? '';

  const handleNew = () => (onNew ? onNew() : announce('콘텐츠 등록 화면(A02)으로 이동합니다. 아직 연결 전이에요.'));
  const handleEdit = (id: number) => (onEdit ? onEdit(id) : announce(`${titleOf(id)} · 수정 화면(A02)으로 이동합니다. 아직 연결 전이에요.`));
  const handleMaterial = (id: number) => (onMaterial ? onMaterial(id) : announce(`${titleOf(id)} · 학습자료 화면(A03)으로 이동합니다. 아직 연결 전이에요.`));
  const handleStats = (id: number) => (onStats ? onStats(id) : announce(`${titleOf(id)} · 통계 화면(A06)으로 이동합니다. 아직 연결 전이에요.`));

  const resetFilter = () => {
    setQuery('');
    setStatus('ALL');
  };

  return (
    <div className="sasu-page sasu-cl">
      <header className="sasu-cl__head">
        <div>
          <p className="sasu-eyebrow">관리자 · 콘텐츠</p>
          <h1 className="sasu-title">콘텐츠 목록</h1>
          <p className="sasu-sub">임시저장한 콘텐츠는 학습자 피드에 보이지 않아요.</p>
        </div>
        <button type="button" className="sasu-btn sasu-btn--primary" onClick={handleNew}>
          + 새 콘텐츠
        </button>
      </header>

      {load === 'ready' && contents.length > 0 ? (
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
      ) : null}

      <section className="sasu-card">
        <div className="sasu-cl__toolbar">
          <label className="sasu-sr" htmlFor="cl-search">
            콘텐츠 찾기
          </label>
          <input
            id="cl-search"
            className="sasu-input sasu-cl__search"
            placeholder="제목이나 태그로 찾기"
            value={query}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
            disabled={load !== 'ready'}
          />
          <label className="sasu-sr" htmlFor="cl-status">
            공개 상태
          </label>
          <select
            id="cl-status"
            className="sasu-input sasu-cl__select"
            value={status}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => setStatus(e.target.value as StatusFilter)}
            disabled={load !== 'ready'}
          >
            <option value="ALL">상태 전체</option>
            <option value="PUBLISHED">공개</option>
            <option value="DRAFT">임시저장</option>
          </select>
        </div>

        {load === 'loading' ? (
          <div className="sasu-empty" role="status">
            <span className="sasu-spinner" aria-hidden="true" />
            <p className="sasu-empty__title">콘텐츠 목록을 불러오는 중이에요.</p>
          </div>
        ) : load === 'failed' ? (
          <div className="sasu-empty">
            <p className="sasu-empty__title" role="alert">
              목록을 불러오지 못했어요.
            </p>
            <p className="sasu-empty__text">등록된 콘텐츠가 없는 것과는 다른 상태예요. 잠시 후 다시 시도해 주세요.</p>
            <button type="button" className="sasu-btn" onClick={() => void fetchList()}>
              다시 불러오기
            </button>
          </div>
        ) : contents.length === 0 ? (
          <div className="sasu-empty">
            <p className="sasu-empty__title">등록된 콘텐츠가 없어요.</p>
            <button type="button" className="sasu-btn sasu-btn--primary" onClick={handleNew}>
              첫 콘텐츠 등록
            </button>
          </div>
        ) : rows.length === 0 ? (
          <div className="sasu-empty">
            <p className="sasu-empty__title">조건에 맞는 콘텐츠가 없어요.</p>
            <button type="button" className="sasu-btn" onClick={resetFilter}>
              조건 초기화
            </button>
          </div>
        ) : (
          <div className="sasu-table-wrap">
            <table className="sasu-table">
              <thead>
                <tr>
                  <th scope="col">제목</th>
                  <th scope="col">카테고리</th>
                  <th scope="col">상태</th>
                  <th scope="col">검토일</th>
                  <th scope="col">퀴즈</th>
                  <th scope="col" className="sasu-table__right">
                    동작
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => {
                  const published = c.status === 'PUBLISHED';
                  return (
                    <tr key={c.id}>
                      <td>
                        <p className="sasu-table__title">{c.title}</p>
                        <p className="sasu-table__tags">{c.tags.length ? c.tags.map((t) => `#${t}`).join(' ') : '태그 없음'}</p>
                      </td>
                      <td>{categoryName(sampleCategories, c.categoryId)}</td>
                      <td>
                        <span className={`sasu-badge ${published ? 'sasu-badge--on' : ''}`}>
                          {published ? '● ' : '○ '}
                          {STATUS_LABEL[c.status]}
                        </span>
                      </td>
                      <td className="sasu-muted">{c.reviewedAt || '—'}</td>
                      <td>{quizOf(c.id) ? '✓ 있음' : <span className="sasu-muted">없음</span>}</td>
                      <td>
                        <div className="sasu-table__actions">
                          <button type="button" className="sasu-btn sasu-btn--sm" onClick={() => handleEdit(c.id)}>
                            편집
                          </button>
                          <button type="button" className="sasu-btn sasu-btn--sm" onClick={() => handleMaterial(c.id)}>
                            학습자료
                          </button>
                          <button
                            type="button"
                            className="sasu-btn sasu-btn--sm"
                            onClick={() => handleStats(c.id)}
                            disabled={!published}
                            title={published ? undefined : '공개한 콘텐츠만 통계가 쌓여요'}
                          >
                            통계
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {notice ? (
        <div className="sasu-toast" role="status" aria-live="polite">
          {notice}
        </div>
      ) : null}
    </div>
  );
}
