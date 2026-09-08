import { getLegalDocument } from "@/app/actions/legal-actions";
import LegalPageLayout from "./legal-page-layout";
import LegalDocumentNotFound, { formatLegalDate } from "./legal-document-not-found";

export default async function PrivacyPolicyPage() {
  const doc = await getLegalDocument("privacy-policy");

  if (!doc) return <LegalDocumentNotFound title="Privacy Policy" />;

  return (
    <LegalPageLayout
      title={doc.title}
      effectiveDate={formatLegalDate(doc.effectiveDate)}
      lastUpdated={formatLegalDate(doc.updatedAt)}
      intro={doc.intro}
      sections={doc.sections.map((section) => ({
        id: section.anchor,
        title: section.title,
        content: section.content,
      }))}
    />
  );
}
