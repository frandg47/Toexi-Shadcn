import React from "react"
import { IconTrendingUp, IconTrendingDown, IconPhone, IconShoppingCart, IconCurrencyPeso, IconDatabase } from "@tabler/icons-react"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

// 🔹 En esta versión los números están fijos como ejemplo.
//    Luego podés traer datos reales con useEffect + fetch de Supabase.
export function SectionCards() {
  return (
    <div
      className="grid grid-cols-1 gap-4 px-4 lg:px-6 md:grid-cols-2 xl:grid-cols-4
                 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card">
      
      {/* Total de Productos */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Total de Productos</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            120
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <IconTrendingUp />
              +8%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="flex gap-2 font-medium">
            Nuevos modelos agregados este mes <IconPhone className="size-4" />
          </div>
          <div className="text-muted-foreground">Incluye celulares y accesorios</div>
        </CardFooter>
      </Card>

      {/* Stock Total */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Stock Total</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            540
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <IconTrendingUp />
              +5%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="flex gap-2 font-medium">
            Unidades disponibles en tienda <IconDatabase className="size-4" />
          </div>
          <div className="text-muted-foreground">
            Contempla celulares y accesorios en stock
          </div>
        </CardFooter>
      </Card>

      {/* Pedidos Pendientes */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Pedidos Pendientes</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            15
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <IconTrendingDown />
              -10%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="flex gap-2 font-medium">
            Disminuyeron las órdenes <IconShoppingCart className="size-4" />
          </div>
          <div className="text-muted-foreground">
            Incluye encargos con entrega a 5 días
          </div>
        </CardFooter>
      </Card>

      {/* Ingresos Estimados */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Ingresos Estimados (ARS)</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            $3.250.000
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <IconTrendingUp />
              +12%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="flex gap-2 font-medium">
            Basado en precio de venta actual <IconCurrencyPeso className="size-4" />
          </div>
          <div className="text-muted-foreground">
            Calculado con el stock y cotización vigente
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
