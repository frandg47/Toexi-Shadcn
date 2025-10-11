import React from "react";
import { SiteHeader } from "@/components/site-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { IconChartBar } from "@tabler/icons-react";

const SalesConfig = () => {
  return (
    <>
      <SiteHeader titulo="Configuración de Ventas" />
      <div className="mt-6">
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <IconChartBar className="text-rose-600" />
              Ventas del Sistema
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              Visualizá el historial de ventas y configuraciones relacionadas.
            </p>
            {/* 📊 Aquí podrás mostrar gráficos o tablas de ventas */}
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default SalesConfig;
