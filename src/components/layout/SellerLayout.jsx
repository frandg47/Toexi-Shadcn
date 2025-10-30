// src/components/layout/SellerLayout.jsx
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { useState } from "react";
import AppSidebar from "@/components/app-sidebar";
import { Outlet } from "react-router-dom";
import SheetNewLead from "../SheetNewLead";
import Header from "../Header";
import {
  IconHome,
  IconShoppingCart,
  IconChartBar,
  IconList,
  IconUsers,
  IconSettings,
  IconCalculator,
  IconQrcode,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { useAuth } from "../../context/AuthContextProvider";

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
  {
    title: "Mis pedidos",
    url: "/seller/orders",
    icon: IconList,
    // onClick: () => showDevelopmentToast("Mis pedidos"),
  },
  // { title: "Estadísticas", url: "/seller/stats", icon: IconChartBar,
  //   onClick: () => showDevelopmentToast("Estadísticas")
  //  },
  {
    title: "Clientes",
    url: "/seller/clients",
    // onClick: () => showDevelopmentToast("Clientes"),
    icon: IconUsers,
  },
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
  const [openLeadDialog, setOpenLeadDialog] = useState(false);
  const { user, role, isActive, status } = useAuth();
  console.log(
    "object SellerLayout -> user, role, isActive, status",
    user,
    role,
    isActive,
    status
  );
  console.log("id", user?.id);

  return (
    <SidebarProvider>
      <AppSidebar
        title="Panel de Ventas"
        navMain={navMain}
        navSecondary={navSecondary}
        actionButtonLabel="Nuevo pedido"
        onActionClick={() => setOpenLeadDialog(true)}
        // onActionClick={() => showDevelopmentToast("Crear pedido")}
      />

      <SidebarInset>
        <Header />
        <main className="p-6 mx-auto max-w-6xl w-full">
          <Outlet />
        </main>
      </SidebarInset>

      <SheetNewLead
        open={openLeadDialog}
        onOpenChange={setOpenLeadDialog}
        sellerId={user?.id}
      />
    </SidebarProvider>
  );
}
