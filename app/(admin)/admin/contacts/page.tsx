import AdminContactsPage from "@/components/pages/main/admin/AdminContacts";
import { getAdminContacts } from "@/app/actions/admin-actions";

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const { data: contacts, total } = await getAdminContacts(page);
  return <AdminContactsPage contacts={contacts} total={total} page={page} />;
}
