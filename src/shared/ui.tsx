import { useEffect, useRef, useState, type PropsWithChildren, type ReactNode } from 'react';

// 여러 화면에서 쓰는 작은 UI 조각들. 색·텍스트·아이콘을 함께 써서 상태를 구분한다(화면 설계서 1-2).

interface ButtonProps {
  variant?: 'default' | 'primary' | 'ghost' | 'danger' | 'light';
  size?: 'md' | 'sm';
  active?: boolean;
  loading?: boolean;
  disabled?: boolean;
  type?: 'button' | 'submit';
  onClick?: () => void;
  'aria-pressed'?: boolean;
  title?: string;
  children: ReactNode;
}

export function Button({ variant = 'default', size = 'md', active = false, loading = false, disabled, type = 'button', onClick, children, ...rest }: ButtonProps) {
  return (
    <button
      type={type === 'submit' ? 'submit' : 'button'}
      className={`sasu-btn sasu-btn--${variant} ${size === 'sm' ? 'sasu-btn--sm' : ''} ${active ? 'is-active' : ''}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      onClick={onClick}
      {...rest}
    >
      {loading ? <span className="sasu-spinner" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

// 상태 배지. 색만으로 구분하지 않도록 텍스트를 항상 함께 보여 줌
export function Badge({ tone = 'neutral', children }: PropsWithChildren<{ tone?: 'neutral' | 'green' | 'blue' | 'amber' | 'red' }>) {
  return <span className={`sasu-badge sasu-badge--${tone}`}>{children}</span>;
}

export function Spinner({ light = false, label = '불러오는 중' }: { light?: boolean; label?: string }) {
  return (
    <span className="sasu-loading" role="status">
      <span className={`sasu-spinner ${light ? 'sasu-spinner--light' : ''}`} aria-hidden="true" />
      <span className="sasu-sr">{label}</span>
    </span>
  );
}

// 로딩·빈 목록·오류를 구분해 보여 주는 상태 블록(화면 설계서 1-2 비동기 처리)
export function StateBlock({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="sasu-empty">
      <p className="sasu-empty__title">{title}</p>
      {text ? <p className="sasu-empty__text">{text}</p> : null}
      {action ? <div className="sasu-empty__action">{action}</div> : null}
    </div>
  );
}

// 성공·안내용 짧은 상태 알림. 자동으로 사라지며 사용자 화면 이동은 하지 않음(화면 설계서 1-2 알림)
export function useToast() {
  const [toast, setToast] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const show = (text: string, tone: 'ok' | 'error' = 'ok') => {
    window.clearTimeout(timer.current);
    setToast({ text, tone });
    timer.current = window.setTimeout(() => setToast(null), 2600);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const node = toast ? (
    <div className={`sasu-toast sasu-toast--${toast.tone}`} role="status" aria-live="polite">
      {toast.text}
    </div>
  ) : null;
  return { show, node };
}

// 확인 대화상자. 되돌리기를 약속하지 않는 동작(A07) 등에서 명시적 확인을 받음
export function ConfirmDialog({ open, title, children, confirmLabel, onConfirm, onCancel, busy = false, danger = false }: PropsWithChildren<{ open: boolean; title: string; confirmLabel: string; onConfirm: () => void; onCancel: () => void; busy?: boolean; danger?: boolean }>) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLButtonElement>('[data-autofocus]')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [open, busy, onCancel]);
  if (!open) return null;
  return (
    <div className="sasu-modal" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && !busy && onCancel()}>
      <div className="sasu-modal__box" role="dialog" aria-modal="true" aria-labelledby="sasu-modal-title" ref={ref}>
        <h2 id="sasu-modal-title" className="sasu-modal__title">
          {title}
        </h2>
        <div className="sasu-modal__body">{children}</div>
        <div className="sasu-modal__foot">
          <Button onClick={onCancel} disabled={busy}>
            취소
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={busy}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

// 분모가 0이면 0%가 아니라 — (응답 없음)으로 표시(화면 설계서 A06·L08)
export function ratio(n: number, m: number): { text: string; pct: number | null } {
  if (!m) return { text: '—', pct: null };
  return { text: `${Math.round((n / m) * 100)}%`, pct: Math.round((n / m) * 100) };
}
