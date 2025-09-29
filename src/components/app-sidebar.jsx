import React from "react";
import {
  IconDashboard,
  IconCategory2,
  IconShoppingCart,
  IconUsers,
  IconSettings,
  IconHelp,
  IconReport,
  IconUsersGroup,
  IconMenu4,
  IconBrandApple,
} from "@tabler/icons-react";

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

import { useAuth } from "@/context/AuthContextProvider"; // 👈 Importá el hook

const navMain = [
  { title: "Dashboard", url: "/dashboard", icon: IconDashboard },
  { title: "Productos", url: "/dashboard/products", icon: IconReport },
  {
    title: "Catálogo",
    icon: IconMenu4,
    items: [
      {
        title: "Marcas",
        url: "/dashboard/catalog/brands",
        icon: IconBrandApple,
      },
      {
        title: "Categorías",
        url: "/dashboard/catalog/categories",
        icon: IconCategory2,
      },
    ],
  },
  { title: "Pedidos", url: "/dashboard/orders", icon: IconShoppingCart },
  { title: "Clientes", url: "/dashboard/clients", icon: IconUsers },
  { title: "Equipo", url: "/dashboard/team", icon: IconUsersGroup },
];

const navSecondary = [
  { title: "Configuración", url: "/dashboard/settings", icon: IconSettings },
  { title: "Ayuda", url: "/dashboard/help", icon: IconHelp },
];

export default function AppSidebar(props) {
  const { user } = useAuth(); // 👉 usuario de supabase

  // Mientras carga la sesión podés mostrar algo por defecto
  const displayUser = user
    ? {
        name: user.user_metadata?.name || "Usuario",
        email: user.email,
        avatar:
          user.user_metadata?.avatar_url ||
          user.user_metadata?.picture || // Google
          "/avatars/default.jpg",
      }
    : {
        name: "Cargando…",
        email: "",
        avatar: "/avatars/default.jpg",
      };

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
        <NavMain items={navMain} />
        <NavSecondary items={navSecondary} className="mt-auto" />
      </SidebarContent>

      <SidebarFooter>
        {/* 👇 Pasamos los datos dinámicos */}
        <NavUser user={displayUser} />
      </SidebarFooter>
    </Sidebar>
  );
}
