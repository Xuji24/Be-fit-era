import AdminRegistrationsPage from "@/components/pages/main/admin/AdminRegistrations";
import { getAdminRegistrations } from "@/app/actions/admin-actions";

export default async function RegistrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const { data: registrations, total } = await getAdminRegistrations(page);
  return (
    <AdminRegistrationsPage
      registrations={registrations}
      total={total}
      page={page}
    />
  );
}
