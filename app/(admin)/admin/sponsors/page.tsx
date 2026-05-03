import AdminSponsorsPage from "@/components/pages/main/admin/AdminSponsors";
import { getAdminSponsors } from "@/app/actions/admin-actions";

export default async function SponsorsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const { data: sponsors, total } = await getAdminSponsors(page);
  return <AdminSponsorsPage sponsors={sponsors} total={total} page={page} />;
}
