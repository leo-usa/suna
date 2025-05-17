import { getDictionary } from "../../getDictionary";
import DashboardContent from "@/components/dashboard/dashboard-content";

export default async function DashboardPage({ params }: { params: { locale: string } }) {
  const paramsAwaited = await params;
  const dict = await getDictionary(paramsAwaited.locale);
  return <DashboardContent dict={dict} />;
}
