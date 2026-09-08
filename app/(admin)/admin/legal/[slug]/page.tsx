import { notFound } from "next/navigation";
import { getAdminLegalDocument, type LegalDocumentSlug } from "@/app/actions/legal-actions";
import AdminLegalEditor from "@/components/pages/main/admin/AdminLegalEditor";

const PUBLIC_PATHS: Record<LegalDocumentSlug, string> = {
  "privacy-policy": "/privacy-policy",
  "terms-of-service": "/terms-of-service",
};

function isLegalDocumentSlug(value: string): value is LegalDocumentSlug {
  return value === "privacy-policy" || value === "terms-of-service";
}

export default async function AdminLegalDocumentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!isLegalDocumentSlug(slug)) notFound();

  const document = await getAdminLegalDocument(slug);
  if (!document) notFound();

  return <AdminLegalEditor slug={slug} publicPath={PUBLIC_PATHS[slug]} document={document} />;
}
