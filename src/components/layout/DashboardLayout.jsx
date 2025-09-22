import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import AppSidebar from "@/components/app-sidebar"
import { Outlet } from "react-router-dom"
import Header from "../Header"

export default function DashboardLayout() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <Header />
        <main className="p-6 mx-auto max-w-6xl w-full">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
