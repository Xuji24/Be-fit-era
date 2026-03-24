import AdminRacesPage from "@/components/pages/main/admin/AdminRaces";
import { getAdminRaces } from "@/app/actions/admin-actions";

export default async function RacesPage() {
  const races = await getAdminRaces();
  return <AdminRacesPage races={races} />;
}
