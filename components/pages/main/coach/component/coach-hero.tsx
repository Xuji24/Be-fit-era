import Link from "next/link";
import { ArrowLeft, type LucideIcon } from "lucide-react";

interface CoachHeroProps {
  icon: LucideIcon;
  title: string;
  backHref?: string;
  maxWidthClassName?: string;
  /** Right-aligned slot, e.g. the history button. */
  actions?: React.ReactNode;
}

/** Slim inline header for every /coach subpage. backHref defaults to the dashboard. */
export default function CoachHero({
  icon: Icon,
  title,
  backHref = "/coach",
  maxWidthClassName = "max-w-2xl",
  actions,
}: CoachHeroProps) {
  return (
    <div className="relative bg-[var(--surface-muted)] dark:bg-[#1C1C1E] border-b border-black/5 dark:border-white/5 mb-6 overflow-hidden">
      {/* Soft brand wash so the band reads as tinted rather than flat grey. */}
      <div className="absolute -top-20 -right-10 w-72 h-40 bg-[var(--brand)]/10 rounded-full blur-3xl pointer-events-none" />

      <div className={`relative ${maxWidthClassName} mx-auto px-6 py-4 flex items-center gap-3`}>
        <Link
          href={backHref}
          className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-foreground/40 hover:text-[var(--brand-hover)] hover:bg-[var(--brand)]/10 transition-colors"
          aria-label="Back"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <Icon className="w-4 h-4 text-[var(--brand-hover)] shrink-0" />
        <h1 className="flex-1 min-w-0 text-base font-semibold text-foreground font-raleway truncate">
          {title}
        </h1>
        {actions}
      </div>
    </div>
  );
}
