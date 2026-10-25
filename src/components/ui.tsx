import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon, type IconName } from './Icon';

export function PageHeader({ title, subtitle, back, actions }: { title: string; subtitle?: ReactNode; back?: { to: string; label: string }; actions?: ReactNode }) {
  useEffect(() => {
    document.title = title === 'Start' ? 'Sędzia – nauka do konkursu na aplikację sędziowską KSSiP' : `${title} · Sędzia – aplikacja sędziowska`;
  }, [title]);
  return (
    <>
      {back && (
        <Link to={back.to} className="back-link">
          <Icon name="back" size={22} />
          {back.label}
        </Link>
      )}
      <header className="page-header">
        <div style={{ minWidth: 0 }}>
          <h1 className="t-large">{title}</h1>
          {subtitle && <p className="muted t-sub" style={{ margin: '4px 0 0' }}>{subtitle}</p>}
        </div>
        {actions && <div className="actions">{actions}</div>}
      </header>
    </>
  );
}

export function Section({ title, footer, children, id }: { title?: ReactNode; footer?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section className="section" id={id}>
      {title && <h2 className="section-title">{title}</h2>}
      {children}
      {footer && <p className="section-foot">{footer}</p>}
    </section>
  );
}

interface RowProps {
  title: ReactNode;
  sub?: ReactNode;
  value?: ReactNode;
  icon?: IconName;
  iconColor?: string;
  to?: string;
  href?: string;
  onClick?: () => void;
  chevron?: boolean;
  children?: ReactNode;
}

export function Row({ title, sub, value, icon, iconColor, to, href, onClick, chevron, children }: RowProps) {
  const inner = (
    <>
      {icon && (
        <span className="row-icon" style={iconColor ? { background: iconColor } : undefined}>
          <Icon name={icon} size={18} />
        </span>
      )}
      <span className="row-body">
        <span className="row-title" style={{ display: 'block' }}>{title}</span>
        {sub && <span className="row-sub" style={{ display: 'block' }}>{sub}</span>}
      </span>
      {value !== undefined && <span className="row-value">{value}</span>}
      {children}
      {(chevron ?? Boolean(to || href || onClick)) && <Icon name={href ? 'external' : 'chevron'} size={href ? 16 : 18} className="row-chevron" />}
    </>
  );
  const cls = `row${icon ? ' has-icon' : ''}`;
  if (to) return <Link to={to} className={cls}>{inner}</Link>;
  if (href)
    return (
      <a href={href} className={cls} target="_blank" rel="noopener noreferrer">
        {inner}
      </a>
    );
  if (onClick)
    return (
      <button type="button" className={cls} onClick={onClick}>
        {inner}
      </button>
    );
  return <div className={cls}>{inner}</div>;
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="switch">
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-label={label} />
      <span />
    </label>
  );
}

export function SwitchRow({ title, sub, checked, onChange }: { title: string; sub?: ReactNode; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="row">
      <span className="row-body">
        <span className="row-title" style={{ display: 'block' }}>{title}</span>
        {sub && <span className="row-sub" style={{ display: 'block' }}>{sub}</span>}
      </span>
      <Switch checked={checked} onChange={onChange} label={title} />
    </div>
  );
}

export function NumberRow({ title, sub, value, onChange, min = 0, max, step = 1, suffix }: { title: string; sub?: ReactNode; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; suffix?: string }) {
  const id = useId();
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  return (
    <div className="row">
      <label className="row-body" htmlFor={id}>
        <span className="row-title" style={{ display: 'block' }}>{title}</span>
        {sub && <span className="row-sub" style={{ display: 'block' }}>{sub}</span>}
      </label>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          id={id}
          className="input"
          type="text"
          inputMode="decimal"
          value={text}
          style={{ width: 120 }}
          onChange={(e) => {
            setText(e.target.value);
            const v = Number(e.target.value.replace(/\s/g, '').replace(',', '.'));
            if (Number.isFinite(v)) onChange(Math.min(max ?? Infinity, Math.max(min, v)));
          }}
          onBlur={() => setText(String(value))}
          aria-describedby={suffix ? `${id}-s` : undefined}
          data-step={step}
        />
        {suffix && <span id={`${id}-s`} className="muted t-sub">{suffix}</span>}
      </span>
    </div>
  );
}

export function SelectRow<T extends string>({ title, sub, value, options, onChange }: { title: string; sub?: ReactNode; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  const id = useId();
  return (
    <div className="row">
      <label className="row-body" htmlFor={id}>
        <span className="row-title" style={{ display: 'block' }}>{title}</span>
        {sub && <span className="row-sub" style={{ display: 'block' }}>{sub}</span>}
      </label>
      <select id={id} className="input left" value={value} onChange={(e) => onChange(e.target.value as T)} style={{ maxWidth: '55%' }}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function Notice({ kind = 'info', children, icon }: { kind?: 'info' | 'warn' | 'ok'; children: ReactNode; icon?: IconName }) {
  return (
    <div className={`notice${kind === 'info' ? '' : ` ${kind}`}`} role={kind === 'warn' ? 'note' : undefined}>
      <Icon name={icon ?? (kind === 'warn' ? 'warning' : kind === 'ok' ? 'check' : 'info')} size={20} />
      <div>{children}</div>
    </div>
  );
}

export function ProgressBar({ value, label }: { value: number; label: string }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={label}>
      <div style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Ring({ value, size = 64, stroke = 7, label, children }: { value: number; size?: number; stroke?: number; label: string; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.min(1, Math.max(0, value));
  return (
    <div style={{ position: 'relative', width: size, height: size, flex: 'none' }} role="img" aria-label={label}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--fill-strong)" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--tint)" strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${c * v} ${c}`} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: size / 4.2 }} className="num">
        {children}
      </div>
    </div>
  );
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      prev?.focus();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grabber" />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <h2 className="t-title3">{title}</h2>
          <button type="button" className="btn plain" onClick={onClose}>
            Gotowe
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const ToastCtx = createContext<(msg: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const show = useCallback((m: string) => {
    setMsg(m);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMsg(null), 2600);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div aria-live="polite" className="visually-hidden">{msg}</div>
      {msg && <div className="toast" role="status">{msg}</div>}
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);

export function Loading({ lines = 3 }: { lines?: number }) {
  return (
    <div aria-busy="true" aria-label="Wczytywanie" style={{ display: 'grid', gap: 10 }}>
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="skeleton" style={{ height: 18, width: `${90 - i * 12}%` }} />
      ))}
    </div>
  );
}

export function ErrorBox({ error, retry }: { error: unknown; retry?: () => void }) {
  return (
    <Notice kind="warn">
      <strong>Nie udało się wczytać danych.</strong> {error instanceof Error ? error.message : String(error)}{' '}
      {retry && (
        <button type="button" className="btn small" onClick={retry} style={{ marginTop: 8 }}>
          Spróbuj ponownie
        </button>
      )}
    </Notice>
  );
}

export const zl = (v: number, digits = 2) =>
  `${v.toLocaleString('pl-PL', { minimumFractionDigits: digits, maximumFractionDigits: digits })} zł`;
