import React from "react";
import { useNavigate } from "react-router-dom";
import { SiteHeader } from "@/components/site-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import {
  IconCurrencyDollar,
  IconSettingsDollar,
  IconCreditCard,
  IconBox,
  IconChartBar,
  IconInfoCircle,
} from "@tabler/icons-react";

const ConfigurationPage = ({ titulo }) => {
  const navigate = useNavigate();

  const CARDS_CONFIG = [
    {
      id: "comission",
      label: "Comisiones",
      icon: <IconCurrencyDollar className="h-10 w-10 text-blue-600" />,
      path: "/dashboard/settings/comission",
    },
    {
      id: "fx_rates",
      label: "Cotizaciones",
      icon: <IconSettingsDollar className="h-10 w-10 text-green-600" />,
      path: "/dashboard/settings/fx-rates",
    },
    {
      id: "payment_methods",
      label: "Métodos de pago",
      icon: <IconCreditCard className="h-10 w-10 text-purple-600" />,
      path: "/dashboard/settings/payment-methods",
    },
    // {
    //   id: "inventory",
    //   label: "Inventario",
    //   icon: <IconBox className="h-10 w-10 text-amber-600" />,
    //   path: "/dashboard/settings/inventory",
    // },
    {
      id: "sales",
      label: "Ventas",
      icon: <IconChartBar className="h-10 w-10 text-rose-600" />,
      path: "/dashboard/settings/sales",
    },
  ];

  return (
    <>
      <SiteHeader titulo={titulo || "Configuraciones"} />

      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
        {CARDS_CONFIG.map((card) => (
          <Card
            key={card.id}
            onClick={() => {
              if (card.id === "sales") {
                toast("Funcionalidad en desarrollo", {
                  description: "Esta sección estará disponible próximamente.",
                  icon: <IconInfoCircle className="h-5 w-5 text-blue-500" />,
                  duration: 3000,
                });
                return;
              }
              navigate(card.path);
            }}
            className="cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02]"
          >
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-semibold">
                {card.label}
              </CardTitle>
              {card.icon}
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Configurar {card.label.toLowerCase()} del sistema.
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
};

export default ConfigurationPage;
