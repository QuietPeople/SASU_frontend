import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import type { Category } from '../../types/sasu';
import { sampleCategories, request } from '../../state/sasuSample';
import { Button, useToast } from '../../shared/ui';

/**
 * A05 분야 관리(공통기준 08).
 * - 분야 추가·이름 수정만 제공. 삭제는 범위에 넣지 않음
 * - 이름 수정은 id를 유지하고 이름만 바꿈(연결된 콘텐츠·관심 표시명도 함께 바뀜)
 * - 빈 이름 저장 방지. 콘텐츠 작성에서 왔으면 ?back으로 복귀
 *
 * 데모 범위: 로컬 목록으로 추가·수정 흐름만 보여 주며 공유 데이터에는 되쓰지 않음.
 */
export function CategoryPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { show, node } = useToast();
  const back = params.get('back') || '';

  const [list, setList] = useState<Category[]>(sampleCategories);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState('');
  const [busy, setBusy] = useState(false);

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setDraft(cat.name);
  };

  const saveEdit = async () => {
    if (busy || editingId === null) return;
    if (!draft.trim()) {
      show('분야명을 입력해 주세요.', 'error');
      return;
    }
    setBusy(true);
    try {
      await request('categorySave', null, 400);
      setList((l) => l.map((c) => (c.id === editingId ? { ...c, name: draft.trim() } : c)));
      setEditingId(null);
      show('분야 이름을 바꿨어요.');
    } catch {
      show('저장하지 못했어요.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    if (busy) return;
    if (!adding.trim()) {
      show('분야명을 입력해 주세요.', 'error');
      return;
    }
    setBusy(true);
    try {
      await request('categorySave', null, 400);
      setList((l) => [...l, { id: Math.max(0, ...l.map((c) => c.id)) + 1, name: adding.trim() }]);
      setAdding('');
      show('분야를 추가했어요.');
    } catch {
      show('저장하지 못했어요.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sasu-page sasu-form">
      <header className="sasu-page__head">
        <p className="sasu-eyebrow">관리자 · 분야</p>
        <h1 className="sasu-title">분야 관리</h1>
        <p className="sasu-sub">추가와 이름 수정만 할 수 있어요. 삭제는 제공하지 않아요.</p>
      </header>

      <section className="sasu-card">
        <table className="sasu-table">
          <thead>
            <tr>
              <th>분야</th>
              <th aria-label="동작" />
            </tr>
          </thead>
          <tbody>
            {list.map((cat) => (
              <tr key={cat.id}>
                <td>
                  {editingId === cat.id ? (
                    <input className="sasu-input" value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="분야명" />
                  ) : (
                    cat.name
                  )}
                </td>
                <td className="sasu-table__right">
                  {editingId === cat.id ? (
                    <div className="sasu-table__actions">
                      <Button size="sm" variant="primary" onClick={() => void saveEdit()} loading={busy}>
                        저장
                      </Button>
                      <Button size="sm" onClick={() => setEditingId(null)}>
                        취소
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" onClick={() => startEdit(cat)}>
                      이름 수정
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="sasu-card">
        <h2 className="sasu-card__title">분야 추가</h2>
        <div className="sasu-row sasu-row--tight">
          <input className="sasu-input" value={adding} onChange={(e) => setAdding(e.target.value)} placeholder="새 분야명" aria-label="새 분야명" />
          <Button variant="primary" onClick={() => void add()} loading={busy}>
            추가
          </Button>
        </div>
      </section>

      {back ? (
        <Button onClick={() => navigate(back)}>콘텐츠 작성으로 돌아가기</Button>
      ) : null}
      {node}
    </div>
  );
}
