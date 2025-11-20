"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

import { IconMedal, IconTrendingUp } from "@tabler/icons-react";
import { BarChart, Bar, XAxis, YAxis } from "recharts";


// ------------------------------
// MEDALLAS
// ------------------------------
const medals = [
  <IconMedal size={26} color="#FFD700" />, // OR0
  <IconMedal size={26} color="#C0C0C0" />, // PLATA
  <IconMedal size={26} color="#CD7F32" />, // BRONCE
];


// ------------------------------
// COMPONENTE GENERAL
// ------------------------------
export default function SellersTop() {
  const [topSales, setTopSales] = useState([]);
  const [topCommission, setTopCommission] = useState([]);

  // --------------------------
  // CARGAR **TOP SELLERS**
  // --------------------------
  const loadTopSales = async () => {
    const { data, error } = await supabase.rpc("get_top_sellers");
    if (error) return console.error(error);

    const sorted = [...data].sort((a, b) => b.total_sales - a.total_sales);

    const formatted = sorted.map((s, i) => ({
      ...s,
      medal: medals[i] || "",
      fill: `var(--chart-${(i % 5) + 1})`,
    }));

    setTopSales(formatted);
  };

  // --------------------------
  // CARGAR **TOP COMMISSIONS**
  // --------------------------
  const loadTopCommission = async () => {
    const { data, error } = await supabase.rpc("get_top_commission_earners");
    if (error) return console.error(error);

    const sorted = [...data].sort(
      (a, b) => b.total_commission - a.total_commission
    );

    const formatted = sorted.map((s, i) => ({
      ...s,
      medal: medals[i] || "",
      fill: `var(--chart-${(i % 5) + 1})`,
    }));

    setTopCommission(formatted);
  };


  // --------------------------
  // CARGAR TODO
  // --------------------------
  useEffect(() => {
    loadTopSales();
    loadTopCommission();
  }, []);

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
          {seller.medal}

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

          <span>{seller.seller_name}</span>
        </div>
      </foreignObject>
    );
  };

  return (
    <div className="space-y-10">
      {/* -------------------------------------------------- */}
      {/*        1) RANKING POR VENTAS REALIZADAS            */}
      {/* -------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle>Ranking: Cantidad de Ventas</CardTitle>
          <CardDescription>Vendedores con más ventas completadas</CardDescription>
        </CardHeader>

        <CardContent>
          <ChartContainer
            config={{}}
            style={{ height: `${topSales.length * 55}px` }}
          >
            <BarChart data={topSales} layout="vertical" barSize={32}>
              <YAxis
                dataKey="seller_name"
                type="category"
                width={230}
                tickLine={false}
                axisLine={false}
                tick={(props) => renderTick(topSales, props.payload, props.y)}
              />

              <XAxis type="number" hide />

              <ChartTooltip
                cursor={{ fill: "rgba(0,0,0,0.06)" }}
                content={<ChartTooltipContent />}
              />

              <Bar dataKey="total_sales" radius={6} />
            </BarChart>
          </ChartContainer>
        </CardContent>

        {/* FOOTER */}
        <CardFooter className="flex-col items-start gap-2 text-sm">
          <div className="flex gap-2 leading-none font-medium">
            Cantidad de ventas completadas por vendedor en el mes actual
            <IconTrendingUp className="h-4 w-4" />
          </div>
          <div className="text-muted-foreground leading-none">
            Mostrando la cantidad total de ventas para el último mes
          </div>
        </CardFooter>
      </Card>

      {/* -------------------------------------------------- */}
      {/*        2) RANKING POR COMISIONES GANADAS           */}
      {/* -------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle>Ranking: Comisiones Ganadas</CardTitle>
          <CardDescription>Vendedores que más dinero generaron</CardDescription>
        </CardHeader>

        <CardContent>
          <ChartContainer
            config={{}}
            style={{ height: `${topCommission.length * 55}px` }}
          >
            <BarChart data={topCommission} layout="vertical" barSize={32}>
              <YAxis
                dataKey="seller_name"
                type="category"
                width={230}
                tickLine={false}
                axisLine={false}
                tick={(props) =>
                  renderTick(topCommission, props.payload, props.y)
                }
              />

              <XAxis type="number" hide />

              <ChartTooltip
                cursor={{ fill: "rgba(0,0,0,0.06)" }}
                content={<ChartTooltipContent />}
              />

              <Bar dataKey="total_commission" radius={6} />
            </BarChart>
          </ChartContainer>
        </CardContent>

        {/* FOOTER */}
        <CardFooter className="flex-col items-start gap-2 text-sm">
          <div className="flex gap-2 leading-none font-medium">
            Cantidad de comisiones generadas por vendedor en el mes actual
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
