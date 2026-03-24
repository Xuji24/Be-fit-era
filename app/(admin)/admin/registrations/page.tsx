import AdminRegistrationsPage from "@/components/pages/main/admin/AdminRegistrations";
import { getAdminRegistrations } from "@/app/actions/admin-actions";

export default async function RegistrationsPage() {
  const registrations = await getAdminRegistrations();
  return <AdminRegistrationsPage registrations={registrations} />;
}
