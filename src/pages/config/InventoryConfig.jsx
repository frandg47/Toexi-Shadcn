import React from "react";
import { SiteHeader } from "@/components/site-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { IconBox } from "@tabler/icons-react";

const InventoryConfig = () => {
  return (
    <>
      <SiteHeader titulo="Configuración de Inventario" />
      <div className="mt-6">
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <IconBox className="text-amber-600" />
              Inventario de Productos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              Controlá las existencias y actualizá el stock de tus productos.
            </p>
            {/* 📦 Aquí podés mostrar una tabla del inventario */}
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default InventoryConfig;
