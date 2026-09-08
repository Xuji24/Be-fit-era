import Link from "next/link";
import { FileText, ChevronRight } from "lucide-react";
import { getAdminLegalDocument, type LegalDocumentSlug } from "@/app/actions/legal-actions";

const documents: { slug: LegalDocumentSlug; name: string }[] = [
  { slug: "privacy-policy", name: "Privacy Policy" },
  { slug: "terms-of-service", name: "Terms of Service" },
];

export default async function AdminLegalPage() {
  const docs = await Promise.all(documents.map((d) => getAdminLegalDocument(d.slug)));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-raleway font-bold text-xl text-foreground">Legal Documents</h1>
        <p className="font-merriweather-sans text-sm text-foreground/50 mt-1">
          Edit the live Privacy Policy and Terms of Service — changes publish immediately, no deploy needed.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {documents.map((meta, index) => {
          const doc = docs[index];
          return (
            <Link
              key={meta.slug}
              href={`/admin/legal/${meta.slug}`}
              className="group bg-white dark:bg-[#1C1C1E] rounded-2xl border border-black/5 dark:border-white/5 shadow-sm p-6 flex items-center justify-between gap-4 hover:border-[var(--brand)]/40 transition-colors"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-11 h-11 shrink-0 rounded-xl bg-[var(--brand)]/10 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-[var(--brand-hover)]" />
                </div>
                <div className="min-w-0">
                  <p className="font-raleway font-bold text-sm text-foreground">{meta.name}</p>
                  <p className="font-merriweather-sans text-xs text-foreground/40 mt-0.5 truncate">
                    {doc
                      ? `${doc.sections.length} sections · updated ${new Date(doc.updatedAt).toLocaleDateString()}`
                      : "Not published yet"}
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-foreground/30 group-hover:text-[var(--brand-hover)] transition-colors shrink-0" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
