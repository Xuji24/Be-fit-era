import PageHeader from "@/components/page-header";

/** Shown if a legal document hasn't been seeded/published yet — keeps the
 * route from 500ing if the DB row is missing rather than assuming it exists. */
export default function LegalDocumentNotFound({ title }: { title: string }) {
  return (
    <div className="min-h-screen relative">
      <PageHeader title={title} subtitle="This document hasn't been published yet." />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16 text-center">
        <p className="font-merriweather-sans text-sm text-foreground/55">
          Check back soon, or reach us directly at{" "}
          <a
            href="mailto:hello@befitera.com"
            className="text-[var(--brand-hover)] underline underline-offset-4 hover:text-[var(--brand)]"
          >
            hello@befitera.com
          </a>
          .
        </p>
      </div>
    </div>
  );
}

export function formatLegalDate(value: string): string {
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
