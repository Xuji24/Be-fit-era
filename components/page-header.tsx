import type { LucideIcon } from "lucide-react";

interface PageHeaderProps {
  icon?: LucideIcon;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Right-aligned slot for stats or actions. */
  actions?: React.ReactNode;
  maxWidthClassName?: string;
}

/** Light, compact page header. The dark hero is reserved for the landing page. */
export default function PageHeader({
  icon: Icon,
  title,
  subtitle,
  actions,
  maxWidthClassName = "max-w-7xl",
}: PageHeaderProps) {
  return (
    <section className="relative bg-[var(--surface-muted)] dark:bg-[#1C1C1E] border-b border-black/5 dark:border-white/5 mb-8 overflow-hidden">
      {/* Soft brand wash so the band reads as tinted rather than flat grey. */}
      <div className="absolute -top-24 -right-16 w-96 h-56 bg-[var(--brand)]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-28 left-1/4 w-80 h-48 bg-[var(--brand-soft)]/15 rounded-full blur-3xl pointer-events-none" />

      <div className={`relative ${maxWidthClassName} mx-auto px-4 sm:px-6 lg:px-8 py-7`}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            {Icon && (
              <div className="w-9 h-9 rounded-xl bg-[var(--brand)]/15 flex items-center justify-center shrink-0">
                <Icon className="w-4.5 h-4.5 text-[var(--brand-hover)]" />
              </div>
            )}
            <div>
              <h1 className="font-raleway font-bold text-xl sm:text-2xl text-[var(--foreground)] dark:text-white leading-tight">
                {title}
              </h1>
              {subtitle && (
                <p className="font-merriweather-sans text-sm text-[var(--foreground)]/50 dark:text-white/50 mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </div>
      </div>
    </section>
  );
}
