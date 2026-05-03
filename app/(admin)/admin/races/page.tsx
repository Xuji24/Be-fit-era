import AdminRacesPage from "@/components/pages/main/admin/AdminRaces";
import { getAdminRaces } from "@/app/actions/admin-actions";

export default async function RacesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const { data: races, total } = await getAdminRaces(page);
  return <AdminRacesPage races={races} total={total} page={page} />;
}
