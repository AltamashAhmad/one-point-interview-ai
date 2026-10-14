import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon';
import './ui.css';

export { Icon };

const joinClass = (...parts) => parts.filter(Boolean).join(' ');

/** Shared button. Renders the global `.btn` classes so legacy markup and new components look identical. */
export function Button({
  variant = 'primary',
  size = 'md',
  block = false,
  loading = false,
  icon,
  iconRight,
  as: Tag = 'button',
  className,
  children,
  disabled,
  type,
  ...rest
}) {
  const isButton = Tag === 'button';
  return (
    <Tag
      className={joinClass('btn', `btn-${variant}`, size !== 'md' && `btn-${size}`, block && 'btn-block', className)}
      type={isButton ? type || 'button' : undefined}
      disabled={isButton ? disabled || loading : undefined}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <span className="btn-spinner" aria-hidden="true" /> : icon && <Icon name={icon} size={size === 'sm' ? 16 : 18} />}
      {children}
      {!loading && iconRight && <Icon name={iconRight} size={size === 'sm' ? 16 : 18} />}
    </Tag>
  );
}

/** Icon-only button; `label` is required because there is no visible text. */
export function IconButton({ icon, label, variant = 'ghost', size = 'md', className, ...rest }) {
  return (
    <Button
      variant={variant}
      size={size}
      className={joinClass('btn-icon', className)}
      aria-label={label}
      title={label}
      {...rest}
    >
      <Icon name={icon} size={size === 'sm' ? 16 : 18} />
    </Button>
  );
}

export function Card({ as: Tag = 'div', titleAs: TitleTag = 'h3', interactive = false, padded = true, title, description, actions, className, children, ...rest }) {
  return (
    <Tag
      className={joinClass('ui-card', interactive && 'ui-card--interactive', !padded && 'ui-card--flush', className)}
      {...rest}
    >
      {(title || actions) && (
        <div className="ui-card__header">
          <div>
            {title && <TitleTag className="ui-card__title">{title}</TitleTag>}
            {description && <p className="ui-card__description">{description}</p>}
          </div>
          {actions && <div className="ui-card__actions">{actions}</div>}
        </div>
      )}
      {children}
    </Tag>
  );
}

export function Badge({ tone = 'neutral', dot = false, className, children }) {
  return (
    <span className={joinClass('ui-badge', `ui-badge--${tone}`, className)}>
      {dot && <span className="ui-badge__dot" aria-hidden="true" />}
      {children}
    </span>
  );
}

/** Roving radio group: arrow keys move and select, Tab leaves the group. */
export function SegmentedControl({ options, value, onChange, ariaLabel, className }) {
  const refs = useRef([]);
  const move = (from, step) => {
    const next = (from + step + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };
  const onKeyDown = (e, index) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); move(index, 1); }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); move(index, -1); }
  };
  return (
    <div className={joinClass('ui-segmented', className)} role="radiogroup" aria-label={ariaLabel}>
      {options.map((opt, i) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            className="ui-segmented__item"
            onClick={() => onChange(opt.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            {opt.icon && <Icon name={opt.icon} size={16} />}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/** Tab strip only; the page renders the matching panel. Arrow keys move between tabs. */
export function Tabs({ items, value, onChange, ariaLabel, className }) {
  const refs = useRef([]);
  const onKeyDown = (e, index) => {
    let next = null;
    if (e.key === 'ArrowRight') next = (index + 1) % items.length;
    if (e.key === 'ArrowLeft') next = (index - 1 + items.length) % items.length;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = items.length - 1;
    if (next === null) return;
    e.preventDefault();
    onChange(items[next].value);
    refs.current[next]?.focus();
  };
  return (
    <div className={joinClass('ui-tabs', className)} role="tablist" aria-label={ariaLabel}>
      {items.map((item, i) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            className="ui-tab"
            onClick={() => onChange(item.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            {item.label}
            {item.count !== undefined && <span className="ui-tab__count">{item.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function ProgressBar({ value, max = 100, tone = 'accent', size = 'md', label, ariaLabel, showValue = false, className }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div className={joinClass('ui-progress', `ui-progress--${size}`, className)}>
      {(label || showValue) && (
        <div className="ui-progress__meta">
          {label && <span>{label}</span>}
          {showValue && <span className="ui-progress__value">{Math.round(pct)}%</span>}
        </div>
      )}
      <div
        className="ui-progress__track"
        role="progressbar"
        aria-label={ariaLabel || label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={Math.min(max, Math.max(0, value))}
      >
        <div className={`ui-progress__fill ui-progress__fill--${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function Skeleton({ width, height = 14, radius, className, style }) {
  return (
    <span
      className={joinClass('ui-skeleton', className)}
      style={{ width, height, borderRadius: radius, ...style }}
      aria-hidden="true"
    />
  );
}

export function EmptyState({ icon = 'info', title, description, action, className, headingAs: Heading = 'h3' }) {
  return (
    <div className={joinClass('ui-empty', className)}>
      <span className="ui-empty__icon"><Icon name={icon} size={22} /></span>
      <Heading className="ui-empty__title">{title}</Heading>
      {description && <p className="ui-empty__desc">{description}</p>}
      {action && <div className="ui-empty__action">{action}</div>}
    </div>
  );
}

/** Label, control, hint and error wired together with ids. `children` is a render function receiving the control props. */
export function Field({ label, hint, error, children, className }) {
  const id = useId();
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;
  return (
    <div className={joinClass('ui-field', className)}>
      {label && <label className="ui-field__label" htmlFor={id}>{label}</label>}
      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined })}
      {hint && !error && <p className="ui-field__hint" id={`${id}-hint`}>{hint}</p>}
      {error && <p className="ui-field__error" id={`${id}-error`} role="alert">{error}</p>}
    </div>
  );
}

export const Input = React.forwardRef(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={joinClass('ui-input', className)} {...rest} />;
});

export const Select = React.forwardRef(function Select({ className, children, ...rest }, ref) {
  return <select ref={ref} className={joinClass('ui-input ui-select', className)} {...rest}>{children}</select>;
});

export const Textarea = React.forwardRef(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={joinClass('ui-input ui-textarea', className)} {...rest} />;
});

const FOCUSABLE = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

/** Modal dialog: portal, Esc / backdrop close, focus trap, scroll lock, and focus returns to the opener. */
export function Toast({ msg, ok = true }) {
  return (
    <div className={joinClass('ui-toast', ok ? 'ui-toast--ok' : 'ui-toast--err')} role={ok ? 'status' : 'alert'} aria-live={ok ? 'polite' : 'assertive'}>
      {msg}
    </div>
  );
}

export function Table({ children, className = '', ariaLabel, dense = false, ...rest }) {
  return (
    <div className={`ui-table-wrap ${className}`.trim()}>
      <table className={dense ? 'ui-table ui-table--dense' : 'ui-table'} aria-label={ariaLabel} {...rest}>
        {children}
      </table>
    </div>
  );
}

export function Dialog({ open, onClose, title, description, children, footer, size = 'md' }) {
  const cardRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  const descId = useId();

  // Re-renders with a new inline onClose must not re-run the focus setup below.
  useEffect(() => { onCloseRef.current = onClose; });

  useEffect(() => {
    if (!open) return undefined;
    const opener = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const card = cardRef.current;
    const first = card?.querySelector(FOCUSABLE);
    (first || card)?.focus();

    const onKeyDown = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onCloseRef.current?.(); return; }
      if (e.key !== 'Tab' || !card) return;
      const items = [...card.querySelectorAll(FOCUSABLE)];
      if (items.length === 0) { e.preventDefault(); return; }
      const [head, tail] = [items[0], items[items.length - 1]];
      if (e.shiftKey && document.activeElement === head) { e.preventDefault(); tail.focus(); }
      else if (!e.shiftKey && document.activeElement === tail) { e.preventDefault(); head.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div
        ref={cardRef}
        className={joinClass('modal-card', size === 'lg' && 'modal-card--lg')}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
      >
        {title && <h2 className="modal-title" id={titleId}>{title}</h2>}
        {description && <p className="modal-body" id={descId}>{description}</p>}
        {children}
        {footer && <div className="modal-actions">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
