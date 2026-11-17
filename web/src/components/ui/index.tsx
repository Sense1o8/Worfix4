"use client";
import clsx from "clsx";
import Link from "next/link";
import { AlertTriangle, Inbox, Loader2 } from "lucide-react";
import { useId, useRef, type ComponentProps, type KeyboardEvent, type ReactNode } from "react";

export const cn = clsx;

/* ── Button ───────────────────────────────────────────── */
type Variant = "primary" | "secondary" | "ghost" | "danger" | "accent";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-md font-semibold select-none whitespace-nowrap " +
  "transition-[transform,background-color,box-shadow,opacity] duration-150 ease-out active:scale-[0.97] " +
  "disabled:opacity-55 disabled:pointer-events-none";
const variants: Record<Variant, string> = {
  primary: "bg-primary text-on-primary hover:bg-primary-hover shadow-low",
  secondary: "bg-surface text-text border border-border-strong hover:bg-surface-2",
  ghost: "text-text hover:bg-surface-2",
  danger: "bg-error text-surface hover:opacity-90",
  accent: "bg-accent-fill text-on-accent-fill hover:brightness-95 shadow-low",
};
const sizes: Record<Size, string> = {
  sm: "min-h-9 px-3 text-sm",
  md: "min-h-11 px-4 text-[0.9375rem]", // 44px touch target
  lg: "min-h-12 px-6 text-base",
};
export const buttonClass = (v: Variant = "primary", s: Size = "md", extra?: string) => cn(base, variants[v], sizes[s], extra);

export function Button({
  variant = "primary", size = "md", loading, className, children, disabled, ...rest
}: ComponentProps<"button"> & { variant?: Variant; size?: Size; loading?: boolean }) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClass(variant, size, className)}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = "primary", size = "md", className, ...rest
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link {...rest} className={buttonClass(variant, size, className)} />;
}

/* ── Form fields ──────────────────────────────────────── */
interface FieldShell { label: string; hint?: string; error?: string; required?: boolean }

const control =
  "w-full min-h-11 rounded-md border bg-surface px-3 text-[0.9375rem] text-text placeholder:text-muted/80 " +
  "transition-[border-color,box-shadow] duration-150 ease-out focus-visible:border-secondary focus-visible:outline-none " +
  "focus-visible:ring-4 focus-visible:ring-secondary/25 disabled:opacity-60";

function Shell({ id, label, hint, error, required, children }: FieldShell & { id: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
        {required && <span className="text-error" aria-hidden> *</span>}
      </label>
      {children}
      {hint && !error && <p id={`${id}-hint`} className="t-small text-muted">{hint}</p>}
      {error && (
        <p id={`${id}-err`} role="alert" className="t-small text-error font-medium">
          {error}
        </p>
      )}
    </div>
  );
}
const aria = (id: string, hint?: string, error?: string) => ({
  "aria-invalid": error ? true : undefined,
  "aria-describedby": error ? `${id}-err` : hint ? `${id}-hint` : undefined,
});

export function Input({ label, hint, error, required, className, ...rest }: FieldShell & ComponentProps<"input">) {
  const id = useId();
  return (
    <Shell id={id} {...{ label, hint, error, required }}>
      <input id={id} required={required} {...aria(id, hint, error)} {...rest} className={cn(control, error ? "border-error" : "border-border-strong", className)} />
    </Shell>
  );
}
export function Textarea({ label, hint, error, required, className, ...rest }: FieldShell & ComponentProps<"textarea">) {
  const id = useId();
  return (
    <Shell id={id} {...{ label, hint, error, required }}>
      <textarea id={id} rows={4} required={required} {...aria(id, hint, error)} {...rest} className={cn(control, "py-2.5", error ? "border-error" : "border-border-strong", className)} />
    </Shell>
  );
}
export function Select({ label, hint, error, required, className, children, ...rest }: FieldShell & ComponentProps<"select">) {
  const id = useId();
  return (
    <Shell id={id} {...{ label, hint, error, required }}>
      <select id={id} required={required} {...aria(id, hint, error)} {...rest} className={cn(control, error ? "border-error" : "border-border-strong", className)}>
        {children}
      </select>
    </Shell>
  );
}

export function Checkbox({ label, error, className, ...rest }: { label: ReactNode; error?: string } & ComponentProps<"input">) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="flex min-h-11 items-start gap-3 py-2 text-sm cursor-pointer">
        <input id={id} type="checkbox" {...aria(id, undefined, error)} {...rest} className="mt-0.5 size-5 shrink-0 accent-[var(--primary)]" />
        <span>{label}</span>
      </label>
      {error && <p id={`${id}-err`} role="alert" className="t-small text-error font-medium pl-8">{error}</p>}
    </div>
  );
}

/** Pill-style multi-select used for causes/interests. Real checkboxes underneath for keyboard + screen readers. */
export function ChipGroup<T extends string>({
  legend, options, value, onChange, error, labels,
}: { legend: string; options: readonly T[]; value: T[]; onChange: (v: T[]) => void; error?: string; labels?: Record<string, string> }) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = value.includes(o);
          return (
            <label
              key={o}
              className={cn(
                "inline-flex min-h-11 cursor-pointer items-center rounded-full border px-4 text-sm font-medium capitalize",
                "transition-[background-color,border-color,transform] duration-150 ease-out active:scale-[0.97]",
                "has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--ring)]",
                on ? "border-primary bg-primary-soft text-on-primary-soft" : "border-border-strong bg-surface hover:bg-surface-2",
              )}
            >
              <input
                type="checkbox" className="sr-only" checked={on}
                onChange={() => onChange(on ? value.filter((v) => v !== o) : [...value, o])}
              />
              {labels?.[o] ?? o}
            </label>
          );
        })}
      </div>
      {error && <p role="alert" className="t-small text-error font-medium">{error}</p>}
    </fieldset>
  );
}

/* ── Surfaces ─────────────────────────────────────────── */
export function Card({ className, ...rest }: ComponentProps<"div">) {
  return <div {...rest} className={cn("rounded-lg border border-border bg-surface shadow-low", className)} />;
}

type Tone = "neutral" | "success" | "info" | "reward" | "warning" | "danger";
const tones: Record<Tone, string> = {
  neutral: "bg-surface-2 text-text",
  success: "bg-primary-soft text-on-primary-soft",
  info: "bg-secondary-soft text-on-secondary-soft",
  reward: "bg-accent-soft text-on-accent-soft",
  warning: "bg-warning-soft text-on-warning-soft",
  danger: "bg-error-soft text-on-error-soft",
};
export function Badge({ tone = "neutral", className, ...rest }: ComponentProps<"span"> & { tone?: Tone }) {
  return <span {...rest} className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", tones[tone], className)} />;
}

export function ProgressBar({ value, label, tone = "reward" }: { value: number; label: string; tone?: "reward" | "success" | "info" }) {
  const v = Math.min(1, Math.max(0, value));
  const fill = tone === "reward" ? "bg-accent-fill" : tone === "success" ? "bg-primary" : "bg-secondary";
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v * 100)} className="h-2.5 w-full overflow-hidden rounded-full bg-surface-2">
      <div className={cn("h-full w-full origin-left rounded-full transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]", fill)} style={{ transform: `scaleX(${v})` }} />
    </div>
  );
}

export function Avatar({ name, src, size = 40 }: { name: string; src?: string | null; size?: number }) {
  const initials = name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" width={size} height={size} className="rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span aria-hidden className="inline-flex items-center justify-center rounded-full bg-primary-soft font-semibold text-on-primary-soft" style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {initials || "?"}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("skeleton", className)} />;
}

export function LoadingBlock({ rows = 3 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading" className="space-y-3">
      {Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="h-20 w-full" />)}
    </div>
  );
}

export function EmptyState({ title, body, action, icon }: { title: string; body: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed border-border-strong bg-surface px-6 py-12 text-center">
      <div className="mb-3 text-muted" aria-hidden>{icon ?? <Inbox className="size-8" />}</div>
      <h3 className="t-h3">{title}</h3>
      <p className="mt-1 max-w-sm t-small text-muted">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-lg border border-error/40 bg-error-soft p-4 text-on-error-soft">
      <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="flex-1">
        <p className="font-semibold">Something went wrong</p>
        <p className="t-small">{error.message}</p>
        {onRetry && <Button variant="secondary" size="sm" className="mt-3" onClick={onRetry}>Try again</Button>}
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="t-h1">{title}</h1>
        {subtitle && <p className="mt-1 t-sub">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, tone = "neutral" }: { label: string; value: ReactNode; hint?: string; tone?: "neutral" | "reward" | "info" | "success" }) {
  const color = { neutral: "text-text", reward: "text-accent", info: "text-secondary", success: "text-primary" }[tone];
  return (
    <Card className="p-5">
      <p className="t-small text-muted">{label}</p>
      <p className={cn("mt-1 text-3xl font-bold tracking-tight tabular-nums", color)}>{value}</p>
      {hint && <p className="mt-1 t-caption text-muted">{hint}</p>}
    </Card>
  );
}

/* ── Tabs (roving tabindex + arrow keys) ───────────────── */
export function Tabs<T extends string>({
  tabs, value, onChange, label,
}: { tabs: { id: T; label: string; count?: number }[]; value: T; onChange: (id: T) => void; label: string }) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const onKey = (e: KeyboardEvent, i: number) => {
    let n = i;
    if (e.key === "ArrowRight") n = (i + 1) % tabs.length;
    else if (e.key === "ArrowLeft") n = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") n = 0;
    else if (e.key === "End") n = tabs.length - 1;
    else return;
    e.preventDefault();
    onChange(tabs[n].id);
    refs.current[tabs[n].id]?.focus();
  };
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto rounded-md bg-surface-2 p-1">
      {tabs.map((t, i) => {
        const on = t.id === value;
        return (
          <button
            key={t.id} ref={(el) => { refs.current[t.id] = el; }} role="tab" type="button" aria-selected={on}
            id={`tab-${t.id}`} aria-controls={`panel-${t.id}`} tabIndex={on ? 0 : -1} onKeyDown={(e) => onKey(e, i)} onClick={() => onChange(t.id)}
            className={cn(
              "min-h-10 shrink-0 rounded-sm px-4 text-sm font-semibold transition-[background-color,color,box-shadow] duration-150 ease-out",
              on ? "bg-surface text-text shadow-low" : "text-muted hover:text-text",
            )}
          >
            {t.label}
            {t.count !== undefined && <span className="ml-1.5 rounded-full bg-surface-2 px-1.5 text-xs tabular-nums">{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/* ── Tooltip (hover + focus, described-by) ─────────────── */
export function Tooltip({ text, children }: { text: string; children: ReactNode }) {
  const id = useId();
  return (
    <span className="group relative inline-flex">
      <span aria-describedby={id} className="inline-flex">{children}</span>
      <span
        id={id} role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-max max-w-56 -translate-x-1/2 rounded-sm bg-text px-2.5 py-1.5 text-xs text-bg opacity-0 shadow-med transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}

export function Table({ className, ...rest }: ComponentProps<"table">) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <table {...rest} className={cn("w-full text-left text-sm [&_th]:px-4 [&_th]:py-3 [&_th]:font-semibold [&_th]:text-muted [&_td]:px-4 [&_td]:py-3 [&_tbody_tr]:border-t [&_tbody_tr]:border-border", className)} />
    </div>
  );
}
