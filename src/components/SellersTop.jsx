"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { BarChart, Bar, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { IconTrendingUp } from "@tabler/icons-react";
import ConcentricLoader from "./ui/loading";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

const getMonthName = (dateString) => {
  if (!dateString) return "-";
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("es-ES", {
      month: "long",
      year: "numeric",
    }).format(date);
  } catch {
    return "-";
  }
};

// ------------------------------
// COMPONENTE GENERAL
// ------------------------------
export default function SellersTop({ role }) {
  const [topSales, setTopSales] = useState([]);
  const [topCommission, setTopCommission] = useState([]);
  const [loading, setLoading] = useState(true);
  const [monthFilter, setMonthFilter] = useState(() => {
    const now = new Date();
    // Defecto: último día del mes actual
    return new Date(now.getFullYear(), now.getMonth() + 1, 0)
      .toISOString()
      .split("T")[0];
  });
  const [availableMonths, setAvailableMonths] = useState([]);

  // Responsive row height
  const getRowHeight = () => {
    if (typeof window === "undefined") return 55;
    if (window.innerWidth < 480) return 80;
    if (window.innerWidth < 768) return 65;
    return 50;
  };

  const getYAxisWidth = () => {
    if (typeof window === "undefined") return 230;
    if (window.innerWidth < 480) return 40;
    if (window.innerWidth < 768) return 60;
    return 230;
  };

  const [rowHeight, setRowHeight] = useState(getRowHeight());
  const [yAxisWidth, setYAxisWidth] = useState(getYAxisWidth());

  useEffect(() => {
    const onResize = () => {
      setRowHeight(getRowHeight());
      setYAxisWidth(getYAxisWidth());
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);


  // --------------------------
  // CARGAR **TOP SELLERS**
  // --------------------------
  const loadTopSales = async () => {
    // Obtener el período completo basado en period_end
    const { data: periodData, error: periodError } = await supabase
      .from("commission_payments")
      .select("period_start, period_end")
      .eq("period_end", monthFilter)
      .limit(1)
      .single();
    
    if (periodError || !periodData) {
      setTopSales([]);
      return;
    }

    // Obtener todas las ventas en el período filtrado
    const { data: sales, error: salesError } = await supabase
      .from("sales")
      .select("seller_id")
      .gte("sale_date", periodData.period_start)
      .lte("sale_date", periodData.period_end)
      .eq("status", "vendido");

    if (salesError) return console.error(salesError);

    // Obtener datos de usuarios
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id_auth, name, last_name, avatar_url");
    
    if (usersError) return console.error(usersError);

    // Crear mapa de usuarios
    const usersMap = {};
    users?.forEach(u => {
      usersMap[u.id_auth] = u;
    });

    // Agrupar por vendedor
    const sellerData = {};
    sales?.forEach(sale => {
      if (!sale.seller_id) return;

      const seller = usersMap[sale.seller_id];
      if (!seller) return;

      if (!sellerData[sale.seller_id]) {
        sellerData[sale.seller_id] = {
          seller_id: sale.seller_id,
          seller_name: `${seller.name} ${seller.last_name || ''}`.trim(),
          avatar_url: seller.avatar_url,
          total_sales: 0,
        };
      }
      sellerData[sale.seller_id].total_sales += 1;
    });

    const sorted = Object.values(sellerData).sort((a, b) => b.total_sales - a.total_sales);

    const formatted = sorted.map((s, i) => ({
      ...s,
      fill: `var(--chart-${(i % 5) + 1})`,
    }));

    setTopSales(formatted);
  };

  // --------------------------
  // CARGAR **TOP COMMISSIONS**
  // --------------------------
  const loadTopCommission = async () => {
    // Obtener comisiones del mes filtrado
    const { data: monthPayments, error: paymentsError } = await supabase
      .from("commission_payments")
      .select("seller_id, total_amount")
      .eq("period_end", monthFilter);
    
    if (paymentsError) return console.error(paymentsError);

    // Obtener datos de usuarios
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id_auth, name, last_name, avatar_url");
    
    if (usersError) return console.error(usersError);

    // Crear mapa de usuarios
    const usersMap = {};
    users?.forEach(u => {
      usersMap[u.id_auth] = u;
    });

    // Agrupar comisiones por vendedor
    const commissionsByVendor = {};
    monthPayments?.forEach(payment => {
      const seller = usersMap[payment.seller_id];
      if (!seller) return;

      if (!commissionsByVendor[payment.seller_id]) {
        commissionsByVendor[payment.seller_id] = {
          seller_id: payment.seller_id,
          seller_name: `${seller.name} ${seller.last_name || ''}`.trim(),
          avatar_url: seller.avatar_url,
          total_commission: 0,
        };
      }
      commissionsByVendor[payment.seller_id].total_commission += Number(payment.total_amount || 0);
    });

    const sorted = Object.values(commissionsByVendor).sort(
      (a, b) => b.total_commission - a.total_commission
    );

    const formatted = sorted.map((s, i) => ({
      ...s,
      fill: `var(--chart-${(i % 5) + 1})`,
    }));

    setTopCommission(formatted);
  };

  // --------------------------
  // CARGA INICIAL (limpia y correcta)
  // --------------------------
  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      await loadTopSales();
      await loadTopCommission();
      
      // Obtener todos los meses disponibles
      const { data: allPayments, error } = await supabase
        .from("commission_payments")
        .select("period_end")
        .order("period_end", { ascending: false });
      
      if (!error && allPayments) {
        const uniqueMonths = [...new Set(allPayments.map(p => p.period_end))];
        setAvailableMonths(uniqueMonths);
      }
      
      setLoading(false);
    };

    loadAll();
  }, [monthFilter]);

  // --------------------------
  // FUNCIÓN PARA RENDER TICKS
  // --------------------------
  const renderTick = (data, payload, y) => {
    const seller = data.find((s) => s.seller_name === payload.value);
    if (!seller) return null;

    return (
      <foreignObject y={y - 18} width={220} height={36}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "14px",
          }}
        >
          <img
            src={seller.avatar_url}
            alt={seller.seller_name}
            style={{
              width: "34px",
              height: "34px",
              borderRadius: "50%",
              objectFit: "cover",
            }}
          />

          <span className="hidden md:inline">{seller.seller_name}</span>
        </div>
      </foreignObject>
    );
  };

  // --------------------------
  // LOADER GLOBAL
  // --------------------------
  if (loading) {
    return (
      <div className="w-full flex justify-center py-12">
        <ConcentricLoader />
      </div>
    );
  }

  // --------------------------
  // RENDER
  // --------------------------
  return (
    <div className="space-y-10">
      {/* Filtro de mes */}
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Filtrar por Mes</h2>
          <p className="text-sm text-muted-foreground">Selecciona un período para ver el ranking</p>
        </div>
        <Select value={monthFilter} onValueChange={setMonthFilter}>
          <SelectTrigger className="w-full lg:w-56">
            <SelectValue placeholder="Filtrar por mes" />
          </SelectTrigger>
          <SelectContent>
            {availableMonths.map((month) => (
              <SelectItem key={month} value={month}>
                {getMonthName(month)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* -------------------------------------------------- */}
      {/* 1) RANKING POR VENTAS */}
      {/* -------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle>{role === "superadmin" ? "Ranking: Cantidad de ventas" : "Mis Ventas"}</CardTitle>
          <CardDescription>{role === "superadmin" ? "Vendedores con más ventas completadas" : "Ventas completadas en el mes actual"}</CardDescription>
        </CardHeader>

        <CardContent>
          <ChartContainer
            config={{}}
            style={{ height: `${topSales.length * rowHeight}px`, width: "100%" }}
          >
            <BarChart data={topSales} layout="vertical" barSize={32}>
              <YAxis
                dataKey="seller_name"
                type="category"
                width={yAxisWidth}
                tickLine={false}
                axisLine={false}
                tick={(props) => renderTick(topSales, props.payload, props.y)}
              />
              <XAxis type="number" hide />

              <ChartTooltip
                cursor={{ fill: "rgba(0,0,0,0.06)" }}
                content={
                  <ChartTooltipContent
                    formatter={(value) => (
                      <>
                        <span className="text-muted-foreground">Ventas:</span>
                        <span className="text-foreground font-mono font-medium tabular-nums">
                          {value.toLocaleString("es-AR")}
                        </span>
                      </>
                    )}
                  />
                }
              />

              <Bar dataKey="total_sales" radius={6} />
            </BarChart>
          </ChartContainer>
        </CardContent>

        <CardFooter className="flex-col items-start gap-2 text-sm">
          <div className="flex gap-2 leading-none font-medium">
            {role === "superadmin" ? "Cantidad de ventas completadas por vendedor en el mes filtrado" : "Ventas completadas en el mes filtrado"}
            <IconTrendingUp className="h-4 w-4" />
          </div>
          <div className="text-muted-foreground leading-none">
            Mostrando la cantidad total de ventas para el último mes
          </div>
        </CardFooter>
      </Card>

      {/* -------------------------------------------------- */}
      {/* 2) RANKING POR COMISIONES */}
      {/* -------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle>{role === "superadmin" ? "Ranking: Comisiones Ganadas" : "Mis Comisiones"}</CardTitle>
          <CardDescription>{role === "superadmin" ? "Vendedores que más dinero generaron" : "Comisiones generadas en el mes actual"}</CardDescription>
        </CardHeader>

        <CardContent>
          <ChartContainer
            config={{}}
            style={{ height: `${topCommission.length * rowHeight}px`, width: "100%" }}
          >
            <BarChart data={topCommission} layout="vertical" barSize={32}>
              <YAxis
                dataKey="seller_name"
                type="category"
                width={yAxisWidth}
                tickLine={false}
                axisLine={false}
                tick={(props) => renderTick(topCommission, props.payload, props.y)}
              />
              <XAxis type="number" hide />

              <ChartTooltip
                cursor={{ fill: "rgba(0,0,0,0.06)" }}
                content={
                  <ChartTooltipContent
                    formatter={(value) => (
                      <>
                        <span className="text-muted-foreground">Comisión:</span>
                        <span className="text-foreground font-mono font-medium tabular-nums">
                          US$ {value.toLocaleString("es-AR")}
                        </span>
                      </>
                    )}
                  />
                }
              />

              <Bar dataKey="total_commission" radius={6} />
            </BarChart>
          </ChartContainer>
        </CardContent>

        <CardFooter className="flex-col items-start gap-2 text-sm">
          <div className="flex gap-2 leading-none font-medium">
            {role === "superadmin" ? "Cantidad de comisiones generadas por vendedor en el mes filtrado" : "Comisiones generadas en el mes filtrado"}
            <IconTrendingUp className="h-4 w-4" />
          </div>
          <div className="text-muted-foreground leading-none">
            Mostrando las comisiones ganadas totales para el último período
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
