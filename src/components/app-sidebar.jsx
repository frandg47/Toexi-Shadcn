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
  IconInfoCircle,
} from "@tabler/icons-react";

import { toast } from "sonner";
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

const showDevelopmentToast = (feature) => {
  toast("Funcionalidad en desarrollo", {
    description: `El módulo de ${feature} estará disponible próximamente.`,
    icon: <IconInfoCircle className="h-5 w-5 text-blue-500" />,
    duration: 3000,
  });
};

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
  {
    title: "Pedidos",
    url: "/dashboard",
    icon: IconShoppingCart,
    onClick: () => showDevelopmentToast("Pedidos"),
  },
  {
    title: "Clientes",
    url: "/dashboard",
    icon: IconUsers,
    onClick: () => showDevelopmentToast("Clientes"),
  },
  { title: "Equipo", url: "/dashboard/team", icon: IconUsersGroup },
];

const navSecondary = [
  { title: "Configuración", url: "/dashboard/settings", icon: IconSettings },
  {
    title: "Ayuda",
    url: "/dashboard",
    icon: IconHelp,
    onClick: () => showDevelopmentToast("Ayuda"),
  },
];

export default function AppSidebar(props) {
  const { user, profile } = useAuth();

  const displayUser =
    user || profile
      ? {
          name:
            profile?.name ||
            user?.user_metadata?.full_name ||
            user?.user_metadata?.name ||
            "Usuario",
          email: profile?.email || user?.email || "",
          avatar:
            user?.user_metadata?.avatar_url ||
            user?.user_metadata?.picture ||
            "/avatars/default.jpg",
          role: profile?.role || "",
        }
      : {
          name: "Cargando…",
          email: "",
          avatar: "/avatars/default.jpg",
        };

  console.log("user", displayUser);

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
