import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { categoryName, quizOf, request } from '../../state/sasuSample';
import { useStore } from '../../state/store';
import { Badge, Button, StateBlock, useToast } from '../../shared/ui';

/**
 * L05 보관함(공통기준 01·25·26·27).
 * - 저장 영상 / 오답 복습 / 플래시카드 탭. 한 번에 한 탭만 보여 줌
 * - 대시보드에서 오면 개념(분야) 필터가 적용됨(?concept=분야id)
 * - 저장 해제는 미결 동작이라 제안으로 표시(P16). 성공 응답 뒤에만 목록에서 제거
 */

type Tab = 'saved' | 'wrong' | 'cards';
const TABS: { id: Tab; label: string }[] = [
  { id: 'saved', label: '저장 영상' },
  { id: 'wrong', label: '오답 복습' },
  { id: 'cards', label: '플래시카드' },
];

export function LibraryPage() {
  const { state, dispatch } = useStore();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { show, node } = useToast();
  const [unsaving, setUnsaving] = useState<number | null>(null);

  const tab = (TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'saved') as Tab;
  const concept = params.get('concept') ? Number(params.get('concept')) : null;
  const records = state.records;
  const byId = (id: number) => state.contents.find((c) => c.id === id);
  const inConcept = (categoryId: number) => concept === null || categoryId === concept;

  const savedRows = records.saved.map(byId).filter((c): c is NonNullable<typeof c> => Boolean(c)).filter((c) => inConcept(c.categoryId));
  const wrongRows = Object.entries(records.wrongNotes)
    .filter(([, status]) => status === 'PENDING')
    .map(([cid]) => byId(Number(cid)))
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
    .filter((c) => inConcept(c.categoryId));
  // 카드 원천은 등록 퀴즈(공통기준 27). 시청한 콘텐츠 중 퀴즈가 있는 것을 카드로 봄(P05)
  const cardRows = Object.keys(records.stats)
    .map((cid) => byId(Number(cid)))
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
    .filter((c) => Boolean(quizOf(c.id)) && inConcept(c.categoryId));

  const setTab = (next: Tab) => {
    const q = new URLSearchParams(params);
    q.set('tab', next);
    if (next !== 'wrong') q.delete('concept');
    setParams(q);
  };

  const unsave = async (id: number) => {
    if (unsaving !== null) return;
    setUnsaving(id);
    try {
      await request('bookmark', null, 350);
      dispatch({ type: 'save', contentId: id, on: false });
      show('저장을 해제했어요.');
    } catch {
      show('저장 해제를 반영하지 못했어요. 다시 시도해 주세요.', 'error');
    } finally {
      setUnsaving(null);
    }
  };

  return (
    <div className="sasu-page sasu-library">
      <header className="sasu-page__head">
        <p className="sasu-eyebrow">학습자 · 보관함</p>
        <h1 className="sasu-title">보관함</h1>
      </header>

      <div className="sasu-tabs" role="tablist" aria-label="보관함 탭">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={`sasu-tabs__tab ${tab === t.id ? 'is-active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {concept !== null && tab === 'wrong' ? (
        <p className="sasu-library__filter">
          적용 개념: {categoryName(concept)}{' '}
          <button type="button" className="sasu-link" onClick={() => setTab('wrong')}>
            전체 보기
          </button>
        </p>
      ) : null}

      {tab === 'saved' ? (
        savedRows.length === 0 ? (
          <StateBlock title="저장한 영상이 없어요." text="피드에서 영상을 저장해 보세요." action={<Button variant="primary" onClick={() => navigate('/learner/feed')}>피드 보기</Button>} />
        ) : (
          <ul className="sasu-result-list">
            {savedRows.map((c) => (
              <li key={c.id}>
                <div className="sasu-result-card sasu-result-card--static">
                  <span className="sasu-result-card__thumb" aria-hidden="true">
                    {c.tags[0] ?? c.title.slice(0, 2)}
                  </span>
                  <span className="sasu-result-card__body">
                    <span className="sasu-result-card__title">{c.title}</span>
                    <span className="sasu-result-card__meta">{categoryName(c.categoryId)}</span>
                  </span>
                  <span className="sasu-result-card__actions">
                    <Button size="sm" variant="primary" onClick={() => navigate(`/learner/watch/${c.id}?from=saved&list=${savedRows.map((x) => x.id).join(',')}`)}>
                      영상 보기
                    </Button>
                    <Button size="sm" onClick={() => void unsave(c.id)} loading={unsaving === c.id} title="저장 해제는 미결 동작이라 제안이에요(P16)">
                      저장 해제
                    </Button>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )
      ) : null}

      {tab === 'wrong' ? (
        wrongRows.length === 0 ? (
          <StateBlock title="현재 미해결 오답이 없어요." text="피드나 복습에서 틀린 문제가 여기에 모여요." />
        ) : (
          <ul className="sasu-result-list">
            {wrongRows.map((c) => (
              <li key={c.id}>
                <div className="sasu-result-card sasu-result-card--static">
                  <span className="sasu-result-card__body">
                    <span className="sasu-result-card__title">{c.title}</span>
                    <span className="sasu-result-card__meta">
                      {categoryName(c.categoryId)} · <Badge tone="amber">미해결</Badge>
                    </span>
                    <span className="sasu-result-card__summary">{quizOf(c.id)?.question ?? ''}</span>
                  </span>
                  <span className="sasu-result-card__actions">
                    <Button size="sm" variant="primary" onClick={() => navigate(`/learner/review/${c.id}`)}>
                      복습 시작
                    </Button>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )
      ) : null}

      {tab === 'cards' ? (
        cardRows.length === 0 ? (
          <StateBlock title="이용할 수 있는 카드가 없어요." text="영상을 보고 퀴즈가 있는 콘텐츠가 카드가 돼요." />
        ) : (
          <ul className="sasu-result-list">
            {cardRows.map((c, i) => (
              <li key={c.id}>
                <div className="sasu-result-card sasu-result-card--static">
                  <span className="sasu-result-card__body">
                    <span className="sasu-result-card__title">{c.title}</span>
                    <span className="sasu-result-card__summary">{quizOf(c.id)?.question ?? ''}</span>
                  </span>
                  <span className="sasu-result-card__actions">
                    <Button size="sm" variant="primary" onClick={() => navigate(`/learner/cards?list=${cardRows.map((x) => x.id).join(',')}&i=${i}`)}>
                      카드 보기
                    </Button>
                    <Button size="sm" onClick={() => navigate(`/learner/watch/${c.id}?from=card&back=${i}`)}>
                      원본 영상
                    </Button>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )
      ) : null}
      {node}
    </div>
  );
}
