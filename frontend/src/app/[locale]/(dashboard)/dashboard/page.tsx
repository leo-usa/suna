import { getDictionary } from "../../getDictionary";
import DashboardContent from "@/components/dashboard/dashboard-content";

export default async function DashboardPage({ params }: { params: { locale: string } }) {
  const dict = await getDictionary(params.locale);
  return <DashboardContent dict={dict} />;
}
