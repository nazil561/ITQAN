import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

const buttonBase =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-5 py-2 font-label text-[11px] tracking-[0.2em] uppercase transition-[color,background-color,border-color,scale] duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50";
const buttonVariants = {
  primary: "bg-citron text-ink hover:bg-citron-dark",
  secondary: "border border-forest text-forest hover:bg-subtle",
  ghost: "text-body hover:bg-subtle hover:text-ink",
};
type Variant = keyof typeof buttonVariants;

export function Button({
  variant = "primary",
  className = "",
  type = "button",
  ...props
}: ComponentProps<"button"> & { variant?: Variant }) {
  return <button type={type} className={`${buttonBase} ${buttonVariants[variant]} ${className}`} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={`${buttonBase} ${buttonVariants[variant]} ${className}`} {...props} />;
}

const fieldBase =
  "min-h-10 w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-leaf focus:outline-2 focus:outline-offset-0 focus:outline-leaf/20";

export function Input({ className = "", ...props }: ComponentProps<"input">) {
  return <input className={`${fieldBase} ${className}`} {...props} />;
}

export function Textarea({ className = "", ...props }: ComponentProps<"textarea">) {
  return <textarea className={`${fieldBase} ${className}`} {...props} />;
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-2 block font-label text-[11px] font-normal tracking-[0.15em] text-ochre uppercase">
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1.5 text-[13px] text-muted">{hint}</p>}
      {error && (
        <p role="alert" className="mt-1.5 text-[13px] text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-8 sm:mb-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-[clamp(40px,5vw,72px)] leading-[1.05] text-balance">{title}</h1>
          {description && <p className="mt-3 max-w-2xl text-[17px] leading-relaxed text-body">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2 max-sm:w-full">{actions}</div>}
      </div>
    </div>
  );
}

export function Section({
  title,
  description,
  actions,
  children,
  className = "",
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section data-reveal="" suppressHydrationWarning className={`mb-10 sm:mb-12 ${className}`}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-display text-[clamp(26px,2.6vw,36px)] leading-tight">{title}</h2>
          {description && <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted">{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function Panel({ className = "", ...props }: ComponentProps<"div">) {
  return <div className={`rounded-xl border border-line bg-surface ${className}`} {...props} />;
}

/** Latin binomials are always set in the serif face, per the PRD. */
export function Botanical({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <i className={`font-serif text-[1.06em] ${className}`}>{children}</i>;
}

export function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="font-label text-[11px] tracking-[0.15em] text-ochre uppercase">{label}</dt>
      <dd className="mt-1.5 text-[15px] text-ink">{children}</dd>
    </div>
  );
}

export function formatDate(iso: string | null) {
  if (!iso) return "Not available";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatPercent(ratio: number | null) {
  return ratio === null ? "Not reported" : `${Math.round(ratio * 100)}%`;
}
