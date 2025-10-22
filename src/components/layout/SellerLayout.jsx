// src/components/layout/SellerLayout.jsx
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import AppSidebar from "@/components/app-sidebar";
import { Outlet } from "react-router-dom";
import Header from "../Header";
import {
  IconHome,
  IconShoppingCart,
  IconChartBar,
  IconUsers,
  IconSettings,
  IconCalculator,
  IconQrcode,
} from "@tabler/icons-react";
import { toast } from "sonner";

const showDevelopmentToast = (feature) =>
  toast("Funcionalidad en desarrollo", {
    description: `El módulo de ${feature} estará disponible próximamente.`,
  });

const navMain = [
  { title: "Inicio", url: "/seller/products", icon: IconHome },
  {
    title: "Mis ventas",
    url: "/seller/sales",
    icon: IconShoppingCart,
    onClick: () => showDevelopmentToast("Clientes"),
  },
  // { title: "Estadísticas", url: "/seller/stats", icon: IconChartBar,
  //   onClick: () => showDevelopmentToast("Estadísticas")
  //  },
  // { title: "Clientes", url: "/seller/clients", icon: IconUsers,
  //   onClick: () => showDevelopmentToast("Clientes")
  // },
  {
    title: "Mi QR",
    url: "/seller/qr",
    icon: IconQrcode,
    onClick: () => showDevelopmentToast("Mi QR"),
  },
  {
    title: "Calculadora de cotizaciones",
    url: "/seller/calculator",
    icon: IconCalculator,
    onClick: () => showDevelopmentToast("Calculadora de cotizaciones"),
  },
];

const navSecondary = [
  {
    title: "Configuración",
    url: "/seller/settings",
    icon: IconSettings,
    onClick: () => showDevelopmentToast("Configuración"),
  },
];

export default function SellerLayout() {
  return (
    <SidebarProvider>
      <AppSidebar
        title="Panel de Ventas"
        navMain={navMain}
        navSecondary={navSecondary}
        actionButtonLabel="Nuevo pedido"
        onActionClick={() =>
          toast("Funcionalidad en desarrollo", {
            description: "Módulo de pedidos",
          })
        }
      />

      <SidebarInset>
        <Header />
        <main className="p-6 mx-auto max-w-6xl w-full">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
