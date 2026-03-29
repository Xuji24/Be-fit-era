import { getAdminDisputes } from "@/app/actions/admin-actions";
import AdminDisputesPage from "@/components/pages/main/admin/AdminDisputes";

export default async function DisputesPage() {
  const disputes = await getAdminDisputes();

  return <AdminDisputesPage disputes={disputes} />;
}