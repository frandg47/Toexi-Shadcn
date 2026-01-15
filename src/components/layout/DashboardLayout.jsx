import { useState } from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import AppSidebar from "@/components/app-sidebar";
import { Outlet, useLocation } from "react-router-dom";
import { SiteHeader } from "@/components/site-header";

import {
  IconDashboard,
  IconCategory2,
  IconShoppingCart,
  IconUsers,
  IconSettings,
  IconMenu4,
  IconBrandApple,
  IconMedal,
  IconUsersGroup,
  IconReport,
  IconCash,
  IconCalculator,
  IconFileDollar
} from "@tabler/icons-react";

import SheetNewSale from "@/components/SheetNewSale";
import SheetNewLead from "@/components/SheetNewLead";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContextProvider";

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
      { title: "Marcas", url: "/dashboard/catalog/brands", icon: IconBrandApple },
      { title: "Categorías", url: "/dashboard/catalog/categories", icon: IconCategory2 },
    ],
  },
  { title: "Pedidos", url: "/dashboard/orders", icon: IconShoppingCart },
  { title: "Clientes", url: "/dashboard/customers", icon: IconUsers },
  { title: "Equipo", url: "/dashboard/team", icon: IconUsersGroup },
  { title: "Top Vendedores", url: "/dashboard/top-sellers", icon: IconMedal },
  { title: "Pagos a Vendedores", url: "/dashboard/sellers-payments", icon: IconCash },
  { title: "Presupuestos", url: "/dashboard/payment-calculator", icon: IconFileDollar },
  { title: "Cotizador", url: "/dashboard/quick-payment-calculator", icon: IconCalculator },
];

const navSecondary = [
  { title: "Configuraciones", url: "/dashboard/settings", icon: IconSettings },
];

export default function DashboardLayout() {
  const [saleOpen, setSaleOpen] = useState(false);
  const [leadOpen, setLeadOpen] = useState(false);
  const location = useLocation();
  const { user } = useAuth();

  const pageTitles = {
    "/dashboard": "Panel principal",
    "/dashboard/products": "Productos",
    "/dashboard/catalog/brands": "Marcas",
    "/dashboard/catalog/categories": "Categorías",
    "/dashboard/orders": "Pedidos",
    "/dashboard/customers": "Clientes",
    "/dashboard/team": "Equipo",
    "/dashboard/top-sellers": "Top Vendedores",
    "/dashboard/settings": "Configuración",
    "/dashboard/sellers-payments": "Pagos a Vendedores",
    "/dashboard/settings/comission": "Comisiones",
    "/dashboard/settings/fx-rates": "Cotizaciones",
  };

  const tituloActual = pageTitles[location.pathname] || "Dashboard";

  return (
    <SidebarProvider defaultOpen={true}>
      <AppSidebar
        title="Toexi Tech"
        navMain={navMain}
        navSecondary={navSecondary}
        actionButtons={[
          { label: "Nuevo pedido", onClick: () => setLeadOpen(true) },
          { label: "Nueva venta", onClick: () => setSaleOpen(true) },
        ]}
      />

      <SidebarInset>
        <SiteHeader titulo={tituloActual} />

        <main className="p-6 w-full mx-auto pt-[var(--header-height)]">
          <Outlet />
        </main>
      </SidebarInset>

      <SheetNewSale open={saleOpen} onOpenChange={setSaleOpen} lead={null} />
      <SheetNewLead
        open={leadOpen}
        onOpenChange={setLeadOpen}
        sellerId={user?.id}
      />
    </SidebarProvider>
  );
}
