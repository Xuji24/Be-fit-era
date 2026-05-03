import AdminApplicationsPage from "@/components/pages/main/admin/AdminApplications";
import { getAdminApplications } from "@/app/actions/admin-actions";

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const { data: applications, total } = await getAdminApplications(page);
  return (
    <AdminApplicationsPage
      applications={applications}
      total={total}
      page={page}
    />
  );
}
