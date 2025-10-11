import React from "react";
import { SiteHeader } from "@/components/site-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { IconCreditCard } from "@tabler/icons-react";

const PaymentMethodsConfig = () => {
  return (
    <>
      <SiteHeader titulo="Configuración de Métodos de Pago" />
      <div className="mt-6">
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <IconCreditCard className="text-purple-600" />
              Métodos de Pago
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              Gestioná los métodos de pago disponibles y sus multiplicadores.
            </p>
            {/* 💳 Aquí podrás listar y editar los métodos de pago */}
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default PaymentMethodsConfig;
