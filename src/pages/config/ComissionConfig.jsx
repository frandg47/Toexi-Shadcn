import React from "react";
import { SiteHeader } from "@/components/site-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { IconCurrencyDollar } from "@tabler/icons-react";

const ComissionConfig = () => {
  return (
    <>
      <SiteHeader titulo="Configuración de Comisiones" />
      <div className="mt-6">
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <IconCurrencyDollar className="text-blue-600" />
              Reglas de Comisión
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              Aquí podrás definir o modificar las comisiones asociadas a cada producto.
            </p>
            {/* ⚙️ Aquí podés insertar tu tabla de productos con sus comisiones */}
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default ComissionConfig;
