// src/components/layout/DashboardLayout.jsx
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import AppSidebar from "@/components/app-sidebar";
import { Outlet } from "react-router-dom";
import Header from "../Header";
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
import { toast } from "sonner";
import MobileHeader from "./MobileHeader";

const showDevelopmentToast = (feature) =>
  toast("Funcionalidad en desarrollo", {
    description: `El módulo de ${feature} estará disponible próximamente.`,
  });

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
    icon: IconShoppingCart,
    onClick: () => showDevelopmentToast("Pedidos"),
    // url: "/dashboard/orders",
  },
  {
    title: "Clientes",
    icon: IconUsers,
    // url: "/dashboard/customers",
    onClick: () => showDevelopmentToast("Clientes"),
  },
  { title: "Equipo", url: "/dashboard/team", icon: IconUsersGroup },
];

const navSecondary = [
  { title: "Configuración", url: "/dashboard/settings", icon: IconSettings },
  {
    title: "Ayuda",
    icon: IconHelp,
    onClick: () => showDevelopmentToast("Ayuda"),
  },
];

export default function DashboardLayout() {
  return (
    <SidebarProvider>
      <AppSidebar
        title="Toexi Tech"
        navMain={navMain}
        navSecondary={navSecondary}
        actionButtonLabel="Nueva venta"
        onActionClick={() =>
          toast("Funcionalidad en desarrollo", {
            description: "Módulo de ventas",
          })
        }
      />

      <SidebarInset>
        {/* <MobileHeader title="Toexi Tech" /> */}
        <Header />
        <main className="p-6 mx-auto max-w-6xl w-full">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
