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
  const dict = await getDictionary(params.locale);
  return (
    <SidebarProvider>
      <SidebarLeft dict={dict} locale={params.locale} />
      <SidebarInset>
        <div className="bg-background">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}