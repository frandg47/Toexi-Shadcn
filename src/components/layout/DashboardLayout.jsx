// src/components/layout/DashboardLayout.jsx
import { useState } from "react";
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
import SheetNewSale from "@/components/SheetNewSale"; 
import { toast } from "sonner";
import MobileHeader from "./MobileHeader";

const showDevelopmentToast = (feature) =>
  toast("Funcionalidad en desarrollo", {
    description: `El módulo de ${feature} estará disponible próximamente.`,
  });

const navMain = [
  { title: "Panel principal", url: "/dashboard", icon: IconDashboard },
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
    url: "/dashboard/orders",
  },
  {
    title: "Clientes",
    icon: IconUsers,
    url: "/dashboard/customers",
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
  const [saleOpen, setSaleOpen] = useState(false); 
  return (
    <SidebarProvider>
      <AppSidebar
        title="Toexi Tech"
        navMain={navMain}
        navSecondary={navSecondary}
        actionButtonLabel="Nueva venta"
        onActionClick={() => {
          setSaleOpen(true);
        }}
      />

      <SidebarInset>
        <Header />
        <main className="p-6 mx-auto max-w-6xl w-full">
          <Outlet />
        </main>
      </SidebarInset>

      <SheetNewSale open={saleOpen} onOpenChange={setSaleOpen} lead={null} />
    </SidebarProvider>
  );
}
