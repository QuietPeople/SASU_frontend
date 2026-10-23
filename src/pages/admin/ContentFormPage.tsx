import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import type { ContentStatus } from '../../types/sasu';
import { sampleCategories, request } from '../../state/sasuSample';
import { useStore } from '../../state/store';
import { Badge, Button, useToast } from '../../shared/ui';

/**
 * A02 콘텐츠 등록·수정·공개(공통기준 04·05·06·07·08·35).
 * - 공개 필수 7종: 영상·제목·분야·태그·핵심 정리·출처·검토일
 * - 먼저 임시저장(content_id 확보), 그다음 관리자가 직접 공개를 선택
 * - 임시저장은 최소 조건(제목)만, 공개는 7종 모두 검증(P08)
 * - 퀴즈 미등록만으로 공개를 막지 않음. 영상 교체 시 기존 기록 유지 안내(기록 초기화 버튼 없음)
 *
 * 데모 범위: 입력·검증·상태 전환 흐름만 보여 주며 공유 목록에는 되쓰지 않음.
 * 실제 구현에서는 임시저장·공개 요청의 성공 응답으로 목록을 갱신한다.
 */
interface FormState {
  title: string;
  categoryId: string;
  tags: string;
  summary: string;
  related: string;
  source: string;
  reviewedAt: string;
  hasVideo: boolean;
}

const EMPTY: FormState = { title: '', categoryId: '', tags: '', summary: '', related: '', source: '', reviewedAt: '', hasVideo: false };

export function ContentFormPage() {
  const { state } = useStore();
  const navigate = useNavigate();
  const { id } = useParams();
  const { show, node } = useToast();

  const editing = id ? state.contents.find((c) => String(c.id) === id) : undefined;
  const [form, setForm] = useState<FormState>(() =>
    editing
      ? { title: editing.title, categoryId: String(editing.categoryId), tags: editing.tags.join(', '), summary: editing.summary, related: editing.related, source: editing.source, reviewedAt: editing.reviewedAt, hasVideo: editing.hasVideo }
      : EMPTY,
  );
  const [status, setStatus] = useState<ContentStatus>(editing?.status ?? 'DRAFT');
  const [savedOnce, setSavedOnce] = useState(Boolean(editing));
  const [busy, setBusy] = useState<'draft' | 'publish' | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  // 공개 필수 7종 검증
  const publishErrors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!form.hasVideo) e.hasVideo = '영상 파일을 등록해 주세요.';
    if (!form.title.trim()) e.title = '제목을 입력해 주세요.';
    if (!form.categoryId) e.categoryId = '분야를 선택해 주세요.';
    if (!form.tags.trim()) e.tags = '태그를 하나 이상 입력해 주세요.';
    if (!form.summary.trim()) e.summary = '핵심 정리를 입력해 주세요.';
    if (!form.source.trim()) e.source = '출처를 입력해 주세요.';
    if (!form.reviewedAt) e.reviewedAt = '검토일을 입력해 주세요.';
    return e;
  }, [form]);

  const saveDraft = async () => {
    if (busy) return;
    if (!form.title.trim()) {
      setErrors({ title: '임시저장에도 제목은 필요해요.' });
      return;
    }
    setBusy('draft');
    setErrors({});
    try {
      await request('contentSave', null, 500);
      setSavedOnce(true);
      show('임시저장했어요. 학습자료 연결과 공개를 할 수 있어요.');
    } catch {
      show('저장하지 못했어요. 입력값은 그대로 있어요.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const publish = async () => {
    if (busy) return;
    if (Object.keys(publishErrors).length) {
      setErrors(publishErrors);
      show('공개 필수 항목을 확인해 주세요.', 'error');
      return;
    }
    setBusy('publish');
    setErrors({});
    try {
      await request('contentPublish', null, 600);
      setStatus('PUBLISHED');
      setSavedOnce(true);
      show('공개했어요.');
    } catch {
      show('공개하지 못했어요. 초안과 입력은 그대로 있어요.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const err = (key: string) => errors[key];

  return (
    <div className="sasu-page sasu-form">
      <div className="sasu-review__top">
        <button type="button" className="sasu-link" onClick={() => navigate('/admin/contents')}>
          ← 콘텐츠 목록으로
        </button>
        <Badge tone={status === 'PUBLISHED' ? 'green' : 'neutral'}>{status === 'PUBLISHED' ? '공개' : '임시저장'}</Badge>
      </div>

      <header className="sasu-page__head">
        <p className="sasu-eyebrow">관리자 · 콘텐츠</p>
        <h1 className="sasu-title">{editing ? '콘텐츠 수정' : '콘텐츠 등록'}</h1>
        <p className="sasu-sub">영상·제목·분야·태그·핵심 정리·출처·검토일은 공개 필수예요(별표 표시).</p>
      </header>

      <div className="sasu-form__grid">
        <section className="sasu-card">
          <Field label="제목" required error={err('title')}>
            <input className="sasu-input" value={form.title} onChange={(e) => set('title', e.target.value)} />
          </Field>
          <Field label="분야" required error={err('categoryId')}>
            <div className="sasu-row sasu-row--tight">
              <select className="sasu-input" value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
                <option value="">선택</option>
                {sampleCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <Button size="sm" onClick={() => navigate('/admin/categories?back=' + encodeURIComponent(id ? `/admin/contents/${id}` : '/admin/contents/new'))}>
                분야 관리
              </Button>
            </div>
          </Field>
          <Field label="태그" required error={err('tags')} hint="쉼표로 구분해 주세요.">
            <input className="sasu-input" value={form.tags} onChange={(e) => set('tags', e.target.value)} placeholder="예: 보고, 일정" />
          </Field>
          <Field label="핵심 정리" required error={err('summary')} hint="첫 문장이 학습 패널의 한 줄 정리로 쓰여요.">
            <textarea className="sasu-input sasu-input--area" value={form.summary} onChange={(e) => set('summary', e.target.value)} rows={3} />
          </Field>
          <Field label="출처" required error={err('source')}>
            <input className="sasu-input" value={form.source} onChange={(e) => set('source', e.target.value)} />
          </Field>
          <Field label="검토일" required error={err('reviewedAt')}>
            <input className="sasu-input" type="date" value={form.reviewedAt} onChange={(e) => set('reviewedAt', e.target.value)} />
          </Field>
        </section>

        <section className="sasu-card">
          <h2 className="sasu-card__title">영상 *</h2>
          <div className={`sasu-form__media ${err('hasVideo') ? 'is-error' : ''}`}>
            {form.hasVideo ? <span className="sasu-form__media-ok">영상 미리보기(등록됨)</span> : <span className="sasu-muted">아직 영상이 없어요</span>}
          </div>
          <Button size="sm" onClick={() => set('hasVideo', true)}>
            {form.hasVideo ? '파일 교체' : '파일 선택'}
          </Button>
          {err('hasVideo') ? (
            <p className="sasu-field-error" role="alert">
              {err('hasVideo')}
            </p>
          ) : null}
          {editing ? <p className="sasu-help">영상을 교체해도 기존 학습 기록·시청 완료는 유지돼요. 기록 초기화 버튼은 두지 않아요.</p> : null}

          <hr className="sasu-hr" />
          <h2 className="sasu-card__title">학습 패널 표시 자료</h2>
          <Field label="관련 학습 정보" hint="공개 필수 7종에는 들어가지 않아요(P18).">
            <input className="sasu-input" value={form.related} onChange={(e) => set('related', e.target.value)} />
          </Field>
        </section>
      </div>

      <div className="sasu-row sasu-form__actions">
        <Button variant="primary" onClick={() => void saveDraft()} loading={busy === 'draft'}>
          {editing ? '변경 저장' : '임시저장'}
        </Button>
        <Button onClick={() => navigate(savedOnce ? `/admin/materials/${id ?? editing?.id ?? ''}` : '/admin/materials')} disabled={!savedOnce} title={savedOnce ? '' : '먼저 임시저장이 필요해요'}>
          학습자료 관리
        </Button>
        <Button variant="primary" onClick={() => void publish()} loading={busy === 'publish'} disabled={!savedOnce}>
          공개
        </Button>
      </div>
      <p className="sasu-help">먼저 임시저장한 뒤 공개를 직접 선택해요. 퀴즈가 없어도 공개할 수 있어요(시리즈 완료 조건은 별도).</p>
      {node}
    </div>
  );
}

function Field({ label, required, hint, error, children }: { label: string; required?: boolean; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div className={`sasu-field sasu-field--block ${error ? 'is-error' : ''}`}>
      <label className="sasu-field__label">
        {label}
        {required ? <span className="sasu-field__req" aria-hidden="true"> *</span> : null}
        {required ? <span className="sasu-sr"> 필수</span> : null}
      </label>
      {children}
      {error ? (
        <p className="sasu-field-error" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="sasu-field-hint">{hint}</p>
      ) : null}
    </div>
  );
}
