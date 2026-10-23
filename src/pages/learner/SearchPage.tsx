import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { categoryName, sampleCategories } from '../../state/sasuSample';
import { publicContents, useStore } from '../../state/store';
import { Button, StateBlock } from '../../shared/ui';

/**
 * L03 검색(공통기준 01·09·10).
 * - 제목·태그·핵심 정리에서 검색어를 찾아 공개 콘텐츠만 보여 줌
 * - 일치순: 제목 → 태그 → 핵심 정리. 분야 조건과 함께 적용
 * - 결과 선택 시 L02 watch 모드로 이동하며 검색 조건·결과 목록·복귀 위치를 넘김
 * - 검색어·분야는 주소 쿼리에 담아 복귀 시 그대로 복원됨(화면 설계서 1-3)
 */

// 일치 등급: 0 제목 / 1 태그 / 2 핵심 정리 / 9 불일치
function matchRank(content: { title: string; tags: string[]; summary: string }, q: string): number {
  const lower = q.toLowerCase();
  if (content.title.toLowerCase().includes(lower)) return 0;
  if (content.tags.some((t) => t.toLowerCase().includes(lower))) return 1;
  if (content.summary.toLowerCase().includes(lower)) return 2;
  return 9;
}

const RANK_LABEL = ['제목 일치', '태그 일치', '핵심 정리 일치'];

export function SearchPage() {
  const { state } = useStore();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const [term, setTerm] = useState(params.get('q') ?? '');
  const [cat, setCat] = useState(params.get('cat') ?? '');
  const q = (params.get('q') ?? '').trim();
  const catId = params.get('cat') ? Number(params.get('cat')) : null;

  const rows = useMemo(() => {
    if (!q) return [];
    return publicContents(state)
      .filter((c) => catId === null || c.categoryId === catId)
      .map((c) => ({ content: c, rank: matchRank(c, q) }))
      .filter((x) => x.rank !== 9)
      .sort((a, b) => (a.rank === b.rank ? b.content.id - a.content.id : a.rank - b.rank));
  }, [state, q, catId]);

  const runSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const next = new URLSearchParams();
    if (term.trim()) next.set('q', term.trim());
    if (cat) next.set('cat', cat);
    setParams(next);
  };

  const reset = () => {
    setTerm('');
    setCat('');
    setParams(new URLSearchParams());
  };

  const open = (id: number) => {
    const listIds = rows.map((r) => r.content.id).join(',');
    navigate(`/learner/watch/${id}?from=search&list=${listIds}`);
  };

  return (
    <div className="sasu-page sasu-search">
      <header className="sasu-page__head">
        <p className="sasu-eyebrow">학습자 · 검색</p>
        <h1 className="sasu-title">검색</h1>
      </header>

      <form className="sasu-search__bar" onSubmit={runSearch}>
        <label className="sasu-field">
          <span className="sasu-sr">검색어</span>
          <input className="sasu-input" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="제목·태그·핵심 정리로 검색" />
        </label>
        <label className="sasu-field sasu-field--sm">
          <span className="sasu-sr">분야</span>
          <select className="sasu-input" value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">분야 전체</option>
            {sampleCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" variant="primary">
          검색
        </Button>
        <Button onClick={reset}>조건 초기화</Button>
      </form>

      {!q ? (
        <StateBlock title="검색어를 입력해 주세요." text="제목 → 태그 → 핵심 정리 순으로 일치하는 공개 콘텐츠를 보여 줘요." />
      ) : rows.length === 0 ? (
        <StateBlock title="검색 결과가 없어요." text="검색어를 줄이거나 분야를 바꿔 보세요." action={<Button onClick={reset}>조건 초기화</Button>} />
      ) : (
        <>
          <p className="sasu-search__summary">
            검색 결과 {rows.length}개 · 제목 → 태그 → 핵심 정리 일치순{catId !== null ? ` · ${categoryName(catId)}` : ''}
          </p>
          <ul className="sasu-result-list">
            {rows.map(({ content, rank }) => (
              <li key={content.id}>
                <button type="button" className="sasu-result-card" onClick={() => open(content.id)}>
                  <span className="sasu-result-card__thumb" aria-hidden="true">
                    {content.tags[0] ?? content.title.slice(0, 2)}
                  </span>
                  <span className="sasu-result-card__body">
                    <span className="sasu-result-card__title">{content.title}</span>
                    <span className="sasu-result-card__meta">
                      {categoryName(content.categoryId)} · {RANK_LABEL[rank]}
                    </span>
                    <span className="sasu-result-card__summary">{content.summary.split(/(?<=[.!?])\s+/)[0] ?? ''}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
