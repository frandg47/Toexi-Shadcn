// src/components/layout/SellerLayout.jsx
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { useState } from "react";
import AppSidebar from "@/components/app-sidebar";
import { Outlet } from "react-router-dom";
import SheetNewLead from "../SheetNewLead";
import Header from "../Header";
import PaymentCalculatorDialog from "../PaymentCalculatorDialog"; // OJO: ruta corregida

import {
  paymentMethods,
  getInstallmentsForMethod,
} from "../../lib/paymentsConfig";

import {
  IconHome,
  IconShoppingCart,
  IconList,
  IconUsers,
  IconMedal,
  IconSettings,
  IconCalculator,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { useAuth } from "../../context/AuthContextProvider";

const showDevelopmentToast = (feature) =>
  toast("Funcionalidad en desarrollo", {
    description: `El módulo de ${feature} estará disponible próximamente.`,
  });

const navSecondary = [
  {
    title: "Configuración",
    url: "/seller/settings",
    icon: IconSettings,
    onClick: () => showDevelopmentToast("Configuración"),
  },
];

export default function SellerLayout() {
  const [openCalculatorDialog, setOpenCalculatorDialog] = useState(false);
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

  // 🔹 navMain DENTRO del componente → acá sí podemos usar setOpenCalculatorDialog
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
    },
    {
      title: "Clientes",
      url: "/seller/clients",
      icon: IconUsers,
    },
    {
      title: "Top Vendedores",
      url: "/seller/top-sellers",
      icon: IconMedal,
    },
    {
      title: "Calculadora de cotizaciones",
      icon: IconCalculator,
      onClick: () => setOpenCalculatorDialog(true),
    },
  ];

  return (
    <SidebarProvider>
      <AppSidebar
        title="Panel de Ventas"
        navMain={navMain}
        navSecondary={navSecondary}
        actionButtonLabel="Nuevo pedido"
        onActionClick={() => setOpenLeadDialog(true)}
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

      {/* Dialog de Calculadora */}
      <PaymentCalculatorDialog
        open={openCalculatorDialog}
        onOpenChange={setOpenCalculatorDialog}
        paymentMethods={paymentMethods}
        getInstallmentsForMethod={getInstallmentsForMethod}
        initialSubtotalUSD={0}
        initialExchangeRate={1440}
      />
    </SidebarProvider>
  );
}
