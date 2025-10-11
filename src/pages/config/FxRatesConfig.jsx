import React from "react";
import { SiteHeader } from "@/components/site-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { IconSettingsDollar } from "@tabler/icons-react";

const FxRatesConfig = () => {
  return (
    <>
      <SiteHeader titulo="Configuración de Cotizaciones" />
      <div className="mt-6">
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <IconSettingsDollar className="text-green-600" />
              Cotización del Dólar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              Administrá las cotizaciones activas e históricas del dólar.
            </p>
            {/* 💱 Aquí podrás mostrar y editar la tabla fx_rates */}
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default FxRatesConfig;
