import React from "react";
import {
  IconDashboard,
  IconPhone,
  IconCategory2,
  IconShoppingCart,
  IconUsers,
  IconSettings,
  IconHelp,
  IconDatabase,
  IconReport,
  IconBrandProducthunt,
  IconUserCircle,
  IconUsersGroup
} from "@tabler/icons-react";
import { Link } from "react-router-dom";

import { NavMain } from "@/components/nav-main";
import { NavSecondary } from "@/components/nav-secondary";
import { NavUser } from "@/components/nav-user";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const navData = {
  user: {
    name: "Admin Tienda",
    email: "admin@tiendacelulares.com",
    avatar: "/avatars/admin.jpg",
  },
  navMain: [
    { title: "Dashboard", url: "/dashboard", icon: IconDashboard },
    { title: "Productos", url: "/dashboard/products", icon: IconReport },
    { title: "Categorías", url: "/dashboard/categories", icon: IconCategory2 },
    { title: "Pedidos", url: "/dashboard/orders", icon: IconShoppingCart },
    { title: "Clientes", url: "/dashboard/clients", icon: IconUsers },
    { title: "Equipo", url: "/dashboard/users", icon: IconUsersGroup },
  ],
  navSecondary: [
    { title: "Configuración", url: "/dashboard/settings", icon: IconSettings },
    { title: "Ayuda", url: "/dashboard/help", icon: IconHelp },
  ],
};

export default function AppSidebar(props) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <span className="text-xl font-bold">Toexi Tech</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <NavMain items={navData.navMain} />
        <NavSecondary items={navData.navSecondary} className="mt-auto" />
      </SidebarContent>

      <SidebarFooter>
        <NavUser user={navData.user} />
      </SidebarFooter>
    </Sidebar>
  );
}
