import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import AppSidebar from "@/components/app-sidebar"
import { Outlet } from "react-router-dom"

export default function DashboardLayout() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <main className="p-6 mx-auto max-w-6xl w-full">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
