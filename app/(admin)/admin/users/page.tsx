import AdminUsersPage from "@/components/pages/main/admin/AdminUsers";
import { getAdminUsers } from "@/app/actions/admin-actions";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const { data: users, total } = await getAdminUsers(page);
  return <AdminUsersPage users={users} total={total} page={page} />;
}
