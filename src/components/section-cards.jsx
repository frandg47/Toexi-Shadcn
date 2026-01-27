import React, { useEffect, useMemo, useState } from "react";
import {
  IconTrendingUp,
  IconTrendingDown,
  IconPhone,
  IconShoppingCart,
  IconDatabase,
} from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabaseClient";
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function SectionCards() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    productsTotal: 0,
    productsNew: 0,
    productsTrend: null,
    stockTotal: 0,
    stockDefective: 0,
    pendingTotal: 0,
    pendingTrend: null,
    salesCount30d: 0,
    salesCountTrend: null,
  });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const now = new Date();
      const start30 = new Date(now);
      start30.setDate(start30.getDate() - 30);
      const start60 = new Date(now);
      start60.setDate(start60.getDate() - 60);

      try {
        const [
          { data: products },
          { data: variants },
          leadsTotalRes,
          leadsWindowRes,
          salesRes,
        ] = await Promise.all([
          supabase
            .from("products")
            .select("id, created_at")
            .eq("active", true),
          supabase
            .from("product_variants")
            .select("stock, stock_defective")
            .eq("active", true),
          supabase
            .from("leads")
            .select("id", { count: "exact", head: true })
            .eq("status", "pendiente"),
          supabase
            .from("leads")
            .select("id, created_at")
            .eq("status", "pendiente")
            .gte("created_at", start60.toISOString()),
          supabase
            .from("sales")
            .select("total_ars, sale_date, status")
            .gte("sale_date", start60.toISOString())
            .neq("status", "anulado"),
        ]);

        const productsTotal = products?.length ?? 0;
        const productsNew = products
          ? products.filter((p) => new Date(p.created_at) >= start30).length
          : 0;
        const productsPrev = products
          ? products.filter((p) => {
              const d = new Date(p.created_at);
              return d >= start60 && d < start30;
            }).length
          : 0;

        const stockTotal =
          variants?.reduce((acc, v) => acc + Number(v.stock || 0), 0) ?? 0;
        const stockDefective =
          variants?.reduce(
            (acc, v) => acc + Number(v.stock_defective || 0),
            0
          ) ?? 0;

        const pendingTotal = leadsTotalRes?.count ?? 0;
        const leadsWindow = leadsWindowRes?.data ?? [];
        const pendingLast30 = leadsWindow.filter(
          (l) => new Date(l.created_at) >= start30
        ).length;
        const pendingPrev30 = leadsWindow.filter((l) => {
          const d = new Date(l.created_at);
          return d >= start60 && d < start30;
        }).length;

        const sales = salesRes?.data ?? [];
        const salesCountLast30 = sales.filter(
          (s) => new Date(s.sale_date) >= start30
        ).length;
        const salesCountPrev30 = sales.filter((s) => {
          const d = new Date(s.sale_date);
          return d >= start60 && d < start30;
        }).length;

        const calcTrend = (current, prev) => {
          if (!prev) return null;
          return ((current - prev) / prev) * 100;
        };

        setStats({
          productsTotal,
          productsNew,
          productsTrend: calcTrend(productsNew, productsPrev),
          stockTotal,
          stockDefective,
          pendingTotal,
          pendingTrend: calcTrend(pendingLast30, pendingPrev30),
          salesCount30d: salesCountLast30,
          salesCountTrend: calcTrend(salesCountLast30, salesCountPrev30),
        });
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const formatTrend = (value) => {
    if (value === null || Number.isNaN(value)) return "--";
    return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
  };

  const stockDefectivePct = useMemo(() => {
    const total = stats.stockTotal + stats.stockDefective;
    if (!total) return 0;
    return (stats.stockDefective / total) * 100;
  }, [stats.stockTotal, stats.stockDefective]);

  return (
    <div
      className="grid grid-cols-1 gap-4 px-6 lg:px-6 md:grid-cols-2 xl:grid-cols-4
                 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card"
    >
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Total de Productos</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {loading ? "--" : stats.productsTotal.toLocaleString("es-AR")}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              {stats.productsTrend !== null && stats.productsTrend < 0 ? (
                <IconTrendingDown />
              ) : (
                <IconTrendingUp />
              )}
              {formatTrend(stats.productsTrend)}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="flex gap-2 font-medium">
            {loading
              ? "Nuevos modelos este mes"
              : `${stats.productsNew} nuevos este mes`}{" "}
            <IconPhone className="size-4" />
          </div>
          <div className="text-muted-foreground">
            Incluye celulares y accesorios
          </div>
        </CardFooter>
      </Card>

      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Stock Total</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {loading ? "--" : stats.stockTotal.toLocaleString("es-AR")}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <IconTrendingDown />
              {loading ? "--" : `${stockDefectivePct.toFixed(1)}%`}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="flex gap-2 font-medium">
            Unidades disponibles en tienda <IconDatabase className="size-4" />
          </div>
          <div className="text-muted-foreground">
            {loading
              ? "Contempla celulares y accesorios en stock"
              : `${stats.stockDefective} unidades defectuosas`}
          </div>
        </CardFooter>
      </Card>

      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Pedidos Pendientes</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {loading ? "--" : stats.pendingTotal.toLocaleString("es-AR")}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              {stats.pendingTrend !== null && stats.pendingTrend < 0 ? (
                <IconTrendingDown />
              ) : (
                <IconTrendingUp />
              )}
              {formatTrend(stats.pendingTrend)}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="flex gap-2 font-medium">
            Pedidos con estado pendiente <IconShoppingCart className="size-4" />
          </div>
          <div className="text-muted-foreground">
            Incluye pedidos recientes sin concretar
          </div>
        </CardFooter>
      </Card>

      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Ventas Ultimos 30 Dias</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {loading
              ? "--"
              : stats.salesCount30d.toLocaleString("es-AR")}
          </CardTitle>
          <CardAction className="shrink-0">
            <Badge variant="outline">
              {stats.salesCountTrend !== null && stats.salesCountTrend < 0 ? (
                <IconTrendingDown />
              ) : (
                <IconTrendingUp />
              )}
              {formatTrend(stats.salesCountTrend)}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="flex gap-2 font-medium">
            Cantidad de ventas <IconShoppingCart className="size-4" />
          </div>
          <div className="text-muted-foreground">
            Basado en ventas de los ultimos 30 dias
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
