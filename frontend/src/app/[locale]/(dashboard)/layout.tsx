import { SidebarLeft } from "@/components/sidebar/sidebar-left"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { getDictionary } from "../getDictionary"

interface DashboardLayoutProps {
  children: React.ReactNode
  params: { locale: string }
}

export default async function DashboardLayout({ children, params }: DashboardLayoutProps) {
  const paramsAwaited = await params;
  const dict = await getDictionary(paramsAwaited.locale);
  return (
    <SidebarProvider>
      <SidebarLeft dict={dict} locale={paramsAwaited.locale} />
      <SidebarInset>
        <div className="bg-background">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}