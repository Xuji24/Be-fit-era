import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import PageHeader from "@/components/page-header";

export interface LegalSection {
  id: string;
  title: string;
  /** Markdown. */
  content: string;
}

interface LegalPageLayoutProps {
  title: string;
  effectiveDate: string;
  lastUpdated: string;
  /** Markdown. */
  intro: string;
  sections: LegalSection[];
}

const proseClassName =
  "font-merriweather-sans text-sm text-foreground/70 leading-relaxed space-y-4 " +
  "[&_p]:mb-0 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-2 " +
  "[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-2 " +
  "[&_strong]:text-foreground [&_strong]:font-semibold " +
  "[&_h3]:font-raleway [&_h3]:font-bold [&_h3]:text-foreground [&_h3]:text-base [&_h3]:pt-2 " +
  "[&_a]:text-[var(--brand-hover)] [&_a]:underline [&_a]:underline-offset-4 [&_a]:hover:text-[var(--brand)]";

/** Shared shell for long-form legal documents (privacy policy, terms of service):
 * a sticky in-page table of contents next to numbered, anchor-linked sections.
 * Intro and section content are Markdown, sourced from the legal_documents /
 * legal_document_sections tables so admins can edit the live copy without a
 * deploy. */
export default function LegalPageLayout({
  title,
  effectiveDate,
  lastUpdated,
  intro,
  sections,
}: LegalPageLayoutProps) {
  return (
    <div className="min-h-screen relative">
      <PageHeader
        title={title}
        subtitle={`Effective ${effectiveDate} · Last updated ${lastUpdated}`}
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-10 lg:px-16 pb-16 sm:pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-10 lg:gap-14">
          {/* Table of contents */}
          <nav aria-label="Table of contents" className="hidden lg:block lg:col-span-1">
            <div className="sticky top-24">
              <p className="font-raleway font-bold text-xs uppercase tracking-wide text-foreground/40 mb-3">
                On this page
              </p>
              <ul className="space-y-0.5 border-l border-black/5 dark:border-white/8">
                {sections.map((section, index) => (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      className="block pl-4 -ml-px py-1.5 text-sm font-merriweather-sans text-foreground/55 border-l-2 border-transparent hover:border-[var(--brand)] hover:text-[var(--brand-hover)] transition-colors"
                    >
                      {index + 1}. {section.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </nav>

          {/* Document */}
          <article className="lg:col-span-3 bg-white dark:bg-[#1C1C1E] rounded-2xl border border-gray-100 dark:border-white/8 p-6 sm:p-8 md:p-10 min-w-0">
            <div className={`${proseClassName} mb-10 pb-8 border-b border-black/5 dark:border-white/8`}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{intro}</ReactMarkdown>
            </div>

            {/* Mobile TOC: same anchors, just not sticky/sidebar on small screens */}
            <details className="lg:hidden mb-8 rounded-xl border border-gray-100 dark:border-white/8 bg-[var(--surface-muted)] dark:bg-white/5 p-4">
              <summary className="font-raleway font-bold text-sm text-foreground cursor-pointer">
                On this page
              </summary>
              <ul className="mt-3 space-y-2">
                {sections.map((section, index) => (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      className="text-sm font-merriweather-sans text-foreground/60 hover:text-[var(--brand-hover)] transition-colors"
                    >
                      {index + 1}. {section.title}
                    </a>
                  </li>
                ))}
              </ul>
            </details>

            <div className="space-y-12">
              {sections.map((section, index) => (
                <section key={section.id} id={section.id} className="scroll-mt-24">
                  <h2 className="font-raleway font-bold text-lg sm:text-xl text-foreground mb-4">
                    {index + 1}. {section.title}
                  </h2>
                  <div className={proseClassName}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{section.content}</ReactMarkdown>
                  </div>
                </section>
              ))}
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}
